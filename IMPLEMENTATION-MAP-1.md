# Implementation Map #1 — Fix CellCulture crash + Harden Firestore security rules

**Owner:** protocol manager (LIMS)
**Goal:** (a) repair two runtime crashes in `CellCulture.jsx`, (b) close the critical Firestore privilege-escalation vectors in `firestore.rules`, (c) align client code with the new rules.
**Non-goals (this iteration):** image cloud backup, calibration math, guest mode, architecture refactor (Context/router), accessibility. Those stay in the backlog.

---

## Threat model being fixed

| # | Attack | Vector | Severity |
|---|--------|--------|----------|
| A1 | Any authenticated user self-enrolls as **admin** in any lab (full takeover: delete members, delete `meta`, delete logs) | `firestore.rules:47` `allow create: if isOwner(memberId)` — no invitation check, no role check | Critical |
| A2 | Any user forges/deletes/reads others' invitations (invite `admin` to their own lab; cancel others' invites; enumerate pending invites by email) | `firestore.rules:76-79` `allow read/create/update/delete: if isAuth()` | Critical |
| A3 | Any user reads the full user directory + every user's lab membership list | `firestore.rules:31` `allow read: if isAuth()` | High |
| A4 | Any member edits/deletes any member's `personalLog` entry | `firestore.rules:70` `allow update: if isMember(labId)` | High |

Design principle: **membership and invitations are the only trusted gate.** Nothing about lab identity is guessable (Firestore auto-IDs, ~122-bit entropy) except by members — and members are now gated.

---

## Phase 1 — Fix `CellCulture.jsx` crash (do this first; 2 edits)

### Root cause
`CellCulture` receives `({ state, updateState, can, user, labId })` (`CellCulture.jsx:11`) and `App.jsx:474` passes no `setState`. Two handlers call the undefined `setState`:

- `toggleLogMaterial` → `CellCulture.jsx:122`
- `handleImageUpload` → `CellCulture.jsx:185`

Both throw `ReferenceError: setState is not defined` at runtime.

### Edit 1 — `toggleLogMaterial` (`CellCulture.jsx:121-131`)

Replace the `setState({...})` block with an `updateState` call. **Important:** map over `state.cultureLogs` (the FULL array), **not** the filtered `logs` variable (`CellCulture.jsx:27`). Mapping over `logs` would silently drop every soft-deleted log (they are filtered out by `!l.deletedAt`).

```js
const toggleLogMaterial = (logId, materialId) => {
  updateState({
    cultureLogs: (state.cultureLogs || []).map(l => {
      if (l.id === logId) {
        const checked = l.checkedMaterials || [];
        return { ...l, checkedMaterials: checked.includes(materialId) ? checked.filter(m => m !== materialId) : [...checked, materialId] };
      }
      return l;
    })
  });
};
```

### Edit 2 — `handleImageUpload` (`CellCulture.jsx:176-197`)

Replace the functional `setState(prevState => ...)` with an `updateState` call. Again map over the full `state.cultureLogs` array, not `logs`.

```js
const handleImageUpload = async (e, logId) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  try {
    const compressedImages = await Promise.all(
      files.map(file => compressImage(file, 1024, 0.75))
    );
    updateState({
      cultureLogs: (state.cultureLogs || []).map(l =>
        l.id === logId ? { ...l, images: [...(l.images || []), ...compressedImages] } : l
      )
    });
  } catch (err) {
    console.error("Error comprimiendo imagen:", err);
    alert("Ocurrió un error al intentar optimizar la foto. Revisa que sea el formato correcto.");
  }
  e.target.value = '';
};
```

### Phase 1 checks
- [ ] `grep -n "setState" src/components/CellCulture.jsx` → no remaining references to a bare `setState` (only `setShowConfig`, `setActiveCultureId`, `setPrintMode`, `setCustomPrompt`).
- [ ] `npm run lint` → the two `'setState' is not defined` errors (`no-undef`) at lines 122/185 are gone.
- [ ] Manual: open Cultivos tab → toggle a material in a protocol checklist → no console error, state persists after reload.
- [ ] Manual: upload a microscope photo to a timeline entry → image appears, survives reload.
- [ ] Manual: soft-delete a culture/log, then toggle a material or upload a photo → deleted entries are NOT resurrected (proves the full-array fix).

---

## Phase 2 — Harden `firestore.rules` (rules-only, no Cloud Functions)

### 2.1 Helper functions (add to top of rules)

```js
// Encodes an email the same way as encodeEmail() in src/utils/firebase.js
//   "user.name@gmail.com" -> "user_name_gmail_com"
// request.auth.token.email is already lowercase for email/password + Google.
function encodeEmail() {
  let email = request.auth.token.email;
  return email is string ? email.split('@').join('_').split('.').join('_') : '';
}

// Membership gate: an unexpired pending invite for THIS user (token email) in this lab.
// Paths use only the match capture $(labId) and the $(encodeEmail()) expression —
// no list.any + get() construct, which rules v2 does not reliably support.
function hasValidInvitation(labId) {
  let email = request.auth.token.email;
  if (!(email is string) || email.size() == 0) return false;
  let inv = get(/databases/$(database)/documents/labs/$(labId)/pendingInvites/$(encodeEmail()));
  return inv.exists
      && inv.data.role == request.resource.data.role
      && inv.data.role in ['admin', 'student']
      && (!('expiresAt' in inv.data) || inv.data.expiresAt > request.time);
}

// Lab-bootstrap path: the person who created the lab's meta/info is its first admin.
function isLabCreator(labId) {
  return exists(/databases/$(database)/documents/labs/$(labId)/meta/info)
      && get(/databases/$(database)/documents/labs/$(labId)/meta/info).data.createdBy == request.auth.uid;
}
```

> Syntax notes: rules v2 has no `is not` — use `!(x is string)`. Guard the token email before calling `encodeEmail()` (token email is null for some providers). All paths above use standard constructs (`$(...)` with match captures and function calls); nothing interpolates a lambda variable, so this compiles in the Rules Simulator. Verify anyway in the simulator before deploy.

### 2.2 `/users` — stop leaking the user directory

```js
match /users/{userId} {
  allow read: if isOwner(userId);
  allow write: if isOwner(userId);
}
```

Impact check before enabling: grep for `getUserProfile(<other user id>)` / `getUserProfile(userId)` where `userId` is NOT `auth.currentUser.uid`.
- `updateMemberRole`/`removeMember` (`firebase.js:192,205`) call `getUserProfile(targetUid)` only to refresh the target's `labs[]` cache — they already `try/catch` and degrade gracefully. No change needed; the cache just won't refresh (already logged as a warning).
- No other cross-user profile reads were found in Phase-0 analysis.

### 2.3 `/labs/{labId}/members` — require verified invitation OR lab creator

```js
match /labs/{labId}/members/{memberId} {
  allow read: if isMember(labId);
  allow create: if isOwner(memberId)
             && request.resource.data.role in ['admin', 'student']
             && (hasValidInvitation(labId) || isLabCreator(labId));
  allow update, delete: if isAdmin(labId);
}
```

This closes A1: a non-member cannot create their own member doc without a matching, unexpired invitation from an existing admin of that lab (or by being the lab's bootstrap creator).

### 2.4 `/labs/{labId}/meta` — add a bootstrap override for `info`

```js
match /labs/{labId}/meta/{docId} {
  allow read: if isMember(labId);
  allow create, update: if isMember(labId);
  allow delete: if isAdmin(labId);
}

// More-specific rule wins. Lab creation bootstrap: the creator writes meta/info first.
// Read is isMember-only: rules-side get()/exists() inside isLabCreator() is evaluated
// by the engine regardless of allow-read, so the bootstrap still passes.
match /labs/{labId}/meta/info {
  allow read: if isMember(labId);
  allow create: if isAuth()
             && request.resource.data.createdBy == request.auth.uid
             && !exists(/databases/$(database)/documents/labs/$(labId)/meta/info);
  allow update: if isMember(labId);
  allow delete: if isAdmin(labId);
}
```

> Security note: `isLabCreator` + this bootstrap means any auth user can self-create a **brand-new random lab** and be its admin. That is intended (first-user flow) and safe: auto-IDs are unguessable, and the created-by check prevents hijacking an existing lab's `info`.

### 2.5 `/labs/{labId}/personalLogs` — owner-or-admin updates (fixes A4)

```js
match /labs/{labId}/personalLogs/{logId} {
  allow read: if isMember(labId);
  allow create: if isMember(labId);
  allow update: if isMember(labId)
             && (isAdmin(labId) || resource.data.userId == request.auth.uid);
  allow delete: if isAdmin(labId);
}
```

Requires that the client writes `userId: user.uid` when creating logs. Verify `PersonalLog.jsx` `addPersonalLog` payload includes `userId` (see 2.7).

### 2.6 Invitations — lab-scoped `pendingInvites` subcollection (fixes A2)

**Design note (revision):** the earlier draft validated invites through the top-level `invitations/{emailKey}` array, which forced the `list.any(inv => get(...$(inv.labId)...))` construct that rules v2 does not reliably support. Invites are now **one doc per (lab, email)** at `labs/{labId}/pendingInvites/{emailKey}`. Every rule path is built only from the match capture `$(labId)` and the token-derived `$(encodeEmail())` — standard, simulator-safe.

```js
// Lab-scoped pending invites (display for invitee + membership gate for rules)
match /labs/{labId}/pendingInvites/{emailKey} {
  allow read: if isMember(labId);
  // Only lab admins can invite / edit / revoke
  allow create, update: if isAdmin(labId);
  // Invitee can decline (own doc); admin can revoke
  allow delete: if isAuth() && (emailKey == encodeEmail() || isAdmin(labId));
}

// Legacy top-level collection /invitations/{emailKey}: REMOVE this match entirely.
// Pre-existing pending invites lapse — see 2.9 migration note.
```

- Invitation **create/update restricted to an admin of that lab** → forged invites (incl. `role:'admin'`) are impossible (A2 forged half).
- The invitee sees only their own invites (client-side `collectionGroup` query filtered by their email — no enumeration) (A2 read half).
- Invitee **declines by deleting their own `pendingInvites` doc** — single-entry decline, no array surgery.
- Admin **revokes** the same way (also gives LabAdmin a "cancel invite" without extra UI work).

### 2.7 Client code changes to match the new rules

**`createLab`** (`firebase.js:145-171`) — invert write order so the bootstrap rule passes: meta/info FIRST, member doc second, profile third (box in 2.4). If step 2 fails after step 1, a retry hits the `!exists(info)` guard — wrap in try/catch and recover by fetching the existing profile (idempotent).

**`inviteMember`** (`firebase.js:265-285`) — rewrite to the new single-doc shape:

```js
export async function inviteMember(labId, labName, email, role, invitedByName) {
  const key = encodeEmail(email);
  const ref = doc(db, 'labs', labId, 'pendingInvites', key);
  if ((await getDoc(ref)).exists()) {
    throw new Error('Este usuario ya tiene una invitación pendiente para este laboratorio.');
  }
  await setDoc(ref, {
    email: email.toLowerCase(),
    labName,
    role,
    invitedBy: invitedByName,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
```

**`getMyInvitations`** (`firebase.js:287-295`) — read the invitee's own invites via collection-group query (a single-field auto index covers `where('email','==',...)`; nothing to add to `firestore.indexes.json`):

```js
export async function getMyInvitations(email) {
  const q = query(collectionGroup(db, 'pendingInvites'), where('email', '==', email.toLowerCase()));
  const snap = await getDocs(q);
  const now = new Date().toISOString();
  return snap.docs
    .map(d => ({ labId: d.ref.parent.parent.id, ...d.data() }))
    .filter(inv => !inv.expiresAt || inv.expiresAt > now);
}
```
(Add `collectionGroup` to the `firebase/firestore` imports.)

**`acceptInvitation`** (`firebase.js:297-327`) — keep member write + profile update; replace the inbox-array surgery with a single own-doc delete:

```js
// 1) member doc — validated by hasValidInvitation(labId) (role must match the invite)
// 2) profile update (owner-only, allowed by rules)
// 3) consume the invite — the invitee may delete their own pendingInvites doc
await deleteDoc(doc(db, 'labs', labId, 'pendingInvites', encodeEmail(user.email)));
```

**`declineInvitation`** (`firebase.js:329-340`) — precise single-entry decline; `LabSetup.jsx` / `ProfileSettings.jsx` UI unchanged:

```js
export async function declineInvitation(email, labId) {
  await deleteDoc(doc(db, 'labs', labId, 'pendingInvites', encodeEmail(email)));
}
```

**`PersonalLog.jsx`** — already writes `userId: user.uid` (`PersonalLog.jsx:69`) ✓ — no change needed for the owner-or-admin rule.

### 2.8 Deploy & test

1. Deploy rules: `npx firebase deploy --only firestore:rules`
2. Run the **Firebase Rules Simulator** with the cases below (authenticated user `alice@x.com` unless noted).

| Test | Expected |
|------|----------|
| `bob` (admin of L) creates `labs/L/pendingInvites/<alice_key>` | **Allow** |
| `alice` (student) creates `labs/L/pendingInvites/<bob_key>` | **Deny** (not admin of L) |
| `carl` (non-member) reads `labs/L/pendingInvites/<anything>` | **Deny** |
| `alice` creates `labs/L/members/alice` with `role:'student'` (matches bob's invite) | **Allow** |
| `alice` creates `labs/L/members/alice` with `role:'admin'` (invite says student) | **Deny** (role mismatch) |
| `alice` creates `labs/<victim>/members/alice` with `role:'admin'` (no invite, not creator) | **Deny** |
| `alice` (invitee) deletes `labs/L/pendingInvites/<alice_key>` | **Allow** (decline) |
| `bob` (admin) deletes `labs/L/pendingInvites/<carl_key>` | **Allow** (revoke) |
| `carl` deletes `labs/L/pendingInvites/<alice_key>` | **Deny** (not his, not admin) |
| `carl` reads `invitations/<bob_key>` | **Deny** (legacy match removed) |
| Lab bootstrap: `carl` creates `labs/<random>/meta/info` {createdBy:carl} then `members/carl` {role:'admin'} | **Allow** |
| `carl` (non-member) creates `labs/L/meta/info` (existing lab L) | **Deny** (info exists) |
| `carl` (student) updates another student's `personalLog` (not his, not admin) | **Deny** |
| `carl` (student) updates his OWN `personalLog` (userId == carl) | **Allow** |
| `carl` reads `users/<anyone>` | **Deny** |
| `carl` reads `users/carl` | **Allow** |

3. Smoke-test the app: login → LabSetup create → invite a second account → accept as admin/student → verify role gates render correctly.

### 2.9 Rollback & migration

- **Rollback:** rules deploy is reversible via the Firebase Console history or `firebase deploy` with the previous rules file. Keep the current `firestore.rules` content in `firestore.rules.bak` before editing. Client changes are plain git commits — `git revert` if needed.
- **Legacy invites lapse:** invites created before this change live only in `invitations/{emailKey}` (top level). They cannot be validated by the new rules, so unaccepted invites expire on deploy. They already self-expire at 7 days; communicate the deploy window to users.
- **Deploy order (rules + client must land together):** 1) commit client changes, 2) deploy rules, 3) smoke test. If rules deploy before the client, `createLab` breaks (member-first order is now denied); if the client ships before rules, invites write to a subcollection the old rules deny — so deploy both in the same window.

---

## Phase 3 — Recommended follow-up: Cloud Functions (definitive model)

The rules-only design closes all four attack vectors with standard constructs, but still has these gaps: `createLab` + member write + invite consumption are not atomic (a mid-flow failure leaves a half-created lab); role changes rely on the client being honest about which operation it intended; and there is no server-side audit of the privileged transitions. The canonical fix is to move the privileged operations behind **Firebase Callable Functions** (Admin SDK), then deny client-side writes to `members`/`pendingInvites` entirely.

- Functions: `createLab`, `inviteMember`, `acceptInvitation`, `declineInvitation`, `revokeInvitation`, `updateMemberRole`, `removeMember`.
- Each validates identity/role server-side (Admin SDK bypasses rules), performs atomic `db.runTransaction` where needed, and returns typed errors the UI already maps (`AuthGate.jsx:37-45`).
- Rules become `allow read: if isMember(labId); allow create/update/delete: if false;` for `members` and `pendingInvites` (clients can't touch them at all).
- Requires adding `firebase-functions` + a `functions/` directory and `firebase deploy --only functions`. Deploy burden is the main cost.

**Do Phase 2 first** (unblocks the critical CVEs immediately with zero infra); schedule Phase 3 if atomicity of the privileged transitions or server-side audit matters.

---

## Done-definition for this work item

- [ ] `npm run lint` clean for `CellCulture.jsx` (no `no-undef` `setState`).
- [ ] Checklist toggle + image upload verified in the running app (dev + after `npm run build`).
- [ ] New `firestore.rules` deployed; Rules Simulator cases from 2.8 all pass.
- [ ] `createLab` / `acceptInvitation` / `declineInvitation` updated and smoke-tested (create → invite → accept with both roles).
- [ ] `personalLogs` carry `userId` and owner-or-admin edit works.
- [ ] `firestore.rules.bak` committed before deploy (or the old content recoverable from git history).

## Adjacent cleanups you may fold in while touching these files

- Remove now-unused imports flagged by lint in `App.jsx` (`loadState`, `saveState`, `getLabMembers`, `writeAuditEntry`).
- `loadLabState`/`loadStateFromCloud`: wrap `JSON.parse` in try/catch (corrupt doc currently throws).
- Validate backup-import shape in `App.jsx:357-372` beyond `protocolName && subjects`.
- Same filtered-array hazard elsewhere in `CellCulture.jsx`: `updateLog` (`:119`) and `addLogToActive` (`:115`) also write `cultureLogs` mapped over the filtered `logs` array — audit ALL `cultureLogs` writes in the file to map over `state.cultureLogs` (full array) so soft-deleted entries survive. Same pattern check in `Inventory.jsx`, `PlateMapper.jsx`, `Spectrophotometry.jsx`.

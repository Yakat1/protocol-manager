# Implementation Map #2 — Architecture & Code Quality

**Owner:** protocol manager (LIMS)
**Goal:** eliminate dead code, harden error handling, consolidate duplication, and replace the App.jsx god component with React Context + `useReducer`, plus a HashRouter-based navigation.
**Decisions:** ✅ HashRouter (react-router-dom) — works on GH Pages subpath and Electron `file://`. ✅ React Context + `useReducer` — zero new state deps; components subscribe via `useContext`.
**Strategy:** phases ordered by risk. Each phase is its own commit; verify (lint + build + smoke) before moving on. Rollback = `git revert <phase-commit>`.

---

## Phase A — Dead code removal (mechanical, no behavior change)

### A1. Delete `src/App.css`
Never imported anywhere. Contains Sass-style nested rules and references to non-existent CSS vars (`--accent-bg`, `--accent-border`, `--social-bg`, `--text-h`, `--border`). Pure dead weight; importing it would break styling.
- [ ] `git rm src/App.css` (verify nothing imports it: `grep -rn "App.css" src/`)

### A2. Clean unused imports in `src/App.jsx`
- Line 2: remove `loadState, saveState` → keep `saveStateLocal, loadStateLocal, getDefaultState`
- Line 4: remove `getLabMembers, writeAuditEntry` (used only by child components) → keep the rest

### A3. Remove the dead legacy storage path
Confirmed dead: `storage.js` `saveState` (`:89`) and `loadState` (`:108`) are imported ONLY by the unused App imports; `firebase.js` `saveStateToCloud` (`:90`) and `subscribeToState` (`:114`) exist only for them.
- [ ] Remove `saveState`/`loadState`/`mergeCloudWithLocalImages` from `storage.js` (keep `saveStateLocal`/`loadStateLocal`/`getDefaultState`)
- [ ] Remove `saveStateToCloud` + `subscribeToState` from `firebase.js` — **KEEP** `loadStateFromCloud` (`:104`) + `getUserDocRef` (`:87`): still used by `migrateUserToLab` (`firebase.js:355`, the "Migrar a Lab" flow in LabSetup)
- [ ] Bonus (adjacent): wrap `JSON.parse` in try/catch inside `loadStateFromCloud` and `loadLabState` (`firebase.js:108,236`) — corrupt doc currently throws

### A4. `AssayAnalysisEngine.js:12` — remove unused `sumYY` (lint `no-unused-vars`)

### A5. `Workspace.jsx:12` — remove the `setState` prop from the destructuring (App never passes it)

### A6. `Sidebar.jsx:3` — remove unused `exportCSV` import (only `exportBackup` is used)

**Verify A:** `npm run lint` (expect: no new errors, several gone) · `npm run build` · smoke: login, load a lab, switch tabs.

---

## Phase B — Console noise + unhandled rejections

### B1. Remove `[SYNC]` debug logs
`App.jsx:223-229` (snapshot payload dump) and `App.jsx:248` (ignored-snapshot log). Delete both; the `remoteData.sessionId`/`saveTimerRef` values are still used by the logic around them.

### B2. try/catch around role fetches
- `switchLab` (`App.jsx:332-343`): wrap `getLabMemberRole` in try/catch → on failure keep previous `userRole`, `showToast('No se pudo verificar el rol; revisa tu conexión.')`. Do NOT leave the lab in a half-switched state: set `state=null` only after a successful role read.
- `handleLabReady` (`App.jsx:345-352`): same wrapper; on failure fall back to the profile-cache role (`profile.labs.find(l => l.labId === labId)?.role`).

### B3. Auth-listener catch (`App.jsx:176-179`) no longer conflates errors
Today ANY failure (network, permission, transient) → `needsLabSetup(true)`, sending real lab users into LabSetup. Fix:
- [ ] In the catch, retry `getUserProfile` once after ~1s (backoff)
- [ ] If the retry succeeds → normal path. If it fails with a network-ish error (`code` in `unavailable | network-request-failed | resource-exhausted`) → `showToast('Sin conexión con la nube. Reintentando…')` and keep the user in the loading state (set a `retrying` flag that re-runs the effect); do NOT flip to LabSetup
- [ ] Only genuinely missing profiles (`!profile?.labs?.length`) set `needsLabSetup(true)`

**Verify B:** lint · build · smoke: valid user logs in normally; devtools offline-mode login no longer lands in LabSetup.

---

## Phase C — ErrorBoundary + routing hardening

### C1. Add an ErrorBoundary
New file `src/components/ErrorBoundary.jsx` — class component with `componentDidCatch` + `getDerivedStateFromError`, renders a fallback panel (with the error message + a "Recargar" button → `window.location.reload()`). Wrap the lazy `<Suspense>` in `App.jsx:571-580` **and** key it by tab so a crash in one module doesn't blank the whole app:
```jsx
<ErrorBoundary key={activeTab}>
  <Suspense fallback={...}>...</Suspense>
</ErrorBoundary>
```

### C2. Explicit `'subjects'` route
`renderMainContent` (`App.jsx:451-497`): move the `default:` Workspace branch to its own `case 'subjects':`. Add a final `default:` that renders the Home dashboard (never silent mis-render again).

**Verify C:** lint · build · force a runtime error in a lazy module (temporarily `throw` in `Dashboard`) → fallback shows, other tabs still load.

---

## Phase D — Duplication consolidation (behavior-preserving)

### D1. Single immediate-save helper (kills the ×4 block `App.jsx:85-137`)
Add inside App.jsx (or a `useLabState` hook, see E1):
```js
const saveNow = useCallback((next) => {
  clearTimeout(saveTimerRef.current); saveTimerRef.current = null;
  if (activeLabId && !isSuspended && user) {
    saveStateLocal(next);
    saveLabState(activeLabId, next, sessionIdRef.current, user.uid).catch(console.error);
  }
}, [activeLabId, isSuspended, user]);
```
`setInventory`/`setCultureProtocols`/`setBufferRecipes`/`updateState` all become `setState(prev => { const next = ...; if (immediate) saveNow(next); return next; })`.

### D2. Single image-merge util (kills ×3)
Keep ONE implementation: export `mergeCloudWithLocalImages` from `storage.js` (`:130`). Then:
- [ ] Delete `mergeImages` (`App.jsx:587-598`) → import the util
- [ ] Replace the inline merge in the realtime subscription (`App.jsx:253-263`) with the same util (it operates on `prev` + `remoteState` — same shape)

### D3. Shared audit helper (kills ×6 copies)
New `src/utils/audit.js`:
```js
export const audit = (labId, user, action, target, details = {}) => {
  if (!labId || !user) return Promise.resolve();
  return writeAuditEntry(labId, {
    userId: user.uid, displayName: user.displayName || user.email, action, target, details,
  }).catch(err => console.error('Audit write failed:', err));
};
```
Refactor call sites to `audit(labId, user, ...)`:
- `CellCulture.jsx:17-20` (delete the local `audit` wrapper, reuse util)
- `Inventory.jsx:353` · `ProtocolsManager.jsx:45,57,111,157` · `LabAdmin.jsx:54,67,79`

### D4. Shared soft-delete helper
New `src/utils/softDelete.js`:
```js
export const softDelete = (list = [], id, user) =>
  list.map(item => item.id === id
    ? { ...item, deletedAt: new Date().toISOString(), deletedBy: user?.email || 'system' }
    : item);
```
Refactor call sites (each then does `updateState({ <slice>: softDelete(state.<slice>, id, user) }, { immediate: true })`):
- `Inventory.jsx:386` · `CellCulture.jsx:88,150` · `Scheduler.jsx:241` · `Calculator.jsx:228` · `Spectrophotometry.jsx:296` · `ProtocolsManager.jsx:54` · `Workspace.jsx:47`

### D5. Shared recurrence rules (kills the ×2 divergence)
The daily/every_2_days/every_3_days/weekly projection logic exists in BOTH `Dashboard.jsx:96-133` and `Scheduler.jsx:43-125`. Extract to `src/utils/recurrence.js`:
```js
export const RECURRENCE_TYPES = ['daily', 'every_2_days', 'every_3_days', 'weekly'];
export function projectRecurrence(startDate, recurrenceType, windowDays) { /* one implementation */ }
```
Both components import it. Behavior must be verified identical (compare outputs for the same inputs in a quick node script or manual check).

### D6. Shared `formatDuration`
`Timers.jsx:27-34` and `Dashboard.jsx:6-13` are identical. Extract to `src/utils/format.js`; both import it.

**Verify D:** lint · build · smoke each touched tab: delete an item (soft-delete), edit a log, toggle timers, compare Scheduler vs Dashboard agenda for the same recurrence.

---

## Phase E — LabContext + useReducer (the architectural core)

### E1. New `src/context/LabContext.jsx`
```jsx
const LabContext = createContext(null);
// reducer: { type: 'SET_STATE', state } | { type: 'UPDATE', partial }
// action creators dispatched through a `useLabState` hook that ALSO owns the
// persistence side effects (saveNow, debounced autosave, isLocalUpdateRef).
export const useLab = () => useContext(LabContext);
export function LabProvider({ children, ... }) { /* holds state + user + lab + can via useMemo */ }
```
Move from App.jsx into the provider: `state` (via `useReducer`), `updateState`/`setInventory`/`setCultureProtocols`/`setBufferRecipes` (now one generic `updateState` + the two slice helpers), `saveNow` (D1), `user`, `userRole`, `can`, `activeLabId`, `labProfile`, `activeSubjectId`/`setActiveSubjectId`, `showToast`, `isSuspended`/`resumeSession`.

Keep in App.jsx: the auth listener + lab subscription + autosave debounce **as custom hooks** in `src/hooks/` (`useAuth.js`, `useLabSync.js`, `useAutoSave.js`, `useInactivityLogout.js`) — each returns the pieces the provider needs. App becomes: gates (loading/auth/email/labsetup/suspended) + `<LabProvider>` + layout.

### E2. Context consumers (biggest prop-drilling wins)
- [ ] **Sidebar (18 props → 0)**: `const { state, updateState, user, labProfile, activeLabId, userRole, can, onSwitchLab, ... } = useLab();` Props removed from `App.jsx:549-569`.
- [ ] **Workspace (10 props → 4)**: consume `state/updateState/activeSubjectId/setActiveSubjectId` from context; keep only `userRole`, `onExportCSV`, `onExportBackup`, `onImportBackup` as props (they are App-level handlers).
- [ ] **Dashboard, ProfileSettings, GLPPrintLayout**: consume context where it eliminates threading (Dashboard: `state/updateState/showToast/setActiveTab`; ProfileSettings: `user/state/updateState/...`).
- [ ] **Tab components**: they already receive only the slices they need (`App.jsx:451-497`). Leave them prop-based in this phase; convert later if a slice needs many extras. Optional quick win: `Spectrophotometry` gets `userRole` via context instead of `userRole` prop (`App.jsx:480`) to unify the permissions API.

### E3. React 19 note
React 19 allows `<LabContext>` to be used as a Provider directly (`<LabContext value={...}>`) — use that form; no `.Provider` wrapper needed.

**Verify E:** lint · build · FULL smoke: every tab, lab creation, invite/accept, lab switch, offline (guest-cache) mode, suspend/resume ("Tomar el Control"), Electron dev (`npm run electron:dev`). This is the highest-risk phase — do it as its own commit and test thoroughly before Phase F.

---

## Phase F — HashRouter navigation

### F1. Add dependency
`npm i react-router-dom`

### F2. Routes
In `main.jsx`, wrap `<App/>` in `<HashRouter>` (hash = safe for GH Pages subpath AND Electron `file://`).

### F3. Replace the tab switch (`App.jsx:451-497`)
`renderMainContent()` becomes a `<Routes>` block:
```jsx
<Routes>
  <Route path="/" element={<Dashboard/>} />
  <Route path="/subjects" element={<Workspace/>} />
  <Route path="/plate" element={<PlateMapper/>} />
  ... one route per tab ...
  <Route path="/admin" element={userRole === 'admin' ? <LabAdmin/> : <Navigate to="/" replace/>} />
  <Route path="*" element={<Navigate to="/" replace/>} />
</Routes>
```
- `activeTab` state is replaced by `useLocation().pathname.slice(1)` — keep a tiny `activeTab` derived value so Sidebar highlight logic is untouched.
- Tab components receive the same props as today (moved into the route elements).

### F4. Navigation call sites
- [ ] Sidebar buttons → `useNavigate()` (keep `setSidebarOpen(false)`)
- [ ] `Dashboard`'s `setActiveTab` prop → `useNavigate()` or a `navigate(tab)` from context
- [ ] Mobile topbar remains `sidebarOpen`-only (no change)
- [ ] `setActiveSubjectId` wrapper (`App.jsx:553`) → `navigate('/subjects')`
- [ ] Remove the `'subjects'` implicit-default fallback from Phase C2 (now handled by the `<Route path="/subjects">`)

### F5. Free wins
- Refresh restores the tab (URL is state) — the "refreshing resets to Home" issue dies automatically
- Back/forward buttons work; deep links (e.g. `#/culture`) work; PWA offline reload keeps the tab

**Verify F:** lint · build · `npm run preview` (hash routing) · manual: every tab, browser back/forward, refresh on `#/spectro`, Electron dev, PWA install icon flow.

---

## Phase G — Follow-ups (out of scope, note only)

- Split the 3 biggest components into subcomponents: `WBReport.jsx` (859), `Spectrophotometry.jsx` (768), `Calculator.jsx` (749)
- Add a test suite (none exists): Vitest + React Testing Library for the new utils (`recurrence`, `softDelete`, `audit`, `formatDuration`) and the reducer
- Convert remaining tab components to context consumers if prop growth returns

---

## Done-definition (all phases)

- [ ] `npm run lint` has fewer errors than the baseline run; no new errors introduced by any phase
- [ ] `npm run build` clean (warnings pre-existing only)
- [ ] `App.jsx` under ~250 lines (was 598): gates + layout + hooks composition only
- [ ] `Sidebar`/`Workspace` receive no `state`/`updateState` props (context only)
- [ ] Refresh restores the current tab; back/forward navigate; `#/subjects` never falls through to Workspace silently
- [ ] Chunk-load or runtime errors show the ErrorBoundary fallback instead of a blank screen
- [ ] No `console.log` in src; audit/soft-delete/recurrence/formatDuration each have exactly one implementation
- [ ] Manual smoke of all 15 tabs + invite/accept + lab switch + offline + suspend/resume + Electron dev passes after Phase E

## Risks

- **Phase E is the riskiest**: two-way prop/context mismatch during transition. Mitigate by converting consumers one file at a time, lint+build after each, and testing suspend/resume + offline explicitly (both paths touch `state` heavily).
- **Router + PWA**: HashRouter avoids `navigateFallback` issues; keep `vite-plugin-pwa` config untouched.
- **Behavior regressions in D5**: recurrence outputs must match exactly; run a comparison before removing the second copy.

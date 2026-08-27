import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendEmailVerification
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  collection,
  collectionGroup,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { splitState, assembleState, STATE_SLICES } from './firestoreSync';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ─── Firestore con persistencia offline durable ──────────────────────────────
// persistentLocalCache + persistentMultipleTabManager: la cola offline deja de
// ser solo-memoria (sobrevive al cierre de pestaña) y el multi-tab funciona
// (la app ya suspende sesiones cross-tab). Si la persistencia no está
// disponible (incógnito restringido, etc.) se degrada a getFirestore.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err) {
  console.warn('Persistent offline cache unavailable, falling back to default Firestore:', err);
  db = getFirestore(app);
}
export { db };

export const googleProvider = new GoogleAuthProvider();

// ─── Auth Helpers ────────────────────────────────────────────────────────────

export const registerUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginWithGoogle = () =>
  signInWithPopup(auth, googleProvider);

export const logoutUser = () => signOut(auth);

export const sendVerificationEmail = (user) => sendEmailVerification(user);

export function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('Mínimo 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('Al menos una letra mayúscula');
  if (!/[a-z]/.test(password)) errors.push('Al menos una letra minúscula');
  if (!/[0-9]/.test(password)) errors.push('Al menos un número');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Al menos un carácter especial (!@#$...)');
  return errors;
}

export const onUserChange = (callback) =>
  onAuthStateChanged(auth, callback);

export const updateUserPassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user) throw new Error("auth/no-user");
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return updatePassword(user, newPassword);
};

// ─── Legacy Single-User Firestore (kept for migration) ──────────────────────

const getUserDocRef = (userId) =>
  doc(db, 'protocols', userId);

export async function loadStateFromCloud(userId) {
  const ref = getUserDocRef(userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    try {
      return JSON.parse(data.state);
    } catch (err) {
      console.warn('Error parsing legacy state for user', userId, err);
      return null;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Multi-Lab Architecture ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── User Profile ────────────────────────────────────────────────────────────

export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? snap.data() : null;
}

export async function setUserProfile(userId, data) {
  await setDoc(doc(db, 'users', userId), data, { merge: true });
}

// ─── Lab CRUD ────────────────────────────────────────────────────────────────

export async function createLab(user, labName) {
  const labRef = doc(collection(db, 'labs'));
  const labId = labRef.id;

  // 1) Create lab meta FIRST (bootstrap rule: createdBy == uid and no existing info doc)
  await setDoc(doc(db, 'labs', labId, 'meta', 'info'), {
    name: labName,
    createdBy: user.uid,
    createdAt: new Date().toISOString(),
  });

  // 2) Now self-enroll as admin (isLabCreator(labId) passes because meta/info exists)
  await setDoc(doc(db, 'labs', labId, 'members', user.uid), {
    role: 'admin',
    displayName: user.displayName || user.email,
    email: user.email,
    joinedAt: new Date().toISOString(),
  });

  // 3) Update user profile
  const profile = await getUserProfile(user.uid) || {};
  const labs = profile.labs || [];
  labs.push({ labId, labName, role: 'admin' });
  await setUserProfile(user.uid, { labs, activeLab: labId });

  return labId;
}

export async function getLabInfo(labId) {
  const snap = await getDoc(doc(db, 'labs', labId, 'meta', 'info'));
  return snap.exists() ? snap.data() : null;
}

export async function getLabMembers(labId) {
  const snap = await getDocs(collection(db, 'labs', labId, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLabMemberRole(labId, userId) {
  const snap = await getDoc(doc(db, 'labs', labId, 'members', userId));
  return snap.exists() ? snap.data().role : null;
}

export async function updateMemberRole(labId, userId, newRole) {
  await setDoc(doc(db, 'labs', labId, 'members', userId), { role: newRole }, { merge: true });
  // Profile cache update may fail if the caller isn't the profile owner (Firestore rules)
  try {
    const profile = await getUserProfile(userId);
    if (profile?.labs) {
      const labs = profile.labs.map(l => l.labId === labId ? { ...l, role: newRole } : l);
      await setUserProfile(userId, { labs });
    }
  } catch (err) {
    console.warn('Profile cache update skipped (permission denied). Role is saved in lab members.', err);
  }
}

export async function removeMember(labId, userId) {
  await deleteDoc(doc(db, 'labs', labId, 'members', userId));
  try {
    const profile = await getUserProfile(userId);
    if (profile?.labs) {
      const labs = profile.labs.filter(l => l.labId !== labId);
      await setUserProfile(userId, { labs, activeLab: labs[0]?.labId || null });
    }
  } catch (err) {
    console.warn('Profile cache update skipped (permission denied).', err);
  }
}

// ─── Lab State (shared data, per-slice documents) ────────────────────────────
// El estado se guarda como UN documento por slice en labs/{labId}/meta/<slice>
// con { data, version, updatedAt }. Esto permite detección de conflicto por
// slice (dos usuarios editando slices distintos ya no chocan) y escrituras
// transaccionales con versión monotónica.
//
// labs/{labId}/meta/state conserva SOLO metadatos de sesión (sessionId,
// activeUserId) y, durante la migración, el blob legacy `state` (para poder
// seguir leyendo laboratorios creados antes de este cambio).

const sessionRef = (labId) => doc(db, 'labs', labId, 'meta', 'state');
const sliceRef = (labId, name) => doc(db, 'labs', labId, 'meta', name);

const safeParse = (s) => {
  try { return JSON.parse(s); } catch { return null; }
};

// Escribe UN slice dentro de una transacción con chequeo de versión.
// Si la transacción no está disponible (offline/transitorio) cae a un setDoc
// incondicional, que SÍ queda en la cola persistente offline.
async function writeOneSlice(labId, name, data, base, conflicts, versions) {
  const ref = sliceRef(labId, name);
  try {
    const res = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const remoteVersion = snap.exists() ? (snap.data().version || 0) : 0;
      if (base != null && remoteVersion !== base) {
        return { conflict: true, remoteVersion };
      }
      tx.set(ref, { data, version: remoteVersion + 1, updatedAt: serverTimestamp() });
      return { conflict: false, version: remoteVersion + 1 };
    });
    if (res.conflict) conflicts.push(name);
    else versions[name] = res.version;
    return !res.conflict;
  } catch (err) {
    // Offline o transitorio: escribir incondicionalmente (cola persistente).
    console.warn('Transaction unavailable for slice "' + name + '", falling back to queued write:', err?.message);
    const nextVersion = base != null ? base + 1 : 1;
    await setDoc(ref, { data, version: nextVersion, updatedAt: serverTimestamp() });
    versions[name] = nextVersion;
    return true;
  }
}

/**
 * Guarda el estado completo como documentos por slice.
 *
 * @param {string} labId
 * @param {object} state Estado completo (las imágenes se despojan aquí).
 * @param {object} [opts]
 * @param {string|null} [opts.sessionId]
 * @param {string|null} [opts.userId]
 * @param {object|null} [opts.baseVersions] Mapa slice → versión sobre la que
 *   se basó la edición local. null ⇒ escritura incondicional (sin detección).
 * @returns {Promise<{status:'ok'|'conflict', conflicts:string[], versions:object}>}
 */
export async function saveLabState(labId, state, opts = {}) {
  const { sessionId = null, userId = null, baseVersions = null } = opts;
  const slices = splitState(state);
  const conflicts = [];
  const versions = {};

  await Promise.all(
    Object.entries(slices).map(([name, data]) =>
      writeOneSlice(labId, name, data, baseVersions?.[name] ?? null, conflicts, versions)
    )
  );

  // Metadatos de sesión (ligeros) + limpieza del blob legacy ya migrado.
  await setDoc(sessionRef(labId), {
    sessionId,
    activeUserId: userId,
    updatedAt: serverTimestamp(),
  }, { merge: false });

  return {
    status: conflicts.length ? 'conflict' : 'ok',
    conflicts,
    versions,
  };
}

export async function loadLabState(labId) {
  const sessionSnap = await getDoc(sessionRef(labId));
  const session = sessionSnap.exists() ? sessionSnap.data() : {};
  const versions = {};
  const slices = {};

  // Blob legacy (estado completo en el doc de sesión, pre-slices).
  const legacy = session.state ? safeParse(session.state) : null;
  if (legacy) {
    Object.assign(slices, splitState(legacy));
  } else {
    await Promise.all(STATE_SLICES.map(async (name) => {
      const snap = await getDoc(sliceRef(labId, name));
      if (snap.exists()) {
        slices[name] = snap.data().data;
        versions[name] = snap.data().version || 0;
      }
    }));
  }

  return {
    state: assembleState(slices),
    versions,
    sessionId: session.sessionId || null,
    activeUserId: session.activeUserId || null,
  };
}

export function subscribeToLabState(labId, callback) {
  const unsubs = [];
  const assembled = {};      // slice -> snapshot data
  const base = {};           // slice -> legacy blob value (solo migración)
  let session = {};
  let firstSnapshots = 0;
  const TOTAL = STATE_SLICES.length + 1; // slices + doc de sesión
  let ready = false;

  const maybeEmit = () => {
    if (!ready) return;
    const dataMap = {};
    const versions = {};
    for (const name of STATE_SLICES) {
      if (assembled[name] != null) {
        dataMap[name] = assembled[name].data;
        versions[name] = assembled[name].version || 0;
      } else if (base[name] !== undefined) {
        dataMap[name] = base[name];
      }
    }
    callback({
      state: assembleState(dataMap),
      versions,
      sessionId: session.sessionId || null,
      activeUserId: session.activeUserId || null,
    });
  };

  const first = () => {
    firstSnapshots += 1;
    if (firstSnapshots >= TOTAL) {
      ready = true;
      maybeEmit();
    }
  };

  // Doc de sesión (sessionId/activeUserId + blob legacy en migración)
  unsubs.push(onSnapshot(sessionRef(labId), (snap) => {
    session = snap.exists() ? snap.data() : {};
    if (session.state) {
      const parsed = safeParse(session.state) || {};
      for (const name of STATE_SLICES) base[name] = parsed[name];
    } else {
      for (const name of STATE_SLICES) delete base[name];
    }
    first();
    maybeEmit();
  }));

  // Un snapshot por slice
  for (const name of STATE_SLICES) {
    unsubs.push(onSnapshot(sliceRef(labId, name), (snap) => {
      if (snap.exists()) assembled[name] = snap.data();
      else delete assembled[name];
      first();
      maybeEmit();
    }));
  }

  return () => unsubs.forEach((u) => u());
}

// ─── Presence (quién está editando el lab) ───────────────────────────────────

export async function touchPresence(labId, user, extra = {}) {
  await setDoc(doc(db, 'labs', labId, 'editors', user.uid), {
    displayName: user.displayName || user.email,
    lastSeen: serverTimestamp(),
    // Qué módulo/slices está editando este usuario (para bloqueo por módulo)
    activeSlices: Array.isArray(extra.activeSlices) ? extra.activeSlices : [],
    tab: extra.tab || null,
    sessionId: extra.sessionId || null,
  });
}

export function subscribeToPresence(labId, callback) {
  return onSnapshot(collection(db, 'labs', labId, 'editors'), (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  });
}

// ─── Invitations (by email) ──────────────────────────────────────────────────
// One doc per (lab, invitee email) at labs/{labId}/pendingInvites/{randomId}.
// The invitee inbox is a collection-group query on the `email` field (see getMyInvitations).
// The invitee's doc id is carried into the member doc as `inviteId` so the Firestore
// rules can validate membership via a get() path built from a function parameter.

function encodeEmail(email) {
  return email.toLowerCase().replace(/[.@]/g, '_');
}

export async function inviteMember(labId, labName, email, role, invitedByName) {
  const emailKey = encodeEmail(email);
  const ref = doc(collection(db, 'labs', labId, 'pendingInvites'));

  const existing = await getDocs(query(
    collection(db, 'labs', labId, 'pendingInvites'),
    where('emailKey', '==', emailKey)
  ));
  if (!existing.empty) {
    throw new Error('Este usuario ya tiene una invitación pendiente para este laboratorio.');
  }

  await setDoc(ref, {
    email: email.toLowerCase(),
    emailKey,
    labName,
    role,
    invitedBy: invitedByName,
    invitedByUid: auth.currentUser?.uid || null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function getMyInvitations(email) {
  const q = query(
    collectionGroup(db, 'pendingInvites'),
    where('email', '==', email.toLowerCase())
  );
  const snap = await getDocs(q);
  const now = new Date().toISOString();
  return snap.docs
    .map(d => ({ id: d.id, labId: d.ref.parent.parent.id, ...d.data() }))
    .filter(inv => !inv.expiresAt || inv.expiresAt > now);
}

export async function acceptInvitation(user, invitation) {
  const { id, labId, labName, role } = invitation;

  // Add as member (rules validate: matching pendingInvites doc + role equality)
  await setDoc(doc(db, 'labs', labId, 'members', user.uid), {
    inviteId: id,
    role,
    displayName: user.displayName || user.email,
    email: user.email,
    joinedAt: new Date().toISOString(),
  });

  // Update user profile
  const profile = await getUserProfile(user.uid) || {};
  const labs = profile.labs || [];
  if (!labs.some(l => l.labId === labId)) {
    labs.push({ labId, labName, role });
  }
  await setUserProfile(user.uid, { labs, activeLab: profile.activeLab || labId });

  // Consume the invite (the invitee may delete their own pendingInvites doc)
  await deleteDoc(doc(db, 'labs', labId, 'pendingInvites', id));
}

export async function declineInvitation(email, labId) {
  const q = query(
    collection(db, 'labs', labId, 'pendingInvites'),
    where('email', '==', email.toLowerCase())
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// ─── Audit Log (immutable) ───────────────────────────────────────────────────

export async function writeAuditEntry(labId, { userId, displayName, action, target, details }) {
  const colRef = collection(db, 'labs', labId, 'auditLog');
  await addDoc(colRef, {
    userId,
    displayName,
    action,
    target,
    details: details || {},
    timestamp: serverTimestamp(),
  });
}

export function subscribeToAuditLog(labId, callback, maxEntries = 200) {
  const colRef = collection(db, 'labs', labId, 'auditLog');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxEntries));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(entries);
  });
}

// ─── Migration helper: move protocols/{userId} → labs/{labId} ────────────────

export async function migrateUserToLab(user) {
  const profile = await getUserProfile(user.uid);
  if (profile?.labs?.length > 0) return profile;

  const legacyState = await loadStateFromCloud(user.uid);
  const labName = legacyState?.protocolName || 'Mi Laboratorio';
  const labId = await createLab(user, labName);

  if (legacyState) {
    await saveLabState(labId, legacyState);
  }

  const updatedProfile = await getUserProfile(user.uid);
  return updatedProfile;
}

// ─── Personal Logbook (Bitácora) ─────────────────────────────────────────────

export async function addPersonalLog(labId, logData) {
  const colRef = collection(db, 'labs', labId, 'personalLogs');
  const docRef = await addDoc(colRef, {
    ...logData,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updatePersonalLog(labId, logId, logData) {
  const ref = doc(db, 'labs', labId, 'personalLogs', logId);
  await setDoc(ref, logData, { merge: true });
}

export async function deletePersonalLog(labId, logId) {
  await deleteDoc(doc(db, 'labs', labId, 'personalLogs', logId));
}

export function subscribeToPersonalLogs(labId, callback) {
  const colRef = collection(db, 'labs', labId, 'personalLogs');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(500));
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(logs);
  });
}

export async function getPersonalLogs(labId) {
  const colRef = collection(db, 'labs', labId, 'personalLogs');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(5000));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

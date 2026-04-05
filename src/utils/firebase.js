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
  updatePassword
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp
} from 'firebase/firestore';

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
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ─── Auth Helpers ────────────────────────────────────────────────────────────

export const registerUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginWithGoogle = () =>
  signInWithPopup(auth, googleProvider);

export const logoutUser = () => signOut(auth);

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

export async function saveStateToCloud(userId, state, sessionId = null) {
  const stateWithoutImages = {
    ...state,
    subjects: state.subjects?.map(s => ({ ...s, images: [] })) || [],
    cultureLogs: state.cultureLogs?.map(l => ({ ...l, images: [] })) || [],
  };
  const ref = getUserDocRef(userId);
  await setDoc(ref, { 
    state: JSON.stringify(stateWithoutImages),
    sessionId: sessionId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadStateFromCloud(userId) {
  const ref = getUserDocRef(userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return JSON.parse(data.state);
  }
  return null;
}

export function subscribeToState(userId, callback) {
  const ref = getUserDocRef(userId);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      try {
        const parsed = JSON.parse(data.state);
        callback({ state: parsed, sessionId: data.sessionId });
      } catch (e) {
        console.error('Error parsing Firestore state:', e);
      }
    }
  });
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

  // 1) Add creator as admin member FIRST (rules allow create for any auth user)
  await setDoc(doc(db, 'labs', labId, 'members', user.uid), {
    role: 'admin',
    displayName: user.displayName || user.email,
    email: user.email,
    joinedAt: new Date().toISOString(),
  });

  // 2) Now create lab meta (isMember check passes because member doc exists)
  await setDoc(doc(db, 'labs', labId, 'meta', 'info'), {
    name: labName,
    createdBy: user.uid,
    createdAt: new Date().toISOString(),
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

export async function updateMemberRole(labId, userId, newRole) {
  await setDoc(doc(db, 'labs', labId, 'members', userId), { role: newRole }, { merge: true });
  // Also update the user's own profile cache
  const profile = await getUserProfile(userId);
  if (profile?.labs) {
    const labs = profile.labs.map(l => l.labId === labId ? { ...l, role: newRole } : l);
    await setUserProfile(userId, { labs });
  }
}

export async function removeMember(labId, userId) {
  await deleteDoc(doc(db, 'labs', labId, 'members', userId));
  const profile = await getUserProfile(userId);
  if (profile?.labs) {
    const labs = profile.labs.filter(l => l.labId !== labId);
    await setUserProfile(userId, { labs, activeLab: labs[0]?.labId || null });
  }
}

// ─── Lab State (shared data) ─────────────────────────────────────────────────

export async function saveLabState(labId, state, sessionId = null) {
  const stateWithoutImages = {
    ...state,
    subjects: state.subjects?.map(s => ({ ...s, images: [] })) || [],
    cultureLogs: state.cultureLogs?.map(l => ({ ...l, images: [] })) || [],
  };
  const ref = doc(db, 'labs', labId, 'meta', 'state');
  await setDoc(ref, { 
    state: JSON.stringify(stateWithoutImages),
    sessionId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadLabState(labId) {
  const ref = doc(db, 'labs', labId, 'meta', 'state');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return JSON.parse(snap.data().state);
  }
  return null;
}

export function subscribeToLabState(labId, callback) {
  const ref = doc(db, 'labs', labId, 'meta', 'state');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      try {
        callback({ state: JSON.parse(data.state), sessionId: data.sessionId });
      } catch (e) {
        console.error('Error parsing lab state:', e);
      }
    }
  });
}

// ─── Invitations (by email) ──────────────────────────────────────────────────

function encodeEmail(email) {
  return email.toLowerCase().replace(/[.@]/g, '_');
}

export async function inviteMember(labId, labName, email, role, invitedByName) {
  const key = encodeEmail(email);
  const ref = doc(db, 'invitations', key);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().pending || []) : [];

  // Prevent duplicate invitation
  if (existing.some(inv => inv.labId === labId)) {
    throw new Error('Este usuario ya tiene una invitación pendiente para este laboratorio.');
  }

  existing.push({
    labId,
    labName,
    role,
    invitedBy: invitedByName,
    createdAt: new Date().toISOString(),
  });
  await setDoc(ref, { pending: existing });
}

export async function getMyInvitations(email) {
  const key = encodeEmail(email);
  const snap = await getDoc(doc(db, 'invitations', key));
  if (snap.exists()) {
    return snap.data().pending || [];
  }
  return [];
}

export async function acceptInvitation(user, invitation) {
  const { labId, labName, role } = invitation;

  // Add as member
  await setDoc(doc(db, 'labs', labId, 'members', user.uid), {
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

  // Remove this invitation
  const key = encodeEmail(user.email);
  const snap = await getDoc(doc(db, 'invitations', key));
  if (snap.exists()) {
    const remaining = (snap.data().pending || []).filter(i => i.labId !== labId);
    if (remaining.length > 0) {
      await setDoc(doc(db, 'invitations', key), { pending: remaining });
    } else {
      await deleteDoc(doc(db, 'invitations', key));
    }
  }
}

export async function declineInvitation(email, labId) {
  const key = encodeEmail(email);
  const snap = await getDoc(doc(db, 'invitations', key));
  if (snap.exists()) {
    const remaining = (snap.data().pending || []).filter(i => i.labId !== labId);
    if (remaining.length > 0) {
      await setDoc(doc(db, 'invitations', key), { pending: remaining });
    } else {
      await deleteDoc(doc(db, 'invitations', key));
    }
  }
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
    timestamp: new Date().toISOString(),
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
  // Check if user already has a profile with labs
  const profile = await getUserProfile(user.uid);
  if (profile?.labs?.length > 0) return profile;

  // Try to load legacy data
  const legacyState = await loadStateFromCloud(user.uid);
  
  // Create a new lab
  const labName = legacyState?.protocolName || 'Mi Laboratorio';
  const labId = await createLab(user, labName);

  // If there was legacy data, save it as the lab state
  if (legacyState) {
    await saveLabState(labId, legacyState);
  }

  const updatedProfile = await getUserProfile(user.uid);
  return updatedProfile;
}

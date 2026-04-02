import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot
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

// ─── Firestore Helpers ────────────────────────────────────────────────────────

const getUserDocRef = (userId) =>
  doc(db, 'protocols', userId);

/**
 * Guarda el estado completo del usuario en Firestore.
 * Las imágenes base64 grandes se guardan en IndexedDB local (no en Firestore)
 * para no exceder el límite de 1MB por documento de Firestore.
 */
export async function saveStateToCloud(userId, state) {
  // Extraer imágenes (base64 pesadas) antes de subir a Firestore
  const stateWithoutImages = {
    ...state,
    subjects: state.subjects?.map(s => ({ ...s, images: [] })) || [],
    cultureLogs: state.cultureLogs?.map(l => ({ ...l, images: [] })) || [],
  };

  const ref = getUserDocRef(userId);
  await setDoc(ref, { 
    state: JSON.stringify(stateWithoutImages),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Carga el estado inicial del usuario desde Firestore.
 */
export async function loadStateFromCloud(userId) {
  const ref = getUserDocRef(userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return JSON.parse(data.state);
  }
  return null;
}

/**
 * Suscripción en tiempo real: se ejecuta cada vez que otro dispositivo
 * guarda datos en Firestore para el mismo userId.
 */
export function subscribeToState(userId, callback) {
  const ref = getUserDocRef(userId);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      try {
        const parsed = JSON.parse(data.state);
        callback(parsed);
      } catch (e) {
        console.error('Error parsing Firestore state:', e);
      }
    }
  });
}

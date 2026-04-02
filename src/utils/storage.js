// ─── Storage Dual-Mode (IndexedDB + Firestore) ───────────────────────────────
// En modo .exe (Electron) → usa IndexedDB local
// En modo PWA / Web → usa Firestore para sincronización en tiempo real
// ─────────────────────────────────────────────────────────────────────────────

export const DB_NAME = 'ProtocolAssistantDB';
export const STORE_NAME = 'app_state';

// ─── IndexedDB (siempre disponible como caché local offline) ─────────────────

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveStateLocal(state) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(state, 'current_protocol');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadStateLocal() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('current_protocol');
    request.onsuccess = (e) => {
      const result = e.target.result;
      if (result) {
        // Migración de datos para mantener compatibilidad con versiones anteriores
        if (!result.inventory) result.inventory = [];
        if (!result.cultureProtocols) result.cultureProtocols = [];
        if (!result.cultureLogs) result.cultureLogs = [];
        if (!result.cultures) result.cultures = [];
        resolve(result);
      } else {
        resolve(getDefaultState());
      }
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// ─── Estado por defecto ──────────────────────────────────────────────────────

export function getDefaultState() {
  return {
    protocolName: "Nuevo Experimento",
    variables: [
      { id: "var_peso", name: "Peso", unit: "g", type: "number" },
      { id: "var_glucosa", name: "Glucosa", unit: "mg/dL", type: "number" },
      { id: "var_obs", name: "Observaciones", unit: "", type: "text" }
    ],
    subjects: [],
    inventory: [],
    cultureProtocols: [],
    cultureLogs: [],
    cultures: [],
  };
}

// ─── API Pública (detecta modo automáticamente) ──────────────────────────────

/**
 * Guarda el estado. Siempre sincroniza en IndexedDB local (para offline).
 * Si hay userId, también sincroniza con Firestore en segundo plano.
 */
export async function saveState(state, userId = null) {
  // Siempre guardar localmente (offline + Electron)
  await saveStateLocal(state);

  // Si hay usuario autenticado, sincronizar con Firestore
  if (userId) {
    try {
      const { saveStateToCloud } = await import('./firebase.js');
      await saveStateToCloud(userId, state);
    } catch (err) {
      console.warn('Sincronización en nube fallida (sin internet). Datos guardados localmente.', err);
    }
  }
}

/**
 * Carga el estado. Intenta Firestore primero si hay userId,
 * si falla (offline) carga desde IndexedDB local.
 */
export async function loadState(userId = null) {
  if (userId) {
    try {
      const { loadStateFromCloud } = await import('./firebase.js');
      const cloudState = await loadStateFromCloud(userId);
      if (cloudState) {
        // Mezclar con cache local para recuperar imágenes (que no se suben a Firestore)
        const localState = await loadStateLocal();
        return mergeCloudWithLocalImages(cloudState, localState);
      }
    } catch (err) {
      console.warn('Sin acceso a Firestore. Cargando desde caché local...', err);
    }
  }
  return loadStateLocal();
}

/**
 * Firestore no guarda imágenes base64 (muy pesadas).
 * Este merge recupera las imágenes del IndexedDB local y las injerta
 * en el estado de la nube para no perderlas al sincronizar.
 */
function mergeCloudWithLocalImages(cloudState, localState) {
  if (!localState) return cloudState;

  const mergedSubjects = (cloudState.subjects || []).map(cloudSubj => {
    const localSubj = (localState.subjects || []).find(s => s.id === cloudSubj.id);
    return localSubj ? { ...cloudSubj, images: localSubj.images || [] } : cloudSubj;
  });

  const mergedLogs = (cloudState.cultureLogs || []).map(cloudLog => {
    const localLog = (localState.cultureLogs || []).find(l => l.id === cloudLog.id);
    return localLog ? { ...cloudLog, images: localLog.images || [] } : cloudLog;
  });

  return {
    ...cloudState,
    subjects: mergedSubjects,
    cultureLogs: mergedLogs,
  };
}

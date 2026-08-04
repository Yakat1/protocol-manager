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
        if (!result.settings) result.settings = { theme: 'dark' };
        if (!result.bufferRecipes) result.bufferRecipes = [];
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
    settings: {
      theme: 'dark'
    },
    bufferRecipes: [],
  };
}

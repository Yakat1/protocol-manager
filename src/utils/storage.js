// ─── Storage Dual-Mode (IndexedDB + Firestore) ───────────────────────────────
// En modo .exe (Electron) → usa IndexedDB local
// En modo PWA / Web → usa Firestore para sincronización en tiempo real
// ─────────────────────────────────────────────────────────────────────────────
//
// IndexedDB es SIEMPRE el caché local de primer nivel. Desde el multi-lab, el
// estado local se guarda por laboratorio (clave `current_protocol:<labId>`) para
// que cambiar de laboratorio NO sobrescriba (y pierda) las imágenes locales de
// otro laboratorio. La clave legacy `current_protocol` se conserva para el modo
// invitado y como fuente de una migración única hacia la clave del lab.

export const DB_NAME = 'ProtocolAssistantDB';
export const STORE_NAME = 'app_state';

const LEGACY_KEY = 'current_protocol';
const keyFor = (labId) => (labId ? `current_protocol:${labId}` : LEGACY_KEY);
const migratedFlag = (labId) => `lims_migrated:${labId}`;

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

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Migraciones de forma del estado para compatibilidad con versiones previas.
function normalizeState(result) {
  if (!result) return null;
  if (!result.inventory) result.inventory = [];
  if (!result.cultureProtocols) result.cultureProtocols = [];
  if (!result.cultureLogs) result.cultureLogs = [];
  if (!result.cultures) result.cultures = [];
  if (!result.settings) result.settings = { theme: 'dark' };
  if (!result.bufferRecipes) result.bufferRecipes = [];
  return result;
}

export async function saveStateLocal(state, labId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(state, keyFor(labId));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadStateLocal(labId) {
  const db = await openDB();
  const key = keyFor(labId);

  let result = await requestToPromise(
    db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
  );

  // Migración única: copia el estado legacy (clave única) a la clave del lab.
  // Solo para usuarios con lab; en modo invitado (labId null) no se migra para
  // no contaminar un laboratorio con datos de invitado.
  if (!result && labId) {
    const flag = migratedFlag(labId);
    const alreadyMigrated = await requestToPromise(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(flag)
    );
    if (!alreadyMigrated) {
      const legacy = await requestToPromise(
        db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(LEGACY_KEY)
      );
      if (legacy) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(legacy, key);
        store.put(true, flag);
        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        result = legacy;
      }
    }
  }

  return normalizeState(result) || getDefaultState();
}

// ─── Merge de imágenes desde caché local ─────────────────────────────────────
// Conserva las imágenes locales (offline) al recibir estado remoto: para cada
// subject/cultureLog del estado de la nube, se copian las imágenes que el
// usuario tenga localmente si el id coincide.

export function mergeCloudWithLocalImages(cloudState, localState) {
  if (!localState) return cloudState;
  const mergedSubjects = (cloudState.subjects || []).map(cs => {
    const ls = (localState.subjects || []).find(s => s.id === cs.id);
    return ls ? { ...cs, images: ls.images || [] } : cs;
  });
  const mergedLogs = (cloudState.cultureLogs || []).map(cl => {
    const ll = (localState.cultureLogs || []).find(l => l.id === cl.id);
    return ll ? { ...cl, images: ll.images || [] } : cl;
  });
  return { ...cloudState, subjects: mergedSubjects, cultureLogs: mergedLogs };
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

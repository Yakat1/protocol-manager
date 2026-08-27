// ─── Capa pura de sincronización por slices ─────────────────────────────────
// Funciones puras (sin Firebase) para partir/reensamblar el estado en slices,
// comparar versiones y describir conflictos. Unit-testeadas en
// firestoreSync.test.js. La capa de red vive en firebase.js; esta capa solo
// transforma datos para que sea trivialmente testeable.

export const STATE_SLICES = [
  'protocolName',
  'variables',
  'settings',
  'subjects',
  'inventory',
  'cultures',
  'cultureLogs',
  'cultureProtocols',
  'bufferRecipes',
  'cages',
  'spectroProtocols',
  'spectroTemplates',
];

export const SLICE_DEFAULTS = {
  protocolName: 'Nuevo Experimento',
  variables: [
    { id: 'var_peso', name: 'Peso', unit: 'g', type: 'number' },
    { id: 'var_glucosa', name: 'Glucosa', unit: 'mg/dL', type: 'number' },
    { id: 'var_obs', name: 'Observaciones', unit: '', type: 'text' },
  ],
  settings: { theme: 'dark' },
  subjects: [],
  inventory: [],
  cultures: [],
  cultureLogs: [],
  cultureProtocols: [],
  bufferRecipes: [],
  cages: [],
  spectroProtocols: [],
  spectroTemplates: [],
};

/**
 * Partir el estado completo en un mapa slice → valor.
 * Despoja las imágenes de subjects/cultureLogs (local-only, nunca suben).
 */
export function splitState(state = {}) {
  const out = {};
  for (const s of STATE_SLICES) {
    if (state[s] !== undefined) out[s] = state[s];
  }
  if (Array.isArray(out.subjects)) {
    out.subjects = out.subjects.map((x) => ({ ...x, images: [] }));
  }
  if (Array.isArray(out.cultureLogs)) {
    out.cultureLogs = out.cultureLogs.map((x) => ({ ...x, images: [] }));
  }
  return out;
}

/** Reensamblar un estado completo desde un mapa slice → valor. */
export function assembleState(slices = {}) {
  const out = {};
  for (const s of STATE_SLICES) {
    out[s] = slices[s] !== undefined ? slices[s] : SLICE_DEFAULTS[s];
  }
  return out;
}

/** Conteo de ítems por slice (para resúmenes de UI). */
export function sliceCounts(state = {}) {
  const counts = {};
  for (const s of STATE_SLICES) {
    const v = state[s];
    if (Array.isArray(v)) counts[s] = v.length;
    else if (v && typeof v === 'object') counts[s] = Object.keys(v).length;
  }
  return counts;
}

/** Nombres de slices cuyo valor difiere entre dos estados. */
export function diffSlices(a = {}, b = {}) {
  const changed = [];
  for (const s of STATE_SLICES) {
    if (JSON.stringify(a[s]) !== JSON.stringify(b[s])) changed.push(s);
  }
  return changed;
}

/** Etiquetas legibles de cambios por slice para el banner de conflicto. */
export function describeDeltas(fromState = {}, toState = {}) {
  const fromCounts = sliceCounts(fromState);
  const toCounts = sliceCounts(toState);
  const names = diffSlices(fromState, toState);
  return names.map((s) => ({
    slice: s,
    from: fromCounts[s] ?? (fromState[s] === undefined ? null : '—'),
    to: toCounts[s] ?? (toState[s] === undefined ? null : '—'),
  }));
}

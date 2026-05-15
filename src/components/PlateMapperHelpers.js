export const ROWS = ['A','B','C','D','E','F','G','H'];
export const COLS = Array.from({length: 12}, (_, i) => i + 1);

export const WELL_TYPES = {
  unknown:  { label: 'Desconocido', abbr: 'UNK', color: '#22c55e' },
  standard: { label: 'Estándar',    abbr: 'STD', color: '#3b82f6' },
  blank:    { label: 'Blanco',      abbr: 'BLK', color: '#6b7280' },
  positive: { label: 'Ctrl (+)',    abbr: 'C+',  color: '#f59e0b' },
  negative: { label: 'Ctrl (−)',    abbr: 'C−',  color: '#ef4444' },
};

export const INNER_ROWS_IDX = [1,2,3,4,5,6]; // B-G
export const INNER_COLS_IDX = [1,2,3,4,5,6,7,8,9,10]; // 2-11

export const wellKey = (row, col) => `${row}${col}`;

export function parseWellId(id) {
  const m = id.match(/^([A-H])(\d{1,2})$/i);
  if (!m) return null;
  const ri = ROWS.indexOf(m[1].toUpperCase());
  const ci = COLS.indexOf(parseInt(m[2]));
  if (ri < 0 || ci < 0) return null;
  return { ri, ci };
}

export function getGroupStats(groups, wells) {
  const stats = {};
  groups.forEach(g => { stats[g.id] = { group: g, values: [] }; });
  Object.entries(wells).forEach(([, w]) => {
    if (w.groupId && w.value !== null && w.value !== undefined && stats[w.groupId]) {
      stats[w.groupId].values.push(typeof w.value === 'number' ? w.value : parseFloat(w.value));
    }
  });
  return Object.values(stats).filter(s => s.values.length > 0).map(s => {
    const nums = s.values.filter(v => !isNaN(v));
    const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
    const sd = nums.length > 1 ? Math.sqrt(nums.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (nums.length - 1)) : 0;
    return { ...s, mean, sd, n: nums.length };
  });
}

export function validateLayout(groups, wells) {
  const warnings = [];
  const usedTypes = new Set();
  Object.values(wells).forEach(w => {
    if (!w.groupId) return;
    const g = groups.find(gr => gr.id === w.groupId);
    if (g) usedTypes.add(g.wellType);
  });
  if (usedTypes.has('unknown') && !usedTypes.has('blank')) {
    warnings.push('Hay pocillos "Desconocido" pero no hay ningún "Blanco" asignado.');
  }
  if (usedTypes.has('unknown') && !usedTypes.has('standard') && !usedTypes.has('positive') && !usedTypes.has('negative')) {
    warnings.push('Hay pocillos "Desconocido" pero no hay ningún Control o Estándar.');
  }
  return warnings;
}

export function applySerialDilution(wells, activeGroupId, config) {
  const { startWell, startConc, unit, factor, steps, direction } = config;
  const pos = parseWellId(startWell);
  if (!pos || !activeGroupId) return null;
  const newWells = { ...wells };
  for (let i = 0; i < steps; i++) {
    const r = direction === 'vertical' ? pos.ri + i : pos.ri;
    const c = direction === 'horizontal' ? pos.ci + i : pos.ci;
    if (r >= ROWS.length || c >= COLS.length) break;
    const key = wellKey(ROWS[r], COLS[c]);
    const conc = startConc / Math.pow(factor, i);
    newWells[key] = { ...newWells[key], groupId: activeGroupId, concentration: parseFloat(conc.toPrecision(4)), concUnit: unit };
  }
  return newWells;
}

export function applyReplicates(wells, groups, count, direction) {
  const assigned = [];
  ROWS.forEach((r, ri) => {
    COLS.forEach((c, ci) => {
      const key = wellKey(r, c);
      if (wells[key]?.groupId) assigned.push({ ri, ci, data: wells[key] });
    });
  });
  if (!assigned.length) return null;
  const newWells = { ...wells };
  assigned.forEach(({ ri, ci, data }) => {
    for (let rep = 0; rep < count; rep++) {
      const nr = direction === 'vertical' ? ri + rep : ri;
      const nc = direction === 'horizontal' ? ci + rep : ci;
      if (nr >= ROWS.length || nc >= COLS.length) continue;
      const key = wellKey(ROWS[nr], COLS[nc]);
      newWells[key] = { ...data, replicateNum: rep + 1 };
    }
  });
  return newWells;
}

export function randomizeInner(wells) {
  const entries = [];
  Object.entries(wells).forEach(([, w]) => {
    if (w.groupId) entries.push({ ...w });
  });
  if (!entries.length) return null;
  // Shuffle
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  const innerKeys = [];
  INNER_ROWS_IDX.forEach(ri => {
    INNER_COLS_IDX.forEach(ci => {
      innerKeys.push(wellKey(ROWS[ri], COLS[ci]));
    });
  });
  const newWells = {};
  entries.forEach((entry, i) => {
    if (i < innerKeys.length) {
      newWells[innerKeys[i]] = entry;
    }
  });
  return newWells;
}

export function exportBioTekCSV(wells, groups) {
  const lines = ['PlateLayout'];
  lines.push('Well,Group,Sample,Type,Concentration');
  ROWS.forEach(r => {
    COLS.forEach(c => {
      const key = wellKey(r, c);
      const w = wells[key];
      if (w && w.groupId) {
        const g = groups.find(gr => gr.id === w.groupId);
        const type = g ? (WELL_TYPES[g.wellType]?.abbr || '') : '';
        lines.push(`${key},"${g?.name || ''}","${g?.name || ''}",${type},${w.concentration ?? ''}`);
      }
    });
  });
  return lines.join('\n');
}

export function exportSoftMaxPro(wells, groups) {
  let out = '~End\nGroup:\t';
  COLS.forEach(c => { out += `${c}\t`; });
  out += '\n';
  ROWS.forEach(r => {
    out += `${r}\t`;
    COLS.forEach(c => {
      const w = wells[wellKey(r, c)];
      const g = w?.groupId ? groups.find(gr => gr.id === w.groupId) : null;
      out += `${g ? g.name : ''}\t`;
    });
    out += '\n';
  });
  return out;
}

export function exportPlateCSV(wells, groups) {
  const lines = ['Pocillo,Grupo,Tipo,Concentracion,Replica,Valor'];
  ROWS.forEach(r => {
    COLS.forEach(c => {
      const key = wellKey(r, c);
      const w = wells[key];
      if (w) {
        const g = groups.find(gr => gr.id === w.groupId);
        const type = g ? (WELL_TYPES[g.wellType]?.label || '') : '';
        lines.push(`${key},"${g?.name || 'Sin Grupo'}",${type},${w.concentration ?? ''},${w.replicateNum ?? ''},${w.value ?? ''}`);
      }
    });
  });
  return lines.join('\n');
}

export function importSampleList(text, groups, wells, replicateCount, direction, populatePlate = true) {
  const names = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!names.length) return null;
  const newGroups = [...groups];
  const newWells = { ...wells };
  
  names.forEach((name, i) => {
    const gId = `imported_${Date.now()}_${i}`;
    const g = { id: gId, name, color: WELL_TYPES.unknown.color, wellType: 'unknown' };
    newGroups.push(g);
    
    if (populatePlate) {
      if (direction === 'horizontal') {
        // Replicas horizontales: las muestras avanzan hacia abajo por filas (A, B, C...) y las réplicas se extienden en columnas (1, 2, 3...)
        const blockIndex = Math.floor(i / ROWS.length);
        const ri = i % ROWS.length;
        const startCi = blockIndex * replicateCount;
        for (let rep = 0; rep < replicateCount; rep++) {
          const ci = startCi + rep;
          if (ri < ROWS.length && ci < COLS.length) {
            newWells[wellKey(ROWS[ri], COLS[ci])] = { groupId: gId, value: null, replicateNum: rep + 1 };
          }
        }
      } else {
        // Replicas verticales: las muestras avanzan hacia la derecha por columnas (1, 2, 3...) y las réplicas se extienden en filas (A, B, C...)
        const samplesPerCol = Math.floor(ROWS.length / replicateCount);
        if (samplesPerCol > 0) {
          const ci = Math.floor(i / samplesPerCol);
          const startRi = (i % samplesPerCol) * replicateCount;
          for (let rep = 0; rep < replicateCount; rep++) {
            const ri = startRi + rep;
            if (ri < ROWS.length && ci < COLS.length) {
              newWells[wellKey(ROWS[ri], COLS[ci])] = { groupId: gId, value: null, replicateNum: rep + 1 };
            }
          }
        }
      }
    }
  });
  return { groups: newGroups, wells: newWells };
}

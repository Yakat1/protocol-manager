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

export function randomizeInner(wells, groups) {
  const lockedGroupIds = new Set(groups.filter(g => g.locked).map(g => g.id));
  const entriesToShuffle = [];
  const lockedWells = {};

  Object.entries(wells).forEach(([key, w]) => {
    if (w.groupId) {
      if (lockedGroupIds.has(w.groupId)) {
        lockedWells[key] = w;
      } else {
        entriesToShuffle.push({ ...w });
      }
    }
  });

  if (!entriesToShuffle.length) return null;

  // Shuffle
  for (let i = entriesToShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entriesToShuffle[i], entriesToShuffle[j]] = [entriesToShuffle[j], entriesToShuffle[i]];
  }

  const availableInnerKeys = [];
  INNER_ROWS_IDX.forEach(ri => {
    INNER_COLS_IDX.forEach(ci => {
      const key = wellKey(ROWS[ri], COLS[ci]);
      if (!lockedWells[key]) {
        availableInnerKeys.push(key);
      }
    });
  });

  const newWells = { ...lockedWells };
  entriesToShuffle.forEach((entry, i) => {
    if (i < availableInnerKeys.length) {
      newWells[availableInnerKeys[i]] = entry;
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
  
  const lockedGroupIds = new Set(groups.filter(g => g.locked).map(g => g.id));
  const isLocked = (r, c) => {
    const w = wells[wellKey(ROWS[r], COLS[c])];
    return w && lockedGroupIds.has(w.groupId);
  };

  const slots = [];
  if (direction === 'horizontal') {
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = 0; c < COLS.length; c += replicateCount) {
        slots.push({ r, c });
      }
    }
  } else {
    for (let c = 0; c < COLS.length; c++) {
      for (let r = 0; r < ROWS.length; r += replicateCount) {
        slots.push({ r, c });
      }
    }
  }

  const validSlots = slots.filter(({ r, c }) => {
    for (let rep = 0; rep < replicateCount; rep++) {
      let ri = direction === 'vertical' ? r + rep : r;
      let ci = direction === 'horizontal' ? c + rep : c;
      if (ri >= ROWS.length || ci >= COLS.length) return false;
      if (isLocked(ri, ci)) return false;
    }
    return true;
  });

  let slotIndex = 0;
  
  names.forEach((name, i) => {
    const gId = `imported_${Date.now()}_${i}`;
    const g = { id: gId, name, color: WELL_TYPES.unknown.color, wellType: 'unknown' };
    newGroups.push(g);
    
    if (populatePlate && slotIndex < validSlots.length) {
      const { r: currRi, c: currCi } = validSlots[slotIndex];
      for (let rep = 0; rep < replicateCount; rep++) {
        let ri = direction === 'vertical' ? currRi + rep : currRi;
        let ci = direction === 'horizontal' ? currCi + rep : currCi;
        newWells[wellKey(ROWS[ri], COLS[ci])] = { groupId: gId, value: null, replicateNum: rep + 1 };
      }
      slotIndex++;
    }
  });
  return { groups: newGroups, wells: newWells };
}

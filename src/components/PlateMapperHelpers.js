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
  // Collect all unlocked groups to be laid out (preserving their order in the groups list)
  const lockedGroupIds = new Set(groups.filter(g => g.locked).map(g => g.id));
  const seenGroupIds = groups.filter(g => !g.locked).map(g => g.id);

  if (!seenGroupIds.length) return null;

  // Start with only locked wells
  const newWells = {};
  Object.entries(wells).forEach(([key, w]) => {
    if (w.groupId && lockedGroupIds.has(w.groupId)) {
      newWells[key] = w;
    }
  });

  // Collect the original data for each group (concentration, concUnit, etc.)
  const groupData = {};
  Object.values(wells).forEach(w => {
    if (w.groupId && !groupData[w.groupId] && !lockedGroupIds.has(w.groupId)) {
      groupData[w.groupId] = { ...w };
    }
  });

  const isOccupied = (ri, ci) => {
    const key = wellKey(ROWS[ri], COLS[ci]);
    return !!newWells[key];
  };

  if (direction === 'vertical') {
    // Vertical: each sample on its own row, replicas side-by-side
    // M1: A1,A2  |  M2: B1,B2  |  M3: C1,C2
    let currentRow = 0;
    let currentCol = 0;
    for (const gId of seenGroupIds) {
      // Find a row/col position where all replicas fit side-by-side without overlap
      let placed = false;
      while (currentRow < ROWS.length && !placed) {
        // Check if count replicas fit starting at (currentRow, currentCol)
        let fits = true;
        for (let rep = 0; rep < count; rep++) {
          const ci = currentCol + rep;
          if (ci >= COLS.length || isOccupied(currentRow, ci)) { fits = false; break; }
        }
        if (fits) {
          for (let rep = 0; rep < count; rep++) {
            const key = wellKey(ROWS[currentRow], COLS[currentCol + rep]);
            newWells[key] = { ...groupData[gId], groupId: gId, replicateNum: rep + 1 };
          }
          placed = true;
        }
        currentRow++;
      }
      if (!placed) break;
    }
  } else {
    // Horizontal: all samples across one row, replicas on subsequent rows
    // Row 1: M1, M2, M3  |  Row 2: M1, M2, M3
    let currentCol = 0;
    let startRow = 0;
    for (const gId of seenGroupIds) {
      // Check if count replicas fit vertically at (startRow..startRow+count-1, currentCol)
      let fits = true;
      for (let rep = 0; rep < count; rep++) {
        const ri = startRow + rep;
        if (ri >= ROWS.length || isOccupied(ri, currentCol)) { fits = false; break; }
      }
      if (!fits) {
        // Move to the next column block
        currentCol++;
        if (currentCol >= COLS.length) break;
        // Re-check
        fits = true;
        for (let rep = 0; rep < count; rep++) {
          const ri = startRow + rep;
          if (ri >= ROWS.length || isOccupied(ri, currentCol)) { fits = false; break; }
        }
      }
      if (fits) {
        for (let rep = 0; rep < count; rep++) {
          const ri = startRow + rep;
          const key = wellKey(ROWS[ri], COLS[currentCol]);
          newWells[key] = { ...groupData[gId], groupId: gId, replicateNum: rep + 1 };
        }
        currentCol++;
        // Wrap to next row block if we run out of columns
        if (currentCol >= COLS.length) {
          currentCol = 0;
          startRow += count;
        }
      }
    }
  }

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
  const isLocked = (ri, ci) => {
    const w = wells[wellKey(ROWS[ri], COLS[ci])];
    return w && lockedGroupIds.has(w.groupId);
  };

  // Create all groups first
  const createdGroupIds = names.map((name, i) => {
    const gId = `imported_${Date.now()}_${i}`;
    newGroups.push({ id: gId, name, color: WELL_TYPES.unknown.color, wellType: 'unknown' });
    return gId;
  });

  if (populatePlate) {
    if (direction === 'vertical') {
      // Vertical: each sample gets its own row, replicas side-by-side
      // M1: A1,A2  |  M2: B1,B2  |  M3: C1,C2
      let currentRow = 0;
      let colStart = 0;

      for (let i = 0; i < createdGroupIds.length; i++) {
        let placed = false;
        while (currentRow < ROWS.length && !placed) {
          let fits = true;
          for (let rep = 0; rep < replicateCount; rep++) {
            const ci = colStart + rep;
            if (ci >= COLS.length || isLocked(currentRow, ci)) { fits = false; break; }
            const key = wellKey(ROWS[currentRow], COLS[ci]);
            if (newWells[key]?.groupId) { fits = false; break; }
          }
          if (fits) {
            for (let rep = 0; rep < replicateCount; rep++) {
              const key = wellKey(ROWS[currentRow], COLS[colStart + rep]);
              newWells[key] = { groupId: createdGroupIds[i], value: null, replicateNum: rep + 1 };
            }
            placed = true;
          }
          currentRow++;
        }
        if (!placed) break;
      }
    } else {
      // Horizontal: all samples across columns, replicas on subsequent rows
      // Row A: M1, M2, M3  |  Row B: M1, M2, M3
      let currentCol = 0;
      let startRow = 0;

      for (let i = 0; i < createdGroupIds.length; i++) {
        // Check if replicas fit vertically at this position
        let fits = true;
        for (let rep = 0; rep < replicateCount; rep++) {
          const ri = startRow + rep;
          if (ri >= ROWS.length || isLocked(ri, currentCol)) { fits = false; break; }
          const key = wellKey(ROWS[ri], COLS[currentCol]);
          if (newWells[key]?.groupId) { fits = false; break; }
        }

        if (!fits) {
          currentCol++;
          if (currentCol >= COLS.length) {
            currentCol = 0;
            startRow += replicateCount;
          }
          if (startRow >= ROWS.length) break;
          // Re-check at new position
          fits = true;
          for (let rep = 0; rep < replicateCount; rep++) {
            const ri = startRow + rep;
            if (ri >= ROWS.length || isLocked(ri, currentCol)) { fits = false; break; }
            const key = wellKey(ROWS[ri], COLS[currentCol]);
            if (newWells[key]?.groupId) { fits = false; break; }
          }
        }

        if (fits) {
          for (let rep = 0; rep < replicateCount; rep++) {
            const ri = startRow + rep;
            const key = wellKey(ROWS[ri], COLS[currentCol]);
            newWells[key] = { groupId: createdGroupIds[i], value: null, replicateNum: rep + 1 };
          }
          currentCol++;
          if (currentCol >= COLS.length) {
            currentCol = 0;
            startRow += replicateCount;
          }
        }
      }
    }
  }

  return { groups: newGroups, wells: newWells };
}

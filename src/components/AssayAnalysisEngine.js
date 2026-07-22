import { wellKey, ROWS, COLS } from './PlateMapperHelpers';
import * as XLSX from 'xlsx';

export const ASSAY_KITS = [
  {
    id: 'cayman_707002',
    name: 'Catalase Assay Kit (Cayman 707002)',
    description: 'Asegúrate de configurar la curva estándar antes de analizar.',
    standardCurveSetup: {
      blankGroupNote: 'Crea un grupo tipo "Blanco" — el sistema lo asignará automáticamente en A1 y A2 (duplicado).',
      standardGroupNote: 'Crea un grupo "Estándar" — el sistema asignará los 6 estándares (0–75 μM) en pares de columnas 1-2, de la fila B a la G.',
      blankWells: ['A1', 'A2'],
      standards: [
        { conc: 5,  unit: 'μM', wells: ['B1', 'B2'] },
        { conc: 15, unit: 'μM', wells: ['C1', 'C2'] },
        { conc: 30, unit: 'μM', wells: ['D1', 'D2'] },
        { conc: 45, unit: 'μM', wells: ['E1', 'E2'] },
        { conc: 60, unit: 'μM', wells: ['F1', 'F2'] },
        { conc: 75, unit: 'μM', wells: ['G1', 'G2'] }
      ]
    },
    defaultMethod: 'linear',
    requiredInputs: [
      { id: 'user_sample_dilution', label: 'Dilución Muestra', type: 'number', default: 1 },
      { id: 'reaction_time', label: 'Tiempo (min)', type: 'number', default: 20 }
    ]
  },
  {
    id: 'generic_free',
    name: 'Curva Libre (Regresión o Factor)',
    description: 'Selecciona tu grupo estándar y el método de cálculo (Regresión Lineal o Factor).',
    standardCurveSetup: null, // No auto setup
    defaultMethod: 'linear',
    requiredInputs: [
      { id: 'user_sample_dilution', label: 'Dilución Muestra', type: 'number', default: 1 },
      { id: 'reaction_time', label: 'Tiempo (min)', type: 'number', default: 1 }
    ]
  }
];

export function applyCustomConcentrations(wells, groupId, startWell, concentrations, direction, ROWS, COLS, wellKey, parseWellId) {
  const pos = parseWellId(startWell);
  if (!pos) return null;
  const newWells = { ...wells };
  concentrations.forEach((conc, i) => {
    const r = direction === 'vertical' ? pos.ri + i : pos.ri;
    const c = direction === 'horizontal' ? pos.ci + i : pos.ci;
    if (r >= ROWS.length || c >= COLS.length) return;
    const key = wellKey(ROWS[r], COLS[c]);
    newWells[key] = { ...newWells[key], groupId, concentration: conc, concUnit: 'μM' };
  });
  return newWells;
}

export function linearRegression(pts) {
  const n = pts.length;
  if (n === 0) return { m: 0, b: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let {x, y} of pts) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }
  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return { m: 0, b: sumY / n, r2: 0 };
  
  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;
  
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let {x, y} of pts) {
    const yPred = m * x + b;
    ssTot += Math.pow(y - meanY, 2);
    ssRes += Math.pow(y - yPred, 2);
  }
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

  return { m, b, r2 };
}

export function calculateFactor(pts) {
  const n = pts.length;
  if (n === 0) return 0;
  let sumConc = 0;
  let sumAbs = 0;
  for (let {x, y} of pts) {
    sumConc += x;
    sumAbs += y;
  }
  if (sumAbs === 0) return 0;
  return sumConc / sumAbs;
}

export function runGenericAnalysis(kitId, originalWells, groups, standardGroupId, method, userInputs) {
  const wells = JSON.parse(JSON.stringify(originalWells));
  
  // Extract standard points
  const pts = [];
  if (standardGroupId) {
    ROWS.forEach(r => {
      COLS.forEach(c => {
        const k = wellKey(r, c);
        const w = wells[k];
        if (w && w.groupId === standardGroupId && typeof w.concentration === 'number' && typeof w.value === 'number') {
          pts.push({ x: w.concentration, y: w.value, well: k });
        }
      });
    });
  }

  let curveParams = null;
  let factor = null;

  if (method === 'linear') {
    if (pts.length > 1) curveParams = linearRegression(pts);
  } else if (method === 'factor') {
    if (userInputs.manual_factor && parseFloat(userInputs.manual_factor) > 0) {
      factor = parseFloat(userInputs.manual_factor);
    } else if (pts.length > 0) {
      factor = calculateFactor(pts);
    }
  }

  const dilution = parseFloat(userInputs.user_sample_dilution || 1);
  const time = parseFloat(userInputs.reaction_time || 1);
  const isCatalase = kitId === 'cayman_707002';

  // Apply to all wells
  ROWS.forEach(r => {
    COLS.forEach(c => {
      const k = wellKey(r, c);
      const w = wells[k];
      if (w && typeof w.value === 'number') {
        const yVal = w.value; // raw absorbance, assuming blank=0
        
        // 1. Calculate Concentration
        let conc = 0;
        if (method === 'linear' && curveParams && curveParams.m !== 0) {
          conc = (yVal - curveParams.b) / curveParams.m;
        } else if (method === 'factor' && factor !== null) {
          conc = yVal * factor;
        }
        w.calculated_concentration = conc;

        // 2. Calculate Final Activity
        if (isCatalase) {
          // Catalase specific: (uM * (170/20)) / time * dilution
          const cat_uM = conc * 8.5;
          w.final_activity = (cat_uM / time) * dilution;
        } else {
          // Generic: Conc * Dilution / Time
          w.final_activity = (conc * dilution) / time;
        }
      }
    });
  });

  return { results: wells, curveParams, factor, pts };
}

export function generateAnalysisXLSX(kitName, processedWells, groups, method, curveParams, factor, userInputs, standardGroupId) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Results
  const resultsData = [];
  ROWS.forEach(r => {
    COLS.forEach(c => {
      const k = wellKey(r, c);
      const w = processedWells[k];
      if (w && w.groupId) {
        const g = groups.find(gr => gr.id === w.groupId);
        resultsData.push({
          Pocillo: k,
          Grupo: g?.name || '',
          Tipo: g?.wellType || '',
          Replicado: w.replicateNum || '',
          'Lectura (Abs)': w.value !== null && w.value !== undefined ? w.value : '',
          'Concentración Interpolada': w.calculated_concentration !== undefined ? parseFloat(w.calculated_concentration.toFixed(4)) : '',
          'Actividad Final': w.final_activity !== undefined ? parseFloat(w.final_activity.toFixed(4)) : ''
        });
      }
    });
  });
  const wsResults = XLSX.utils.json_to_sheet(resultsData);
  XLSX.utils.book_append_sheet(wb, wsResults, "Resultados de Muestras");

  // Sheet 2: Standard Curve & Params
  const curveData = [];
  curveData.push({ Parametro: 'Kit', Valor: kitName });
  curveData.push({ Parametro: 'Método', Valor: method === 'linear' ? 'Regresión Lineal' : 'Factor de Corrección' });
  curveData.push({ Parametro: 'Dilución de Muestra (Global)', Valor: userInputs.user_sample_dilution });
  curveData.push({ Parametro: 'Tiempo de Reacción (min)', Valor: userInputs.reaction_time });
  
  if (method === 'linear' && curveParams) {
    curveData.push({ Parametro: 'Pendiente (m)', Valor: parseFloat(curveParams.m.toFixed(5)) });
    curveData.push({ Parametro: 'Intersección (b)', Valor: parseFloat(curveParams.b.toFixed(5)) });
    curveData.push({ Parametro: 'R²', Valor: parseFloat(curveParams.r2.toFixed(5)) });
    curveData.push({ Parametro: 'Ecuación', Valor: `y = ${curveParams.m.toFixed(4)}x + ${curveParams.b.toFixed(4)}` });
  } else if (method === 'factor' && factor !== null) {
    curveData.push({ Parametro: 'Factor', Valor: parseFloat(factor.toFixed(5)) });
  }
  
  curveData.push({});
  curveData.push({ Parametro: 'Datos de Calibración', Valor: '' });
  
  // Find standard points
  ROWS.forEach(r => {
    COLS.forEach(c => {
      const k = wellKey(r, c);
      const w = processedWells[k];
      if (w && typeof w.concentration === 'number' && typeof w.value === 'number' && w.groupId === standardGroupId) {
        curveData.push({
          Parametro: `[${k}] ${w.concentration} ${w.concUnit || ''}`,
          Valor: w.value
        });
      }
    });
  });

  const wsCurve = XLSX.utils.json_to_sheet(curveData);
  XLSX.utils.book_append_sheet(wb, wsCurve, "Curva Estándar");

  // Generate binary blob
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: "application/octet-stream" });
}

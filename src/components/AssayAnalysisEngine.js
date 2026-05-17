import { wellKey, ROWS, COLS } from './PlateMapperHelpers';

export const ASSAY_KITS = [
  {
    id: 'cayman_707002',
    name: 'Catalase Assay Kit (Cayman 707002)',
    description: 'Asegúrate de definir tus blancos y concentraciones estándar usando la herramienta de Dilución Seriada antes de analizar.',
    standardCurveSetup: {
      instructions: 'Curva Estándar: Comienza con 75 μM, realiza diluciones de -15 μM por paso (75, 60, 45, 30, 10 μM) y usa 0 μM como Blanco.'
    },
    requiredInputs: [
      { id: 'user_sample_dilution', label: 'Factor de Dilución de Muestra', type: 'number', default: 1 }
    ],
    pipeline: [
      {
        step: 'subtract',
        name: 'Restar Blanco',
        targetTypes: ['standard', 'unknown', 'positive', 'negative'],
        subtractType: 'blank',
        outputVariable: 'corrected_signal'
      },
      {
        step: 'curveFit',
        name: 'Regresión Lineal',
        type: 'linear',
        x: 'concentration',
        y: 'corrected_signal'
      },
      {
        step: 'interpolate',
        name: 'Interpolar Formaldehído (μM)',
        targetTypes: ['unknown', 'positive'],
        outputVariable: 'formaldehyde_uM'
      },
      {
        step: 'multiply',
        name: 'Ajuste de Volumen Reacción',
        targetTypes: ['unknown', 'positive'],
        variable: 'formaldehyde_uM',
        factor: 8.5 // (170μl / 20μl)
      },
      {
        step: 'divide',
        name: 'Tasa (20 min)',
        targetTypes: ['unknown', 'positive'],
        variable: 'formaldehyde_uM',
        divisor: 20,
        outputVariable: 'cat_activity_raw'
      },
      {
        step: 'multiply',
        name: 'Aplicar Dilución de Muestra',
        targetTypes: ['unknown', 'positive'],
        variable: 'cat_activity_raw',
        factorVariable: 'user_sample_dilution',
        outputVariable: 'final_cat_activity_nmol_min_ml'
      }
    ]
  }
];

function linearRegression(pts) {
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
  
  // Calculate R^2
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

export function runAssayAnalysis(kitId, originalWells, groups, userInputs) {
  const kit = ASSAY_KITS.find(k => k.id === kitId);
  if (!kit) throw new Error('Kit no encontrado');

  // Deep clone to hold intermediate results
  const wells = JSON.parse(JSON.stringify(originalWells));
  
  // Helper to find all wells matching specific group types
  const getWellsByType = (types) => {
    const matchGroupIds = new Set(groups.filter(g => types.includes(g.wellType)).map(g => g.id));
    const results = [];
    ROWS.forEach(r => {
      COLS.forEach(c => {
        const k = wellKey(r, c);
        const w = wells[k];
        if (w && matchGroupIds.has(w.groupId)) {
          results.push({ key: k, well: w });
        }
      });
    });
    return results;
  };

  let curveParams = null; // To store {m, b}
  
  kit.pipeline.forEach(action => {
    switch (action.step) {
      case 'subtract': {
        // 1. Calculate average of subtractType (e.g. blanks)
        const subWells = getWellsByType([action.subtractType]).filter(x => typeof x.well.value === 'number');
        if (subWells.length === 0) throw new Error(`Faltan lecturas para el grupo base: ${action.subtractType}`);
        const avgSub = subWells.reduce((sum, w) => sum + w.well.value, 0) / subWells.length;
        
        // 2. Subtract from targetTypes
        const targets = getWellsByType(action.targetTypes);
        targets.forEach(t => {
          if (typeof t.well.value === 'number') {
            t.well[action.outputVariable] = t.well.value - avgSub;
          }
        });
        break;
      }
      
      case 'curveFit': {
        const stds = getWellsByType(['standard']);
        const pts = stds.map(s => {
          const xVal = s.well[action.x]; // e.g. concentration
          const yVal = action.y === 'value' ? s.well.value : s.well[action.y]; // e.g. corrected_signal
          return { x: parseFloat(xVal), y: parseFloat(yVal) };
        }).filter(pt => !isNaN(pt.x) && !isNaN(pt.y));
        
        if (pts.length < 2) throw new Error('Se necesitan al menos 2 pocillos estándar con concentración y lectura válidas para la curva.');
        
        if (action.type === 'linear') {
          curveParams = linearRegression(pts);
        } else {
          throw new Error(`Método de curva ${action.type} no soportado aún.`);
        }
        break;
      }
      
      case 'interpolate': {
        if (!curveParams) throw new Error('No se generó curva previa para interpolar.');
        const targets = getWellsByType(action.targetTypes);
        targets.forEach(t => {
          // By default uses the output of the subtract step as Y. If not present, use raw value.
          const yVal = typeof t.well.corrected_signal === 'number' ? t.well.corrected_signal : t.well.value;
          if (typeof yVal === 'number') {
            // y = mx + b => x = (y - b) / m
            if (curveParams.m === 0) {
              t.well[action.outputVariable] = 0;
            } else {
              t.well[action.outputVariable] = (yVal - curveParams.b) / curveParams.m;
            }
          }
        });
        break;
      }
      
      case 'multiply': {
        const targets = getWellsByType(action.targetTypes);
        targets.forEach(t => {
          const baseVal = t.well[action.variable];
          if (typeof baseVal === 'number') {
            const f = action.factor !== undefined ? action.factor : parseFloat(userInputs[action.factorVariable] || 1);
            t.well[action.outputVariable || action.variable] = baseVal * f;
          }
        });
        break;
      }
      
      case 'divide': {
        const targets = getWellsByType(action.targetTypes);
        targets.forEach(t => {
          const baseVal = t.well[action.variable];
          if (typeof baseVal === 'number') {
            const d = action.divisor !== undefined ? action.divisor : parseFloat(userInputs[action.divisorVariable] || 1);
            if (d !== 0) {
              t.well[action.outputVariable || action.variable] = baseVal / d;
            }
          }
        });
        break;
      }
    }
  });

  return { results: wells, curveParams };
}

export function generateAnalysisCSV(kitId, processedWells, groups, curveParams) {
  const kit = ASSAY_KITS.find(k => k.id === kitId);
  const lines = [`Resultados de Análisis Automático - ${kit?.name || 'Desconocido'}`];
  
  if (curveParams) {
    lines.push(`Ecuacion Curva Estándar:,y = ${curveParams.m.toFixed(4)}x + ${curveParams.b.toFixed(4)},R2 = ${curveParams.r2.toFixed(4)}`);
  }
  lines.push('');
  
  // Headers
  const headers = ['Pocillo', 'Grupo', 'Tipo', 'Replicado', 'Lectura Cruda', 'Lectura Corregida', 'Concentración/Actividad Final'];
  lines.push(headers.join(','));
  
  ROWS.forEach(r => {
    COLS.forEach(c => {
      const k = wellKey(r, c);
      const w = processedWells[k];
      if (w && w.groupId) {
        const g = groups.find(gr => gr.id === w.groupId);
        const type = g ? g.wellType : '';
        const raw = w.value !== null && w.value !== undefined ? w.value : '';
        const corrected = w.corrected_signal !== undefined ? w.corrected_signal.toFixed(4) : '';
        
        // Final value is whichever is the final output of the pipeline (usually the last action's outputVariable)
        const lastAction = kit?.pipeline[kit.pipeline.length - 1];
        let finalVal = '';
        if (lastAction && w[lastAction.outputVariable]) {
            finalVal = w[lastAction.outputVariable].toFixed(4);
        } else if (w.formaldehyde_uM) {
            finalVal = w.formaldehyde_uM.toFixed(4);
        }
        
        lines.push(`${k},"${g?.name || ''}",${type},${w.replicateNum || ''},${raw},${corrected},${finalVal}`);
      }
    });
  });
  
  return lines.join('\n');
}

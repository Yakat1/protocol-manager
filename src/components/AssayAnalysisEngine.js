import * as XLSX from 'xlsx';

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

export function computeAverageAbs(abs1, abs2, abs3) {
  const valid = [abs1, abs2, abs3].map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return sum / valid.length;
}

export function processSpectroSamples(samples, factor, globalDilution = 1, globalTime = 1) {
  return samples.map(s => {
    let conc = null;
    let act = null;

    if (s.value !== null && s.value !== undefined && !isNaN(parseFloat(s.value))) {
      const yVal = parseFloat(s.value);
      if (factor !== null && !isNaN(factor)) {
        conc = yVal * factor;
      }

      if (conc !== null) {
        const d = parseFloat(s.dilution) || parseFloat(globalDilution);
        const t = parseFloat(s.time) || parseFloat(globalTime);
        act = (conc * d) / t;
      }
    }
    
    return { ...s, calculated_concentration: conc, final_activity: act };
  });
}

export function generateSpectroXLSX(protocolName, curvesData, samples, finalFactor, globalDilution, globalTime) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Results
  const resultsData = samples.map(s => ({
    Muestra: s.name || '',
    'Lectura (Abs)': s.value,
    'Dilución': s.dilution || globalDilution,
    'Tiempo (min)': s.time || globalTime,
    'Concentración Calculada': s.calculated_concentration !== null ? parseFloat(s.calculated_concentration.toFixed(4)) : '',
    'Actividad Final': s.final_activity !== null ? parseFloat(s.final_activity.toFixed(4)) : ''
  }));
  const wsResults = XLSX.utils.json_to_sheet(resultsData);
  XLSX.utils.book_append_sheet(wb, wsResults, "Resultados Muestras");

  // Sheet 2: Calibration Curves
  const sheetData = [];
  sheetData.push({ Col1: 'Protocolo:', Col2: protocolName });
  sheetData.push({ Col1: 'Factor Final Promedio:', Col2: finalFactor !== null ? parseFloat(finalFactor.toFixed(5)) : '' });
  sheetData.push({});
  
  curvesData.forEach(curve => {
    sheetData.push({ Col1: `=== ${curve.name.toUpperCase()} ===`, Col2: '' });
    
    // Math Results
    if (curve.results) {
      sheetData.push({ Col1: 'Pendiente (m)', Col2: curve.results.m !== null ? parseFloat(curve.results.m.toFixed(5)) : '' });
      sheetData.push({ Col1: 'Intersección (b)', Col2: curve.results.b !== null ? parseFloat(curve.results.b.toFixed(5)) : '' });
      sheetData.push({ Col1: 'R²', Col2: curve.results.r2 !== null ? parseFloat(curve.results.r2.toFixed(5)) : '' });
      sheetData.push({ Col1: 'Factor (Curva)', Col2: curve.results.factor !== null ? parseFloat(curve.results.factor.toFixed(5)) : '' });
    }
    sheetData.push({});
    
    // Table Headers
    sheetData.push({
      Col1: 'Concentración',
      Col2: 'Abs 1',
      Col3: 'Abs 2',
      Col4: 'Abs 3',
      Col5: 'Abs Promedio'
    });
    
    // Points
    curve.points.forEach(p => {
      if (p.concentration !== '' && p.concentration !== null) {
        sheetData.push({
          Col1: p.concentration,
          Col2: p.abs1,
          Col3: p.abs2,
          Col4: p.abs3,
          Col5: p.absPromedio !== null ? p.absPromedio : ''
        });
      }
    });
    
    sheetData.push({});
    sheetData.push({});
  });

  const wsCurve = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true });
  XLSX.utils.book_append_sheet(wb, wsCurve, "Curvas de Calibración");

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: "application/octet-stream" });
}

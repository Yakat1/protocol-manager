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

export function processSpectroSamples(samples, method, curveParams, factor, globalDilution = 1, globalTime = 1) {
  return samples.map(s => {
    let conc = null;
    let act = null;

    if (s.value !== null && s.value !== undefined && !isNaN(parseFloat(s.value))) {
      const yVal = parseFloat(s.value);
      if (method === 'linear' && curveParams && curveParams.m !== 0) {
        conc = (yVal - curveParams.b) / curveParams.m;
      } else if (method === 'factor' && factor !== null) {
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

export function generateSpectroXLSX(samples, standards, method, curveParams, factor, globalDilution, globalTime) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Results
  const resultsData = samples.map(s => ({
    Muestra: s.name || '',
    'Lectura (Abs)': s.value,
    'Dilución': s.dilution || globalDilution,
    'Tiempo (min)': s.time || globalTime,
    'Concentración Interpolada': s.calculated_concentration !== null ? parseFloat(s.calculated_concentration.toFixed(4)) : '',
    'Actividad Final': s.final_activity !== null ? parseFloat(s.final_activity.toFixed(4)) : ''
  }));
  const wsResults = XLSX.utils.json_to_sheet(resultsData);
  XLSX.utils.book_append_sheet(wb, wsResults, "Resultados");

  // Sheet 2: Standard Curve & Params
  const curveData = [];
  curveData.push({ Parametro: 'Método', Valor: method === 'linear' ? 'Regresión Lineal' : 'Factor de Corrección' });
  curveData.push({ Parametro: 'Dilución Global', Valor: globalDilution });
  curveData.push({ Parametro: 'Tiempo Global (min)', Valor: globalTime });
  
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
  
  standards.forEach(std => {
    if (std.concentration !== null && std.value !== null) {
      curveData.push({
        Parametro: `${std.concentration} μM`,
        Valor: std.value
      });
    }
  });

  const wsCurve = XLSX.utils.json_to_sheet(curveData);
  XLSX.utils.book_append_sheet(wb, wsCurve, "Curva Estándar");

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: "application/octet-stream" });
}

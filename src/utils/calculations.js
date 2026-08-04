// ── Conversion factor tables (ported from lab/calculations.py) ──────────────
export const MASS_FACTORS = { kg: 1e3, g: 1, mg: 1e-3, 'µg': 1e-6, ng: 1e-9 };
export const VOLUME_FACTORS = { L: 1, mL: 1e-3, 'µL': 1e-6 };
export const CONC_FACTORS = { M: 1, mM: 1e-3, 'µM': 1e-6, nM: 1e-9 };

export const UNIT_GROUPS = {
  mass:   { label: 'Masa',          units: Object.keys(MASS_FACTORS),   factors: MASS_FACTORS },
  volume: { label: 'Volumen',       units: Object.keys(VOLUME_FACTORS), factors: VOLUME_FACTORS },
  conc:   { label: 'Concentración', units: Object.keys(CONC_FACTORS),   factors: CONC_FACTORS },
};

export function parseCalcFloat(valString) {
  if (valString === null || valString === undefined) return NaN;
  if (typeof valString !== 'string') valString = String(valString);
  valString = valString.trim();
  if (valString === '') return NaN;

  if (valString.toLowerCase().includes('e')) {
    const parts = valString.toLowerCase().split('e');
    if (parts.length === 2) {
      const base = Number.parseFloat(parts[0]);
      const exponent = Number.parseFloat(parts[1]);
      if (!isNaN(base) && !isNaN(exponent)) {
        return base * Math.pow(10, exponent);
      }
    }
  }

  return Number.parseFloat(valString);
}

export function convertUnit(value, from, to, factors) {
  if (!value || !from || !to || !factors[from] || !factors[to]) return null;
  const base = parseCalcFloat(value) * factors[from];
  return base / factors[to];
}

export function formatSmart(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (val === 0) return '0';
  if (Math.abs(val) >= 1000) return val.toFixed(2);
  if (Math.abs(val) >= 1) return val.toFixed(4);
  if (Math.abs(val) >= 0.001) return val.toFixed(6);
  return val.toExponential(4);
}

// Format concentration for serial dilutions
// Detects clean half-log powers of 10 and shows e.g. "1e-4.5" instead of "3.16e-5"
export function formatConcentration(val) {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '0';
  if (val >= 1) return val.toFixed(2);

  const log10 = Math.log10(val);
  // Check resolution of 0.5 (half-log steps)
  const rounded = Math.round(log10 * 2) / 2; // round to nearest 0.5
  const reconstructed = Math.pow(10, rounded);
  const relError = Math.abs(reconstructed - val) / val;

  if (relError < 0.005) { // within 0.5% = clean power
    return `1e${rounded}`;
  }

  return val.toExponential(2);
}

// Format a mass (in grams) into the most readable unit
export function formatMassResult(massG) {
  if (massG >= 1)       return { val: massG.toFixed(4),          unit: 'g' };
  if (massG >= 1e-3)    return { val: (massG * 1e3).toFixed(4),  unit: 'mg' };
  if (massG >= 1e-6)    return { val: (massG * 1e6).toFixed(4),  unit: 'µg' };
  return                       { val: (massG * 1e9).toFixed(4),  unit: 'ng' };
}
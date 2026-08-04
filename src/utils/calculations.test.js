import { describe, it, expect } from 'vitest';
import {
  MASS_FACTORS,
  VOLUME_FACTORS,
  CONC_FACTORS,
  parseCalcFloat,
  convertUnit,
  formatSmart,
  formatConcentration,
  formatMassResult,
} from './calculations';

describe('parseCalcFloat', () => {
  it('parses plain decimals', () => {
    expect(parseCalcFloat('150')).toBe(150);
    expect(parseCalcFloat('3.14')).toBe(3.14);
  });

  it('trims surrounding whitespace', () => {
    expect(parseCalcFloat('  45 ')).toBe(45);
  });

  it('returns NaN for empty strings', () => {
    expect(parseCalcFloat('')).toBeNaN();
  });

  it('returns NaN for null/undefined', () => {
    expect(parseCalcFloat(null)).toBeNaN();
    expect(parseCalcFloat(undefined)).toBeNaN();
  });

  it('supports scientific notation', () => {
    expect(parseCalcFloat('1e3')).toBe(1000);
    expect(parseCalcFloat('1.5e-3')).toBe(0.0015);
  });

  it('returns NaN for non-numeric input', () => {
    expect(parseCalcFloat('abc')).toBeNaN();
  });
});

describe('convertUnit', () => {
  it('converts within a unit group', () => {
    expect(convertUnit('1', 'g', 'mg', MASS_FACTORS)).toBe(1000);
    expect(convertUnit('500', 'mL', 'L', VOLUME_FACTORS)).toBe(0.5);
    expect(convertUnit('2', 'M', 'mM', CONC_FACTORS)).toBe(2000);
  });

  it('returns null for unknown units', () => {
    expect(convertUnit('1', 'g', 'parsec', MASS_FACTORS)).toBeNull();
    expect(convertUnit('1', 'g', 'mg', {})).toBeNull();
  });

  it('returns null when the value is falsy', () => {
    expect(convertUnit('', 'g', 'mg', MASS_FACTORS)).toBeNull();
  });

  it('returns NaN for a non-numeric value', () => {
    expect(convertUnit('abc', 'g', 'mg', MASS_FACTORS)).toBeNaN();
  });
});

describe('formatSmart', () => {
  it('renders placeholders for null/NaN', () => {
    expect(formatSmart(null)).toBe('—');
    expect(formatSmart(NaN)).toBe('—');
  });

  it('renders zero as "0"', () => {
    expect(formatSmart(0)).toBe('0');
  });

  it('uses 2 decimals for values >= 1000', () => {
    expect(formatSmart(1234.567)).toBe('1234.57');
  });

  it('uses 4 decimals for values >= 1', () => {
    expect(formatSmart(3.14159)).toBe('3.1416');
  });

  it('uses 6 decimals for values >= 0.001', () => {
    expect(formatSmart(0.005)).toBe('0.005000');
  });

  it('falls back to exponential for very small values', () => {
    expect(formatSmart(0.0005)).toBe('5.0000e-4');
  });
});

describe('formatConcentration', () => {
  it('renders zero as "0"', () => {
    expect(formatConcentration(0)).toBe('0');
  });

  it('renders values >= 1 with 2 decimals', () => {
    expect(formatConcentration(2)).toBe('2.00');
  });

  it('detects clean half-log powers of ten', () => {
    expect(formatConcentration(0.0001)).toBe('1e-4');
    expect(formatConcentration(3.1622776601683795e-5)).toBe('1e-4.5');
  });

  it('uses exponential notation for non-clean values', () => {
    expect(formatConcentration(0.00005)).toBe('5.00e-5');
  });
});

describe('formatMassResult', () => {
  it('selects grams for masses >= 1 g', () => {
    expect(formatMassResult(2)).toEqual({ val: '2.0000', unit: 'g' });
  });

  it('selects milligrams for 1e-3 <= mass < 1', () => {
    expect(formatMassResult(0.5)).toEqual({ val: '500.0000', unit: 'mg' });
  });

  it('selects micrograms for 1e-6 <= mass < 1e-3', () => {
    expect(formatMassResult(5e-5)).toEqual({ val: '50.0000', unit: 'µg' });
  });

  it('selects nanograms below 1e-6', () => {
    expect(formatMassResult(1e-8)).toEqual({ val: '10.0000', unit: 'ng' });
  });
});
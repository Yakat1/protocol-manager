import { describe, it, expect } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('formats zero as 00:00:00', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('clamps negative durations to zero', () => {
    expect(formatDuration(-5000)).toBe('00:00:00');
  });

  it('formats seconds and minutes with padding', () => {
    expect(formatDuration(65_000)).toBe('00:01:05');
    expect(formatDuration(3_600_000)).toBe('01:00:00');
  });

  it('formats hours beyond 24 without wrapping', () => {
    expect(formatDuration(90_061_000)).toBe('25:01:01');
  });

  it('truncates fractional milliseconds', () => {
    expect(formatDuration(1_500)).toBe('00:00:01');
  });
});
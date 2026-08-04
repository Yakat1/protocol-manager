import { describe, it, expect } from 'vitest';
import { RECURRENCE_TYPES, matchesRecurrence, projectRecurrence } from './recurrence';

const midnight = (y, m, d) => new Date(y, m, d);

describe('matchesRecurrence', () => {
  const start = midnight(2026, 0, 5); // Monday, Jan 5 2026

  it('matches daily after start date', () => {
    expect(matchesRecurrence(midnight(2026, 0, 6), start, 'daily')).toBe(true);
    expect(matchesRecurrence(start, start, 'daily')).toBe(true);
  });

  it('matches every_2_days only on even offsets', () => {
    expect(matchesRecurrence(midnight(2026, 0, 7), start, 'every_2_days')).toBe(true);
    expect(matchesRecurrence(midnight(2026, 0, 8), start, 'every_2_days')).toBe(false);
  });

  it('matches weekly on the same weekday only', () => {
    expect(matchesRecurrence(midnight(2026, 0, 12), start, 'weekly')).toBe(true); // next Monday
    expect(matchesRecurrence(midnight(2026, 0, 6), start, 'weekly')).toBe(false); // Tuesday
  });

  it('matches weekdays Mon-Fri and excludes weekends', () => {
    expect(matchesRecurrence(midnight(2026, 0, 6), start, 'weekdays')).toBe(true); // Tue
    expect(matchesRecurrence(midnight(2026, 0, 10), start, 'weekdays')).toBe(false); // Sat
    expect(matchesRecurrence(midnight(2026, 0, 11), start, 'weekdays')).toBe(false); // Sun
  });

  it('rejects unknown patterns', () => {
    expect(matchesRecurrence(start, start, 'monthly')).toBe(false);
  });
});

describe('projectRecurrence', () => {
  it('projects daily dates for the window', () => {
    const dates = projectRecurrence('2026-01-05', 'daily', 5);
    expect(dates).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']);
  });

  it('projects weekdays only', () => {
    // Jan 5 2026 is a Monday; 7-day window → Mon-Fri only
    const dates = projectRecurrence('2026-01-05', 'weekdays', 7);
    expect(dates).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']);
  });

  it('projects every_3_days', () => {
    const dates = projectRecurrence('2026-01-05', 'every_3_days', 8);
    expect(dates).toEqual(['2026-01-05', '2026-01-08', '2026-01-11']);
  });

  it('defaults to a 60-day window', () => {
    const dates = projectRecurrence('2026-01-05', 'daily');
    expect(dates).toHaveLength(60);
  });

  it('lists the supported recurrence types', () => {
    expect(RECURRENCE_TYPES).toEqual(['daily', 'every_2_days', 'every_3_days', 'weekly', 'weekdays']);
  });
});
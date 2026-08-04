// ─── Recurrence rules ─────────────────────────────────────────────────────────
// Single implementation of the recurrence projection logic previously
// duplicated in Dashboard and Scheduler.

export const RECURRENCE_TYPES = ['daily', 'every_2_days', 'every_3_days', 'weekly', 'weekdays'];

// Does `date` (a Date normalized to local midnight) match a rule that started
// on `startDate` (also normalized to local midnight)?
export function matchesRecurrence(date, startDate, pattern) {
  const diff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
  switch (pattern) {
    case 'daily':
      return true;
    case 'every_2_days':
      return diff % 2 === 0;
    case 'every_3_days':
      return diff % 3 === 0;
    case 'weekly':
      return date.getDay() === startDate.getDay();
    case 'weekdays':
      return date.getDay() >= 1 && date.getDay() <= 5;
    default:
      return false;
  }
}

// Project the ISO dates (YYYY-MM-DD) matching a rule for the first `windowDays`
// days starting at `startDate` (inclusive).
export function projectRecurrence(startDate, recurrenceType, windowDays = 60) {
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day); // local midnight, timezone-independent
  start.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (matchesRecurrence(d, start, recurrenceType)) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  return dates;
}

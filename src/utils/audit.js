import { writeAuditEntry } from './firebase';

// Shared audit-log helper. No-ops when there is no lab or user (matches the
// guards each component previously duplicated); errors are swallowed.
export const audit = (labId, user, action, target, details = {}) => {
  if (!labId || !user) return Promise.resolve();
  return writeAuditEntry(labId, {
    userId: user.uid,
    displayName: user.displayName || user.email,
    action,
    target,
    details,
  }).catch(err => console.error('Audit write failed:', err));
};

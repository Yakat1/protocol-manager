import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audit } from './audit';
import { writeAuditEntry } from './firebase';

vi.mock('./firebase', () => ({
  writeAuditEntry: vi.fn(),
}));

describe('audit', () => {
  const user = { uid: 'u1', displayName: 'Lab User', email: 'lab@example.com' };
  const details = { quantity: 3 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes an audit entry with the user and action', async () => {
    writeAuditEntry.mockResolvedValue();
    await audit('lab1', user, 'inventory.update', 'inv-42', details);
    expect(writeAuditEntry).toHaveBeenCalledTimes(1);
    expect(writeAuditEntry).toHaveBeenCalledWith('lab1', {
      userId: 'u1',
      displayName: 'Lab User',
      action: 'inventory.update',
      target: 'inv-42',
      details,
    });
  });

  it('falls back to email when displayName is missing', async () => {
    writeAuditEntry.mockResolvedValue();
    await audit('lab1', { uid: 'u1', email: 'a@b.com' }, 'x', 'y');
    expect(writeAuditEntry).toHaveBeenCalledWith(
      'lab1',
      expect.objectContaining({ displayName: 'a@b.com' })
    );
  });

  it('no-ops without a labId', async () => {
    await audit(null, user, 'x', 'y');
    expect(writeAuditEntry).not.toHaveBeenCalled();
  });

  it('no-ops without a user', async () => {
    await audit('lab1', null, 'x', 'y');
    expect(writeAuditEntry).not.toHaveBeenCalled();
  });

  it('swallows write failures', async () => {
    writeAuditEntry.mockRejectedValue(new Error('firebase down'));
    await expect(audit('lab1', user, 'x', 'y')).resolves.toBeUndefined();
  });
});
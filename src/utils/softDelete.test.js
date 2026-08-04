import { describe, it, expect } from 'vitest';
import { softDelete } from './softDelete';

describe('softDelete', () => {
  const list = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ];
  const user = { email: 'lab@example.com' };

  it('marks only the matching item as deleted', () => {
    const result = softDelete(list, 'b', user);
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({ id: 'b', name: 'Beta' });
    expect(result[1].deletedAt).toBeDefined();
    expect(result[1].deletedBy).toBe('lab@example.com');
    expect(result[0].deletedAt).toBeUndefined();
    expect(result[2].deletedAt).toBeUndefined();
  });

  it('records an ISO timestamp for deletedAt', () => {
    const [item] = softDelete(list, 'a', user);
    expect(new Date(item.deletedAt).toISOString()).toBe(item.deletedAt);
  });

  it('uses "system" as the actor when no user is provided', () => {
    const result = softDelete(list, 'c', null);
    expect(result[2].deletedBy).toBe('system');
  });

  it('defaults to an empty list', () => {
    expect(softDelete()).toEqual([]);
  });

  it('returns the list unchanged when the id is not found', () => {
    const result = softDelete(list, 'nope', user);
    expect(result).toEqual(list);
  });
});
import { describe, it, expect } from 'vitest';
import { labStateReducer } from '../utils/labStateReducer';

describe('labStateReducer', () => {
  it('replaces the state on SET', () => {
    const next = labStateReducer({ inventory: [] }, { type: 'SET', payload: { inventory: [{ id: '1' }] } });
    expect(next).toEqual({ inventory: [{ id: '1' }] });
  });

  it('applies the updater on FUNC', () => {
    const next = labStateReducer(
      { inventory: [{ id: '1', quantity: 5 }] },
      { type: 'FUNC', updater: (s) => ({ ...s, inventory: [{ id: '1', quantity: 3 }] }) }
    );
    expect(next.inventory[0].quantity).toBe(3);
  });

  it('returns the previous state for unknown action types', () => {
    const prev = { inventory: [] };
    expect(labStateReducer(prev, { type: 'BOGUS' })).toBe(prev);
  });

  it('handles SET replacing an undefined initial state', () => {
    const next = labStateReducer(null, { type: 'SET', payload: { inventory: [] } });
    expect(next).toEqual({ inventory: [] });
  });
});
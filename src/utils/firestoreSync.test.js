import { describe, it, expect } from 'vitest';
import {
  STATE_SLICES,
  splitState,
  assembleState,
  sliceCounts,
  diffSlices,
  describeDeltas,
} from './firestoreSync';

describe('firestoreSync: splitState', () => {
  it('parts a full state into slice values', () => {
    const state = { subjects: [{ id: 'a' }], inventory: [{ id: 'i1' }], protocolName: 'P' };
    const slices = splitState(state);
    // subjects se despojan de imágenes (map añade images: [])
    expect(slices.subjects).toEqual([{ id: 'a', images: [] }]);
    expect(slices.inventory).toEqual([{ id: 'i1' }]);
    expect(slices.protocolName).toBe('P');
  });

  it('strips images from subjects and cultureLogs (local-only)', () => {
    const state = {
      subjects: [{ id: 'a', images: ['data:img1'] }],
      cultureLogs: [{ id: 'l', images: ['data:img2'] }],
      inventory: [{ id: 'i', images: ['data:keep'] }],
    };
    const slices = splitState(state);
    expect(slices.subjects[0].images).toEqual([]);
    expect(slices.cultureLogs[0].images).toEqual([]);
    // No slice que no las lleve se toca: inventory conserva sus images
    expect(slices.inventory[0].images).toEqual(['data:keep']);
  });

  it('ignores unknown top-level keys', () => {
    const slices = splitState({ somethingElse: 1, subjects: [] });
    expect(slices.somethingElse).toBeUndefined();
  });
});

describe('firestoreSync: assembleState', () => {
  it('fills defaults for missing slices', () => {
    const state = assembleState({ subjects: [{ id: 'a' }] });
    expect(state.subjects).toEqual([{ id: 'a' }]);
    expect(state.inventory).toEqual([]);
    expect(state.cultureLogs).toEqual([]);
    expect(state.settings).toEqual({ theme: 'dark' });
    expect(state.protocolName).toBe('Nuevo Experimento');
  });

  it('round-trips through split + assemble', () => {
    const original = {
      protocolName: 'Experimento X',
      subjects: [{ id: 'a', images: ['x'] }],
      inventory: [{ id: 'i' }],
      bufferRecipes: [{ id: 'b' }],
    };
    const reassembled = assembleState(splitState(original));
    expect(reassembled.subjects).toEqual([{ id: 'a', images: [] }]);
    expect(reassembled.inventory).toEqual([{ id: 'i' }]);
    expect(reassembled.bufferRecipes).toEqual([{ id: 'b' }]);
    expect(reassembled.protocolName).toBe('Experimento X');
  });
});

describe('firestoreSync: counts & diffs', () => {
  it('counts arrays and object keys', () => {
    const counts = sliceCounts({ inventory: [{}, {}], settings: { a: 1, b: 2 }, subjects: [] });
    expect(counts.inventory).toBe(2);
    expect(counts.settings).toBe(2);
    expect(counts.subjects).toBe(0);
  });

  it('detects changed slices between two states', () => {
    const a = assembleState({ inventory: [{ id: '1' }] });
    const b = assembleState({ inventory: [{ id: '1' }, { id: '2' }] });
    const changed = diffSlices(a, b);
    expect(changed).toContain('inventory');
    expect(changed).not.toContain('subjects');
  });

  it('describes deltas with readable before/after counts', () => {
    const from = assembleState({ inventory: [{ id: '1' }] });
    const to = assembleState({ inventory: [{ id: '1' }, { id: '2' }] });
    const deltas = describeDeltas(from, to);
    const inv = deltas.find((d) => d.slice === 'inventory');
    expect(inv.from).toBe(1);
    expect(inv.to).toBe(2);
  });

  it('covers every known slice', () => {
    expect(STATE_SLICES.length).toBeGreaterThanOrEqual(10);
    expect(STATE_SLICES).toContain('subjects');
    expect(STATE_SLICES).toContain('spectroProtocols');
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

const state = { hand: Array.from({ length: 14 }, (_, i) => ({ id: `t${i}` })), selectedId: null, lastDrawnId: undefined, canDiscard: false, actions: [] };

test('tile shortcuts and arrow navigation preserve existing selection rules', async () => {
  const { resolveTableKey } = await import('../src/table/tableInteraction.ts');
  for (const [key, index] of [['1', 0], ['9', 8], ['0', 9], ['-', 10], ['=', 11]] as const) {
    assert.deepEqual(resolveTableKey(key, state), { kind: 'select', tileId: `t${index}` });
  }
  assert.deepEqual(resolveTableKey('9', { ...state, hand: state.hand.slice(0, 2) }), { kind: 'ignored' });
  assert.deepEqual(resolveTableKey('ArrowLeft', state), { kind: 'select', tileId: 't13' });
  assert.deepEqual(resolveTableKey('ArrowLeft', { ...state, lastDrawnId: 't5' }), { kind: 'select', tileId: 't5' });
  assert.deepEqual(resolveTableKey('ArrowLeft', { ...state, lastDrawnId: 'missing' }), { kind: 'handled' });
  assert.deepEqual(resolveTableKey('ArrowLeft', { ...state, selectedId: 't0' }), { kind: 'select', tileId: 't13' });
  assert.deepEqual(resolveTableKey('ArrowRight', { ...state, selectedId: 't13' }), { kind: 'select', tileId: 't0' });
  assert.deepEqual(resolveTableKey('ArrowRight', { ...state, selectedId: 'missing' }), { kind: 'select', tileId: 't0' });
  assert.deepEqual(resolveTableKey('ArrowLeft', { ...state, hand: [] }), { kind: 'handled' });
  assert.deepEqual(resolveTableKey('ArrowRight', state), { kind: 'select', tileId: 't0' });
});

test('Escape deselects before passing and confirm refuses ambiguous claims', async () => {
  const { resolveTableKey } = await import('../src/table/tableInteraction.ts');
  const pass = { kind: 'pass' as const };
  const peng = { kind: 'peng' as const };
  const hu = { kind: 'hu' as const };
  assert.deepEqual(resolveTableKey('Escape', { ...state, selectedId: 't0', actions: [pass] }), { kind: 'select', tileId: null });
  assert.deepEqual(resolveTableKey('Escape', { ...state, actions: [pass] }), { kind: 'action', action: pass });
  assert.deepEqual(resolveTableKey('Escape', state), { kind: 'handled' });
  assert.deepEqual(resolveTableKey('Enter', { ...state, actions: [pass, peng] }), { kind: 'action', action: peng });
  assert.deepEqual(resolveTableKey('Enter', { ...state, actions: [peng, { kind: 'chi' }] }), { kind: 'handled' });
  assert.deepEqual(resolveTableKey('Enter', { ...state, actions: [peng, hu] }), { kind: 'action', action: hu });
  assert.deepEqual(resolveTableKey('x', state), { kind: 'ignored' });
});

test('selection cleanup, discard validation and close-gate payload preserve authoritative tile IDs', async () => {
  const { retainHandSelection, resolveDiscard, resolveTableAction } = await import('../src/table/tableInteraction.ts');
  assert.equal(retainHandSelection(state.hand, 'missing'), null);
  assert.equal(retainHandSelection(state.hand, 't1'), 't1');
  assert.equal(resolveDiscard(state.hand, 't1', false), null);
  assert.equal(resolveDiscard(state.hand, 'missing', true), null);
  assert.deepEqual(resolveDiscard(state.hand, 't1', true), { kind: 'discard', tileId: 't1' });
  const gate = { kind: 'close-gate' as const, tileIds: ['t1', 't2'], key: 'gate' };
  assert.deepEqual(resolveTableAction(gate, 't2'), { kind: 'close-gate', tileId: 't2', tileIds: gate.tileIds, key: 'gate' });
  assert.equal(resolveTableAction(gate, 'missing').tileId, 't1');
  assert.equal(resolveTableAction({ ...gate, tileId: 'explicit' }, 't2').tileId, 'explicit');
  assert.equal(resolveTableAction({ kind: 'close-gate' }, null).tileId, undefined);
  assert.deepEqual(resolveTableAction({ kind: 'chi', tileIds: ['t1', 't2'], key: 'chi' }, 't3'), { kind: 'chi', tileId: undefined, tileIds: ['t1', 't2'], key: 'chi' });
});

test('confirm while discard is available never falls through to a claim', async () => {
  const { resolveTableKey } = await import('../src/table/tableInteraction.ts');
  const state = { hand: [{ id: 'a' }], selectedId: null, lastDrawnId: undefined, canDiscard: true, actions: [{ kind: 'discard' as const }, { kind: 'hu' as const }] };
  assert.deepEqual(resolveTableKey(' ', state), { kind: 'handled' });
  assert.deepEqual(resolveTableKey('Enter', { ...state, selectedId: 'a' }), { kind: 'discard', tileId: 'a' });
});

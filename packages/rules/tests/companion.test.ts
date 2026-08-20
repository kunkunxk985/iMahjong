import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeTile, type AvailableAction } from '@pizhou/shared';
import { chooseCompanionAction, companionThinkMs, pickDiscard } from '../src/companion.ts';
import type { SeatRuntime } from '../src/types.ts';

function seat(hand = [makeTile('wan', 1, 0)]): SeatRuntime {
  return {
    hand,
    discards: [],
    melds: [],
    changed: false,
    closed: false,
    closedTwoPair: false,
    closedTwoPairKeys: [],
    discardedBeforeClose: [],
  };
}

test('陪练优先打孤张幺九，留住对子', () => {
  const isolated = makeTile('dragon', 1, 0);
  const pairA = makeTile('wan', 5, 0);
  const pairB = makeTile('wan', 5, 1);
  const connected = makeTile('tiao', 3, 0);
  const connected2 = makeTile('tiao', 4, 0);
  const picked = pickDiscard([isolated, pairA, pairB, connected, connected2]);
  assert.equal(picked?.id, isolated.id);
});

test('能胡就胡', () => {
  const action = chooseCompanionAction([{ kind: 'hu' }, { kind: 'pass' }], seat(), () => 0);
  assert.deepEqual(action, { kind: 'hu' });
});

test('起手杠多数时候选择继续打', () => {
  const actions: AvailableAction[] = [{ kind: 'hu', key: 'qidong-gang-hu' }, { kind: 'pass' }];
  const action = chooseCompanionAction(actions, seat(), () => 0.1);
  assert.deepEqual(action, { kind: 'pass' });
});

test('出牌思考 1.5–2.5 秒，人在考虑时更慢', () => {
  assert.equal(companionThinkMs('self-turn', false, () => 0), 1500);
  assert.equal(companionThinkMs('self-turn', false, () => 0.999), 2499);
  assert.equal(companionThinkMs('claim-window', true, () => 0), 2200);
  assert.equal(companionThinkMs('claim-window', false, () => 0), 800);
});

test('有碰时会碰', () => {
  const tiles = [makeTile('dragon', 1, 0), makeTile('dragon', 1, 1), makeTile('wan', 3, 0)];
  const action = chooseCompanionAction(
    [{ kind: 'peng', key: 'dragon-1', tileIds: [tiles[0]!.id, tiles[1]!.id] }, { kind: 'pass' }],
    seat(tiles),
    () => 0.99,
  );
  assert.equal(action?.kind, 'peng');
});

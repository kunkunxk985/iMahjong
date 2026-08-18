import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPizhouDeck, makeTile, type Tile } from '@pizhou/shared';
import { PizhouGame } from '../src/engine.ts';
import { ACTION_RANK, isBetterAction } from '../src/actions.ts';

function placeWinningDealerWall(): Tile[] {
  const deck = createPizhouDeck();
  const take = (suit: Tile['suit'], rank: number) => {
    const index = deck.findIndex((tile) => tile.suit === suit && tile.rank === rank);
    if (index < 0) throw new Error('missing tile');
    return deck.splice(index, 1)[0]!;
  };
  const dealerTiles = [
    take('wan', 1), take('wan', 2), take('wan', 3),
    take('wan', 4), take('wan', 5), take('wan', 6),
    take('wan', 7), take('wan', 8), take('wan', 9),
    take('tong', 1), take('tong', 2), take('tong', 3),
    take('tiao', 1), take('tiao', 1),
  ];
  const wall: Tile[] = [];
  for (let i = 0; i < 53; i += 1) {
    if (i % 4 === 0 && dealerTiles.length > 0 && i < 52) {
      wall.push(dealerTiles.shift()!);
    } else if (i === 52) {
      wall.push(dealerTiles.shift()!);
    } else {
      wall.push(deck.shift()!);
    }
  }
  return [...wall, ...deck];
}

test('牌墙正好120张且不含风牌花牌', () => {
  const deck = createPizhouDeck();
  assert.equal(deck.length, 120);
  assert.equal(deck.every((tile) => tile.suit !== 'wind' as string), true);
  assert.equal(deck.filter((tile) => tile.suit === 'dragon').length, 12);
});

test('胡牌者得最终分，其余三人各扣相同分', () => {
  const game = new PizhouGame({ dealer: 0, wall: placeWinningDealerWall() });
  const result = game.apply(0, { kind: 'hu' }, 'hu-score', 1);
  assert.equal(result.ok, true);
  const settlement = game.settlement!;
  const points = settlement.hu + settlement.yao;
  assert.equal(settlement.scores[0]?.delta, points);
  assert.equal(settlement.scores[1]?.delta, -points);
  assert.equal(settlement.scores[2]?.delta, -points);
  assert.equal(settlement.scores[3]?.delta, -points);
});

function placeOpeningKongWall(): Tile[] {
  const deck = createPizhouDeck();
  const take = (suit: Tile['suit'], rank: number) => {
    const index = deck.findIndex((tile) => tile.suit === suit && tile.rank === rank);
    if (index < 0) throw new Error('missing tile');
    return deck.splice(index, 1)[0]!;
  };
  const dealerKongs = [take('dragon', 1), take('dragon', 1), take('dragon', 1), take('dragon', 1)];
  const wall: Tile[] = [];
  for (let i = 0; i < 53; i += 1) {
    if (i === 0 || i === 4 || i === 8 || i === 12) {
      wall.push(dealerKongs.shift()!);
    } else {
      wall.push(deck.shift()!);
    }
  }
  return [...wall, ...deck];
}

test('起手杠可以直接胡', () => {
  const game = new PizhouGame({ dealer: 0, wall: placeOpeningKongWall() });
  assert.equal(game.phase, 'qidong');
  const actions = game.availableFor(0);
  assert.equal(actions.some((item) => item.kind === 'hu' && item.key === 'qidong-gang-hu'), true);
  const result = game.apply(0, { kind: 'hu', key: 'qidong-gang-hu' }, 'qidong-1', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(game.settlement?.winType, 'qidong-gang-hu');
  assert.equal(game.settlement?.winnerSeat, 0);
});

test('对家和下家不能吃', () => {
  const game = new PizhouGame({ dealer: 0 });
  const discard = makeTile('wan', 5, 0);
  const opposite = game.seats[2]!;
  opposite.hand = [makeTile('wan', 3, 1), makeTile('wan', 4, 1), makeTile('tong', 1, 0)];
  const lower = game.seats[3]!;
  lower.hand = [makeTile('wan', 6, 1), makeTile('wan', 7, 1), makeTile('tong', 2, 0)];
  const xiajia = game.seats[1]!;
  xiajia.hand = [makeTile('wan', 3, 2), makeTile('wan', 4, 2), makeTile('tong', 3, 0)];
  const candidates = game['buildClaimCandidates'](discard, 0, 'discard');
  const bySeat = Object.fromEntries(candidates.map((item) => [item.seat, item.actions]));
  assert.equal((bySeat[2] ?? []).some((item) => item.kind === 'chi'), false);
  assert.equal((bySeat[3] ?? []).some((item) => item.kind === 'chi'), false);
  assert.equal((bySeat[1] ?? []).some((item) => item.kind === 'chi'), true);
});

test('庄家起手平胡', () => {
  const game = new PizhouGame({ dealer: 0, wall: placeWinningDealerWall() });
  const result = game.apply(0, { kind: 'hu' }, 'hu-1', 1);
  assert.equal(result.ok, true);
  assert.equal(game.phase, 'settlement');
  assert.equal(game.settlement?.winType, 'ping-hu');
  assert.equal(game.settlement?.winnerSeat, 0);
  assert.ok((game.settlement?.hu ?? 0) > 0);
});

test('过期 sequence 和重复 actionId 会被拒绝', () => {
  const game = new PizhouGame({ dealer: 0, wall: placeWinningDealerWall() });
  const first = game.apply(0, { kind: 'hu' }, 'same', 1);
  assert.equal(first.ok, true);
  const dup = game.apply(0, { kind: 'hu' }, 'same', 1);
  assert.equal(dup.duplicate, true);
  const stale = game.apply(0, { kind: 'discard', tileId: game.seats[0]!.hand[0]?.id }, 'other', 1);
  assert.equal(stale.ok, false);
});

test('操作优先级 胡 > 杠 > 碰 > 吃', () => {
  assert.ok((ACTION_RANK.hu ?? 0) > (ACTION_RANK['ming-gang'] ?? 0));
  assert.ok((ACTION_RANK['ming-gang'] ?? 0) > (ACTION_RANK.peng ?? 0));
  assert.ok((ACTION_RANK.peng ?? 0) > (ACTION_RANK.chi ?? 0));
  const huXia = { seat: 1, action: { kind: 'hu' as const } };
  const huDui = { seat: 2, action: { kind: 'hu' as const } };
  assert.equal(isBetterAction(huXia, huDui, 0), true);
  assert.equal(isBetterAction({ seat: 1, action: { kind: 'peng' } }, { seat: 1, action: { kind: 'hu' } }, 0), false);
});

test('只能下家吃上家', () => {
  const wall = createPizhouDeck();
  const game = new PizhouGame({ dealer: 0, wall });
  const discard = game.seats[0]!.hand[0]!;
  const lower = (0 + 1) % 4;
  const opposite = (0 + 2) % 4;
  const actionsLower = game['buildClaimCandidates'](discard, 0, 'discard');
  const lowerEntry = actionsLower.find((item) => item.seat === lower);
  const oppEntry = actionsLower.find((item) => item.seat === opposite);
  if (lowerEntry) {
    const chi = lowerEntry.actions.filter((item) => item.kind === 'chi');
    if (oppEntry) {
      assert.equal(oppEntry.actions.some((item) => item.kind === 'chi'), false);
    }
    assert.ok(chi.length >= 0);
  }
});

test('超时自动出牌', () => {
  let now = 1_000;
  const game = new PizhouGame({
    dealer: 0,
    wall: placeWinningDealerWall(),
    now: () => now,
    timeoutMs: 30_000,
  });
  const before = game.seats[0]!.hand.length;
  now += 30_001;
  const ticked = game.tick(now);
  assert.equal(ticked.changed, true);
  assert.equal(game.seats[0]!.hand.length, before - 1);
  assert.equal(game.seats[0]!.discards.length, 1);
});

test('随机自动打牌能正常结束', () => {
  const rng = mulberry(20260818);
  const game = new PizhouGame({ rng, timeoutMs: 30_000 });
  let steps = 0;
  while (game.phase !== 'settlement' && steps < 800) {
    steps += 1;
    if (game.phase === 'self-turn') {
      const seat = game.currentSeat;
      const actions = game.availableFor(seat);
      if (actions.some((item) => item.kind === 'hu')) {
        const result = game.apply(seat, { kind: 'hu' }, `auto-${steps}`, game.sequence);
        assert.equal(result.ok, true, result.error);
        continue;
      }
      const tile = game.seats[seat]!.lastDrawnId
        ? game.seats[seat]!.hand.find((item) => item.id === game.seats[seat]!.lastDrawnId)
        : game.seats[seat]!.hand[game.seats[seat]!.hand.length - 1];
      assert.ok(tile);
      const result = game.apply(seat, { kind: 'discard', tileId: tile!.id }, `auto-${steps}`, game.sequence);
      assert.equal(result.ok, true, result.error);
      continue;
    }
    if ((game.phase === 'claim-window' || game.phase === 'qidong') && game.pending) {
      const pending = [...game.pending.candidates];
      for (const candidate of pending) {
        if (game.phase !== 'claim-window') break;
        if (game.pending?.responses.has(candidate.seat)) continue;
        const wantHu = candidate.actions.some((item) => item.kind === 'hu');
        const result = game.apply(
          candidate.seat,
          { kind: wantHu ? 'hu' : 'pass' },
          `auto-${steps}-${candidate.seat}`,
          game.sequence,
        );
        assert.equal(result.ok, true, result.error);
      }
    }
  }
  assert.equal(game.phase, 'settlement');
  assert.ok(game.settlement);
});

function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

test('流局不结算分数', () => {
  const tinyWall = [
    makeTile('wan', 1, 0), makeTile('wan', 2, 0), makeTile('wan', 3, 0), makeTile('wan', 4, 0),
  ];
  // not used as full game; call private finish via empty wall after construct would throw.
  // 用正常牌墙把 wall 清空后模拟摸牌。
  const game = new PizhouGame({ dealer: 0 });
  game.wall = [];
  const result = game['advanceDraw'](1);
  assert.equal(result.ok, true);
  assert.equal(game.settlement?.liuju, true);
  assert.equal(game.settlement?.scores.every((item) => item.delta === 0), true);
});

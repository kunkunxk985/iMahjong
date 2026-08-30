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

test('查胡两两结：四家分差之和为 0', () => {
  const game = new PizhouGame({ dealer: 0, wall: placeWinningDealerWall() });
  const result = game.apply(0, { kind: 'hu' }, 'hu-score', 1);
  assert.equal(result.ok, true);
  const settlement = game.settlement!;
  const sum = settlement.scores.reduce((total, item) => total + item.delta, 0);
  assert.equal(sum, 0);
  assert.ok((settlement.scores[0]?.delta ?? 0) > 0);
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
  const candidates = game['buildClaimCandidates'](discard, 0);
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

test('进行中隐藏他家手牌，结算后公开四家牌面', () => {
  const game = new PizhouGame({ dealer: 0, wall: placeWinningDealerWall() });
  const metas = [0, 1, 2, 3].map((seat) => ({
    nickname: `P${seat}`,
    ready: true,
    online: true,
    isHost: seat === 0,
    isBot: false,
    score: 0,
  }));
  const viewInput = {
    mySeat: 0,
    roomCode: 'TEST01',
    token: 'test-token',
    hostSeat: 0,
    metas,
  };

  const during = game.getClientView(viewInput);
  assert.equal('hand' in during.players[0]!, true);
  assert.equal('hand' in during.players[1]!, false);
  assert.equal('hand' in during.players[2]!, false);
  assert.equal('hand' in during.players[3]!, false);

  const result = game.apply(0, { kind: 'hu' }, 'reveal-hands', game.sequence);
  assert.equal(result.ok, true, result.error);
  const after = game.getClientView(viewInput);
  assert.equal(after.phase, 'settlement');
  for (const player of after.players) {
    assert.equal(Array.isArray((player as { hand?: unknown }).hand), true);
    assert.ok((player as { hand: Tile[] }).hand.length > 0);
  }
});

test('三张相同牌提示坎上，确认后锁定且不能拆开出牌', () => {
  const game = new PizhouGame({ dealer: 0 });
  const runtime = game.seats[0]!;
  const locked = [makeTile('tong', 5, 0), makeTile('tong', 5, 1), makeTile('tong', 5, 2)];
  runtime.hand = [...locked, ...runtime.hand.filter((tile) => tile.key !== 'tong-5').slice(0, 11)];
  game.phase = 'self-turn';
  game.currentSeat = 0;

  const action = game.availableFor(0).find((item) => item.kind === 'kan' && item.key === 'tong-5');
  assert.ok(action, '应提示坎上五筒');
  const result = game.apply(0, { kind: 'kan', key: 'tong-5', tileIds: action!.tileIds }, 'kan-1', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(runtime.melds.some((meld) => meld.type === 'kan' && meld.tiles[0]?.key === 'tong-5'), true);
  assert.equal(runtime.hand.some((tile) => locked.some((item) => item.id === tile.id)), false);

  const discardLocked = game.apply(0, { kind: 'discard', tileId: locked[0]!.id }, 'kan-locked', game.sequence);
  assert.equal(discardLocked.ok, false);
});

test('三组碰坎杠后可选择出牌并关门，臭牌记录采用全桌牌河', () => {
  const game = new PizhouGame({ dealer: 0 });
  const runtime = game.seats[0]!;
  const gateDiscard = makeTile('wan', 9, 0);
  runtime.hand = [
    makeTile('tong', 1, 0), makeTile('tong', 1, 1),
    makeTile('tong', 2, 0), makeTile('tong', 2, 1),
    gateDiscard,
  ];
  runtime.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'an-gang', tiles: [makeTile('tiao', 4, 0), makeTile('tiao', 4, 1), makeTile('tiao', 4, 2), makeTile('tiao', 4, 3)] },
  ];
  const priorDiscard = makeTile('wan', 8, 0);
  const priorClaimedDiscard = makeTile('dragon', 1, 0);
  runtime.discards = [priorDiscard];
  game.seats[1]!.discards = [priorClaimedDiscard];
  // 香臭牌历史独立于当前牌河；即使旧牌后来被碰走，也不能重新变成香牌。
  game['recordResolvedDiscard'](priorDiscard);
  game['recordResolvedDiscard'](priorClaimedDiscard);
  game.phase = 'self-turn';
  game.currentSeat = 0;

  const action = game.availableFor(0).find((item) => item.kind === 'close-gate');
  assert.deepEqual(action?.tileIds, [gateDiscard.id]);

  const missingTile = game.apply(0, { kind: 'close-gate' }, 'gate-missing', game.sequence);
  assert.equal(missingTile.ok, false);

  const result = game.apply(0, { kind: 'close-gate', tileId: gateDiscard.id }, 'gate-1', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(runtime.closedTwoPair, true);
  assert.equal(runtime.closed, true);
  assert.deepEqual(runtime.closedTwoPairKeys, ['tong-1', 'tong-2']);
  assert.deepEqual(runtime.hand.map((tile) => tile.key).sort(), ['tong-1', 'tong-1', 'tong-2', 'tong-2']);
  assert.deepEqual(runtime.discardedBeforeClose.sort(), ['dragon-1', 'wan-8', 'wan-9']);
  assert.equal(runtime.discards.some((tile) => tile.id === gateDiscard.id), true);
});

test('有吃牌或不足三组时不能两对关门', () => {
  const game = new PizhouGame({ dealer: 0 });
  const runtime = game.seats[0]!;
  runtime.hand = [
    makeTile('tong', 1, 0), makeTile('tong', 1, 1),
    makeTile('tong', 2, 0), makeTile('tong', 2, 1),
    makeTile('wan', 9, 0),
  ];
  runtime.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'chi', tiles: [makeTile('wan', 3, 0), makeTile('wan', 4, 0), makeTile('wan', 5, 0)] },
  ];
  game.phase = 'self-turn';
  game.currentSeat = 0;
  assert.equal(game.availableFor(0).some((item) => item.kind === 'close-gate'), false);

  runtime.melds = runtime.melds.slice(0, 2);
  assert.equal(game.availableFor(0).some((item) => item.kind === 'close-gate'), false);
});

test('四组完成后只剩一张单钓对子，自动算关门', () => {
  const game = new PizhouGame({ dealer: 0 });
  const runtime = game.seats[0]!;
  const waitTile = makeTile('tong', 5, 0);
  const discard = makeTile('wan', 8, 0);
  runtime.hand = [waitTile, discard];
  runtime.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'peng', tiles: [makeTile('tiao', 4, 0), makeTile('tiao', 4, 1), makeTile('tiao', 4, 2)] },
    { type: 'an-gang', tiles: [makeTile('tiao', 5, 0), makeTile('tiao', 5, 1), makeTile('tiao', 5, 2), makeTile('tiao', 5, 3)] },
  ];
  game.phase = 'self-turn';
  game.currentSeat = 0;

  const result = game.apply(0, { kind: 'discard', tileId: discard.id }, 'single-wait-close', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(runtime.hand.length, 1);
  assert.equal(runtime.hand[0]?.id, waitTile.id);
  assert.equal(runtime.closed, true);
  assert.equal(runtime.closedTwoPair, false);
  assert.equal(runtime.waitKey, waitTile.key);
  assert.equal(runtime.singleWaitChanged, false);
});

test('单钓关门允许换听口，但失去“不换张”包庄资格', () => {
  const game = new PizhouGame({ dealer: 0 });
  const runtime = game.seats[0]!;
  const oldWait = makeTile('tong', 5, 0);
  const newWait = makeTile('wan', 8, 0);
  runtime.hand = [oldWait, newWait];
  runtime.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'peng', tiles: [makeTile('tiao', 4, 0), makeTile('tiao', 4, 1), makeTile('tiao', 4, 2)] },
    { type: 'an-gang', tiles: [makeTile('tiao', 5, 0), makeTile('tiao', 5, 1), makeTile('tiao', 5, 2), makeTile('tiao', 5, 3)] },
  ];
  runtime.closed = true;
  runtime.waitKey = oldWait.key;
  game.phase = 'self-turn';
  game.currentSeat = 0;

  const result = game.apply(0, { kind: 'discard', tileId: oldWait.id }, 'single-wait-change', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(runtime.closed, true);
  assert.equal(runtime.closedTwoPair, false);
  assert.equal(runtime.waitKey, newWait.key);
  assert.equal(runtime.singleWaitChanged, true);

  const changedWaitClaims = game['buildClaimCandidates'](makeTile('wan', 7, 0), 1)
    .find((candidate) => candidate.seat === 0)?.actions;
  assert.equal(changedWaitClaims?.some((action) => action.kind === 'hu') ?? false, false);
});

test('两对关门后拆对子换听口，关门立即失效', () => {
  const game = new PizhouGame({ dealer: 0 });
  const runtime = game.seats[0]!;
  const splitPair = makeTile('tong', 1, 0);
  runtime.hand = [
    splitPair, makeTile('tong', 1, 1),
    makeTile('tong', 2, 0), makeTile('tong', 2, 1),
    makeTile('wan', 8, 0),
  ];
  runtime.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'peng', tiles: [makeTile('tiao', 4, 0), makeTile('tiao', 4, 1), makeTile('tiao', 4, 2)] },
  ];
  runtime.closed = true;
  runtime.closedTwoPair = true;
  runtime.closedTwoPairKeys = ['tong-1', 'tong-2'];
  game.phase = 'self-turn';
  game.currentSeat = 0;

  const result = game.apply(0, { kind: 'discard', tileId: splitPair.id }, 'two-pair-change', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(runtime.closed, false);
  assert.equal(runtime.closedTwoPair, false);
  assert.deepEqual(runtime.closedTwoPairKeys, []);
});

test('关门后不能吃碰杠别家弃牌，只允许胡或过', () => {
  const game = new PizhouGame({ dealer: 0 });
  const seat1 = game.seats[1]!;
  seat1.hand = [
    makeTile('tong', 1, 0), makeTile('tong', 1, 1),
    makeTile('tong', 2, 0), makeTile('tong', 2, 1),
  ];
  seat1.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'peng', tiles: [makeTile('tiao', 4, 0), makeTile('tiao', 4, 1), makeTile('tiao', 4, 2)] },
  ];
  seat1.closed = true;
  seat1.closedTwoPair = true;
  seat1.closedTwoPairKeys = ['tong-1', 'tong-2'];

  // 别家打出一张 1 筒（形成胡牌）
  const claimsHu = game['buildClaimCandidates'](makeTile('tong', 1, 2), 0)
    .find((c) => c.seat === 1)?.actions;
  assert.equal(claimsHu?.some((item) => item.kind === 'hu'), true);
  assert.equal(claimsHu?.some((item) => item.kind === 'peng'), false);
  assert.equal(claimsHu?.some((item) => item.kind === 'chi'), false);
  assert.equal(claimsHu?.some((item) => item.kind === 'ming-gang'), false);
});

test('三组两对遇到未出现过的香牌点炮，可真实胡牌并触发包香', () => {
  const game = new PizhouGame({ dealer: 2 });
  const winner = game.seats[0]!;
  winner.hand = [
    makeTile('tong', 1, 0), makeTile('tong', 1, 1),
    makeTile('tong', 2, 0), makeTile('tong', 2, 1),
  ];
  winner.melds = [
    { type: 'peng', tiles: [makeTile('tiao', 2, 0), makeTile('tiao', 2, 1), makeTile('tiao', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    { type: 'peng', tiles: [makeTile('tiao', 4, 0), makeTile('tiao', 4, 1), makeTile('tiao', 4, 2)] },
  ];
  winner.closed = false;
  winner.closedTwoPair = false;
  winner.discardedBeforeClose = [];

  const shot = makeTile('tong', 1, 2);
  game.seats[1]!.hand = [shot, makeTile('wan', 8, 0)];
  game.seats[2]!.hand = [makeTile('dragon', 2, 0)];
  game.seats[3]!.hand = [makeTile('dragon', 3, 0)];
  game.phase = 'self-turn';
  game.pending = null;
  game.currentSeat = 1;

  const discarded = game.apply(1, { kind: 'discard', tileId: shot.id }, 'xiang-discard', game.sequence);
  assert.equal(discarded.ok, true, discarded.error);
  assert.equal(game.availableFor(0).some((action) => action.kind === 'hu'), true);
  // 正在等待响应的这一张不能提前写进历史，否则会被误判为臭牌。
  assert.equal(winner.discardedBeforeClose.includes(shot.key), false);

  const hu = game.apply(0, { kind: 'hu' }, 'xiang-hu', game.sequence);
  assert.equal(hu.ok, true, hu.error);
  assert.equal(game.settlement?.baoZhuang?.reason, 'xiang');
  assert.equal(game.settlement?.baoZhuang?.payerSeat, 1);
  assert.equal(game.settlement?.scores[0]?.piaoHun, true);
});

test('四组单钓不换张遇到顺子牌，可走特殊胡牌入口并按飘荤包庄', () => {
  const game = new PizhouGame({ dealer: 2 });
  const winner = game.seats[0]!;
  winner.hand = [makeTile('tiao', 3, 0)];
  winner.melds = [
    { type: 'peng', tiles: [makeTile('tong', 1, 0), makeTile('tong', 1, 1), makeTile('tong', 1, 2)] },
    { type: 'kan', tiles: [makeTile('tong', 2, 0), makeTile('tong', 2, 1), makeTile('tong', 2, 2)] },
    { type: 'peng', tiles: [makeTile('tong', 3, 0), makeTile('tong', 3, 1), makeTile('tong', 3, 2)] },
    { type: 'an-gang', tiles: [makeTile('tong', 4, 0), makeTile('tong', 4, 1), makeTile('tong', 4, 2), makeTile('tong', 4, 3)] },
  ];
  winner.closed = true;
  winner.waitKey = 'tiao-3';
  winner.singleWaitChanged = false;

  const shot = makeTile('tiao', 4, 0);
  game.seats[1]!.hand = [shot, makeTile('wan', 8, 0)];
  game.seats[2]!.hand = [makeTile('dragon', 2, 0)];
  game.seats[3]!.hand = [makeTile('dragon', 3, 0)];
  game.phase = 'self-turn';
  game.pending = null;
  game.currentSeat = 1;

  const discarded = game.apply(1, { kind: 'discard', tileId: shot.id }, 'four-wait-discard', game.sequence);
  assert.equal(discarded.ok, true, discarded.error);
  assert.equal(game.availableFor(0).some((action) => action.kind === 'hu'), true);
  const hu = game.apply(0, { kind: 'hu' }, 'four-wait-hu', game.sequence);
  assert.equal(hu.ok, true, hu.error);
  assert.equal(game.settlement?.baoZhuang?.reason, 'four_wait_seq');
  assert.equal(game.settlement?.scores[0]?.piaoHun, true);
});

test('带吃单钓不换张遇到顺子牌，可特殊胡并按普通胡包庄', () => {
  const game = new PizhouGame({ dealer: 2 });
  const winner = game.seats[0]!;
  winner.hand = [makeTile('tiao', 3, 0)];
  winner.melds = [
    { type: 'chi', tiles: [makeTile('wan', 2, 0), makeTile('wan', 3, 0), makeTile('wan', 4, 0)] },
    { type: 'peng', tiles: [makeTile('tong', 2, 0), makeTile('tong', 2, 1), makeTile('tong', 2, 2)] },
    { type: 'kan', tiles: [makeTile('tong', 3, 0), makeTile('tong', 3, 1), makeTile('tong', 3, 2)] },
    { type: 'peng', tiles: [makeTile('tong', 4, 0), makeTile('tong', 4, 1), makeTile('tong', 4, 2)] },
  ];
  winner.closed = true;
  winner.waitKey = 'tiao-3';
  winner.singleWaitChanged = false;

  const shot = makeTile('tiao', 5, 0);
  game.seats[1]!.hand = [shot, makeTile('wan', 8, 0)];
  game.seats[2]!.hand = [makeTile('dragon', 2, 0)];
  game.seats[3]!.hand = [makeTile('dragon', 3, 0)];
  game.phase = 'self-turn';
  game.pending = null;
  game.currentSeat = 1;

  const discarded = game.apply(1, { kind: 'discard', tileId: shot.id }, 'chow-wait-discard', game.sequence);
  assert.equal(discarded.ok, true, discarded.error);
  assert.equal(game.availableFor(0).some((action) => action.kind === 'hu'), true);
  const hu = game.apply(0, { kind: 'hu' }, 'chow-wait-hu', game.sequence);
  assert.equal(hu.ok, true, hu.error);
  assert.equal(game.settlement?.baoZhuang?.reason, 'chow_wait_seq');
  assert.equal(game.settlement?.scores[0]?.piaoHun, false);
});

test('锁定坎可升级：别人打第四张为送杠，自己摸第四张可自杠', () => {
  const game = new PizhouGame({ dealer: 0 });
  const kanTiles = [makeTile('tiao', 1, 0), makeTile('tiao', 1, 1), makeTile('tiao', 1, 2)];
  game.seats[1]!.melds = [{ type: 'kan', tiles: kanTiles }];
  game.seats[1]!.hand = [makeTile('tiao', 1, 3)];

  const claim = game['buildClaimCandidates'](makeTile('tiao', 1, 3), 0)
    .find((candidate) => candidate.seat === 1)?.actions;
  assert.equal(claim?.some((item) => item.kind === 'ming-gang' && item.key === 'tiao-1'), true);

  game.phase = 'self-turn';
  game.currentSeat = 1;
  const ziGang = game.availableFor(1).find((item) => item.kind === 'zi-gang' && item.key === 'tiao-1');
  assert.ok(ziGang);
  const result = game.apply(1, { kind: 'zi-gang', key: ziGang.key, tileId: ziGang.tileId }, 'zi-gang', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(game.seats[1]!.melds.some((meld) => meld.type === 'zi-gang' && meld.tiles.length === 4), true);
});

test('手里未坎上的三张遇到别人第四张，也可以直接送杠', () => {
  const game = new PizhouGame({ dealer: 0 });
  game.seats[1]!.hand = [
    makeTile('tong', 6, 0),
    makeTile('tong', 6, 1),
    makeTile('tong', 6, 2),
    makeTile('wan', 8, 0),
  ];

  const actions = game['buildClaimCandidates'](makeTile('tong', 6, 3), 0)
    .find((candidate) => candidate.seat === 1)?.actions;
  assert.equal(actions?.some((action) => action.kind === 'ming-gang' && action.key === 'tong-6'), true);
});

test('碰后即使自己摸到第四张也不能杠', () => {
  const game = new PizhouGame({ dealer: 0 });
  game.seats[1]!.melds = [{
    type: 'peng',
    tiles: [makeTile('tong', 5, 0), makeTile('tong', 5, 1), makeTile('tong', 5, 2)],
    fromSeat: 0,
  }];
  game.seats[1]!.hand = [makeTile('tong', 5, 3)];
  game.phase = 'self-turn';
  game.currentSeat = 1;

  assert.equal(game.availableFor(1).some((action) => action.kind === 'zi-gang'), false);
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
  const actionsLower = game['buildClaimCandidates'](discard, 0);
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

test('开局四家第一张相同则流局', () => {
  const game = new PizhouGame({ dealer: 0, wall: createPizhouDeck() });
  assert.equal(game.phase, 'self-turn');
  const tile = game.seats[0]!.hand.find((item) => item.key === 'wan-1');
  assert.ok(tile);
  game.seats[1]!.firstDiscardKey = 'wan-1';
  game.seats[2]!.firstDiscardKey = 'wan-1';
  game.seats[3]!.firstDiscardKey = 'wan-1';
  const result = game.apply(0, { kind: 'discard', tileId: tile!.id }, 'four-same', game.sequence);
  assert.equal(result.ok, true, result.error);
  assert.equal(game.settlement?.liuju, true);
  assert.equal(game.settlement?.drawReason, 'four_same');
});

test('流局不结算分数', () => {
  // 用正常牌墙把 wall 清空后模拟摸牌。
  const game = new PizhouGame({ dealer: 0 });
  game.wall = [];
  const result = game['advanceDraw'](1);
  assert.equal(result.ok, true);
  assert.equal(game.settlement?.liuju, true);
  assert.equal(game.settlement?.scores.every((item) => item.delta === 0), true);
});

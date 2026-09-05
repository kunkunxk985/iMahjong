import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HU_RATE,
  YAO_RATE,
  makeTile,
  type Meld,
  type Tile,
} from '@pizhou/shared';
import {
  canFormSequence,
  detectBaoZhuang,
  extractUnits,
  hasOpeningKong,
  isPiaoHun,
  nextDealer,
  scoreQidongGangHu,
  scoreWin,
  settleChaHu,
  unitValue,
} from '../src/score.ts';

function tiles(...specs: Array<[Tile['suit'], number, number]>): Tile[] {
  return specs.map(([suit, rank, copy]) => makeTile(suit, rank, copy));
}

function emptySeat() {
  return { hand: tiles(['tiao', 8, 0]), exposed: [] as Meld[] };
}

function assertAccounting(result: ReturnType<typeof settleChaHu>): void {
  assert.equal(result.deltas.reduce((sum, value) => sum + value, 0), 0);
  assert.equal(
    result.receivables.reduce((sum, value) => sum + value, 0),
    result.payables.reduce((sum, value) => sum + value, 0),
  );
  assert.equal(result.receivables.every((value) => value >= 0), true);
  assert.equal(result.payables.every((value) => value >= 0), true);
}

test('幺头与普通牌计胡表', () => {
  assert.deepEqual(unitValue('dragon-1', 'pair'), { hu: 2, yao: 0 });
  assert.deepEqual(unitValue('dragon-1', 'peng'), { hu: 2, yao: 0 });
  assert.deepEqual(unitValue('dragon-1', 'pung'), { hu: 4, yao: 1 });
  assert.deepEqual(unitValue('dragon-1', 'song_kong'), { hu: 8, yao: 2 });
  assert.deepEqual(unitValue('dragon-1', 'zi_kong'), { hu: 12, yao: 3 });
  assert.deepEqual(unitValue('tiao-5', 'pair'), { hu: 1, yao: 0 });
  assert.deepEqual(unitValue('tiao-5', 'peng'), { hu: 1, yao: 0 });
  assert.deepEqual(unitValue('tiao-5', 'pung'), { hu: 2, yao: 0 });
  assert.deepEqual(unitValue('tiao-5', 'song_kong'), { hu: 4, yao: 0 });
  assert.deepEqual(unitValue('tiao-5', 'zi_kong'), { hu: 6, yao: 0 });
});

test('吃不算；没胡的人手中对子和落地碰都算', () => {
  const units = extractUnits(
    tiles(['tiao', 5, 0], ['tiao', 5, 1]),
    [
      { type: 'chi', tiles: tiles(['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0]) },
      { type: 'peng', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) },
    ],
    false,
  );
  assert.equal(units.some((item) => item.kind === 'peng'), true);
  assert.equal(units.some((item) => item.key === 'tiao-5' && item.kind === 'pair'), true);
});

test('没胡的人也查散对：普通对1胡，幺头对2胡', () => {
  const units = extractUnits(
    tiles(
      ['tiao', 2, 0], ['tiao', 2, 1],
      ['wan', 7, 0], ['wan', 7, 1],
      ['wan', 9, 0], ['wan', 9, 1],
    ),
    [{ type: 'chi', tiles: tiles(['tiao', 3, 0], ['tiao', 4, 0], ['tiao', 5, 0]) }],
    false,
  );
  assert.deepEqual(units, [
    { key: 'tiao-2', kind: 'pair' },
    { key: 'wan-7', kind: 'pair' },
    { key: 'wan-9', kind: 'pair' },
  ]);
  assert.equal(units.reduce((sum, unit) => sum + unitValue(unit.key, unit.kind).hu, 0), 4);
});

test('胡牌将牌按对计分，落地碰按碰计分', () => {
  const units = extractUnits(
    tiles(['wan', 9, 0], ['wan', 9, 1]),
    [{ type: 'peng', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) }],
    true,
  );
  assert.ok(units.some((item) => item.key === 'dragon-1' && item.kind === 'peng'));
  assert.ok(units.some((item) => item.key === 'wan-9' && item.kind === 'pair'));
});

test('基础平胡：普通将牌1胡，胡牌另加10胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0],
    ['tiao', 2, 0], ['tiao', 3, 0], ['tiao', 4, 0],
    ['tong', 5, 0], ['tong', 5, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  assert.equal(result.huBeforeDealer, 11);
  assert.equal(result.yao, 0);
  assert.equal(result.hu, 11);
});

test('未主动坎上的暗刻和暗手将牌仍参与查胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2],
    ['tong', 2, 0], ['tong', 2, 1], ['tong', 2, 2],
    ['tiao', 4, 0], ['tiao', 5, 0], ['tiao', 6, 0],
    ['wan', 3, 0], ['wan', 4, 0], ['wan', 5, 0],
    ['dragon', 1, 0], ['dragon', 1, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  // 一万坎4胡1幺 + 二筒坎2胡 + 红中对2胡 + 胡牌10胡。
  assert.equal(result.huBeforeDealer, 18);
  assert.equal(result.yao, 1);
});

test('一手牌有多种合法拆法时，计分与展示都采用本房分值较高的拆法', () => {
  const concealed = tiles(
    ['tiao', 1, 0], ['tiao', 1, 1], ['tiao', 1, 2],
    ['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2],
    ['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2],
    ['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2],
    ['tiao', 5, 0], ['tiao', 5, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  assert.equal(result.decomp.melds.filter((meld) => meld.type === 'pung').length, 4);
  assert.equal(result.hu, 21);
  assert.equal(result.yao, 1);
});

test('点炮牌可落入不同牌组时，仍优先采用实际结算分更高的拆法', () => {
  const concealed = tiles(
    ['tiao', 6, 0], ['tiao', 6, 1], ['tiao', 6, 2],
    ['tiao', 7, 0], ['tiao', 7, 1], ['tiao', 7, 2], ['tiao', 7, 3],
    ['tiao', 8, 0], ['tiao', 8, 1], ['tiao', 8, 2], ['tiao', 8, 3],
    ['tiao', 9, 0], ['tiao', 9, 1], ['tiao', 9, 2],
  );
  const winningDiscard = concealed[2]!;
  const result = settleChaHu({
    seats: [
      { hand: concealed, exposed: [], winningDiscardId: winningDiscard.id },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
    ron: true,
    discardKey: winningDiscard.key,
    discarderSeat: 1,
  });
  const winner = result.seats[0]!;

  // 高分拆法：六条对 + 6-7-8 顺 + 七、八、九条坎 = 19胡1幺。
  // 不能因点炮牌是第三张六条，就强制选成六条碰、九条对的17胡0幺拆法。
  assert.equal(winner.hu, 19);
  assert.equal(winner.yao, 1);
  assert.equal(winner.decomp.pairKey, 'tiao-6');
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-6' && unit.kind === 'peng'), false);
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-9' && unit.kind === 'pung'), true);
});

test('庄家牌面胡不改；涉及庄家时把两两胡差整体翻倍', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2],
    ['tong', 2, 0], ['tong', 3, 0], ['tong', 4, 0],
    ['tiao', 5, 0], ['tiao', 6, 0], ['tiao', 7, 0],
    ['wan', 6, 0], ['wan', 7, 0], ['wan', 8, 0],
    ['tiao', 9, 0], ['tiao', 9, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: true, winType: 'ping-hu' });
  assert.ok(result);
  // 一万坎4胡1幺 + 九条对2胡 + 胡牌10胡。
  assert.equal(result.huBeforeDealer, 16);
  assert.equal(result.yao, 1);
  assert.equal(result.dealerMultiplier, 2);
  assert.equal(result.hu, 16);

  // 查胡两两结：庄家(10胡0幺) vs 闲家A(0胡0幺) vs 闲家B(0胡0幺) vs 闲家C(0胡0幺)
  const settlement = settleChaHu({
    seats: [
      { hand: concealed, exposed: [] }, // 庄家 16胡 1幺
      { hand: tiles(['wan', 1, 0]), exposed: [{ type: 'chi', tiles: tiles(['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0]) }] }, // 闲家A: 0胡 0幺
      emptySeat(), // 闲家B: 0胡 0幺
      emptySeat(), // 闲家C: 0胡 0幺
    ],
    winnerSeat: 0,
    dealer: 0,
  });

  // 庄家牌面胡仍为16；每笔涉及庄家，原始胡差16整体×2=32，另有1幺。
  const each = 32 * HU_RATE + YAO_RATE;
  assert.equal(settlement.deltas[0], each * 3);
  assert.equal(settlement.deltas[1], -each);
  assert.equal(settlement.deltas[2], -each);
  assert.equal(settlement.deltas[3], -each);
  assert.equal(settlement.transactions[0]?.effectiveHuA, 16);
  assert.equal(settlement.transactions[0]?.effectiveHuB, 0);
  assert.equal(settlement.transactions.length, 6);
});

test('点炮双碰：点炮形成碰，留下的对子照常计分', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
    ['tong', 5, 0], ['tong', 5, 1],
    ['tiao', 1, 0], ['tiao', 1, 1], ['tiao', 1, 2],
  );
  const winningDiscard = concealed.at(-1)!;
  const result = settleChaHu({
    seats: [
      { hand: concealed, exposed: [], winningDiscardId: winningDiscard.id },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
    ron: true,
    discardKey: winningDiscard.key,
    discarderSeat: 1,
  });
  const winner = result.seats[0]!;
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-1' && unit.kind === 'pung'), false);
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-1' && unit.kind === 'peng'), true);
  // 五筒对1胡 + 一条幺牌碰2胡 + 胡牌10胡。
  assert.equal(winner.huBeforeDealer, 13);
  assert.equal(winner.yao, 0);
});

test('点炮补成普通牌三张按碰计 1 胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
    ['tong', 5, 0], ['tong', 5, 1],
    ['tiao', 5, 0], ['tiao', 5, 1], ['tiao', 5, 2],
  );
  const winningDiscard = concealed.at(-1)!;
  const result = settleChaHu({
    seats: [
      { hand: concealed, exposed: [], winningDiscardId: winningDiscard.id },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 2,
    ron: true,
    discardKey: winningDiscard.key,
    discarderSeat: 1,
  });

  const winner = result.seats[0]!;
  assert.deepEqual(
    winner.units.filter((unit) => unit.key === 'tiao-5'),
    [{ key: 'tiao-5', kind: 'peng' }],
  );
  assert.equal(winner.hu, 12);
  assert.equal(winner.yao, 0);
  const discarderTransaction = result.transactions.find(
    (tx) => tx.seatA === 0 && tx.seatB === 1,
  )!;
  // 胡家12胡、点炮家0胡；不因点炮额外翻倍。
  assert.equal(discarderTransaction.deltaHu, 12);
  assert.equal(discarderTransaction.deltaYao, 0);
  assert.equal(discarderTransaction.points, 12 * HU_RATE);
});

test('来牌同时看似可碰和成顺时，只采用能完整胡牌的合法拆法', () => {
  const concealed = tiles(
    ['tiao', 2, 0],
    ['tiao', 3, 0],
    ['tiao', 3, 1],
    ['tiao', 4, 0],
    ['tiao', 3, 2],
  );
  const exposed: Meld[] = [
    { type: 'chi', tiles: tiles(['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0]) },
    { type: 'chi', tiles: tiles(['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0]) },
    { type: 'chi', tiles: tiles(['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0]) },
  ];
  const winningDiscard = concealed.at(-1)!;
  const units = extractUnits(concealed, exposed, true, winningDiscard.id);

  // 正确拆法只能是二三四条 + 三条将牌；强行碰三条会留下二、四条，不能胡。
  assert.equal(units.some((unit) => unit.key === 'tiao-3' && unit.kind === 'peng'), false);
});

test('点炮胡时，未主动坎上的手牌刻子也按坎查胡', () => {
  const concealed = tiles(
    ['wan', 6, 0], ['wan', 7, 0], ['wan', 8, 0],
    ['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2],
    ['tiao', 9, 0], ['tiao', 9, 1], ['tiao', 9, 2],
    ['dragon', 3, 0], ['dragon', 3, 1],
  );
  const winningDiscard = concealed.at(-1)!; // 白板 (dragon-3)
  const result = settleChaHu({
    seats: [
      {
        hand: concealed,
        exposed: [{ type: 'peng', tiles: tiles(['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2]) }],
        winningDiscardId: winningDiscard.id,
      },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 0,
    ron: true,
    discardKey: winningDiscard.key,
    discarderSeat: 1,
  });
  const winner = result.seats[0]!;
  assert.equal(winner.units.some((unit) => unit.key === 'dragon-3' && unit.kind === 'pair'), true);
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-9' && unit.kind === 'pung'), true);
  // 胡10 + 一万碰2 + 三条坎2 + 九条坎4胡1幺 + 白板对2。
  assert.equal(winner.huBeforeDealer, 20);
  assert.equal(winner.yao, 1);
});

test('自摸第三张成坎', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
    ['tong', 5, 0], ['tong', 5, 1],
    ['tiao', 1, 0], ['tiao', 1, 1], ['tiao', 1, 2],
  );
  const winningTile = concealed.at(-1)!;
  const result = scoreWin({
    concealed,
    exposed: [],
    isDealer: false,
    winType: 'ping-hu',
    winningTileId: winningTile.id,
  });
  assert.ok(result);
  // 自摸一条坎4胡1幺 + 五筒对1胡 + 胡牌10胡。
  assert.equal(result.huBeforeDealer, 15);
  assert.equal(result.yao, 1);
});

test('自摸补成普通牌三张按坎计 2 胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
    ['tong', 5, 0], ['tong', 5, 1],
    ['tiao', 5, 0], ['tiao', 5, 1], ['tiao', 5, 2],
  );
  const winningTile = concealed.at(-1)!;
  const result = scoreWin({
    concealed,
    exposed: [],
    isDealer: false,
    winType: 'ping-hu',
    winningTileId: winningTile.id,
  });

  assert.ok(result);
  assert.equal(result.hu, 13);
  assert.equal(result.yao, 0);
});

test('单钓自摸可以胡，最后补成的将牌照常计对子胡', () => {
  const exposed: Meld[] = [
    { type: 'chi', tiles: tiles(['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0]) },
    { type: 'chi', tiles: tiles(['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0]) },
    { type: 'chi', tiles: tiles(['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0]) },
    { type: 'chi', tiles: tiles(['tiao', 4, 0], ['tiao', 5, 0], ['tiao', 6, 0]) },
  ];
  const ordinaryPair = tiles(['tong', 5, 0], ['tong', 5, 1]);
  const ordinary = scoreWin({
    concealed: ordinaryPair,
    exposed,
    isDealer: false,
    winType: 'ping-hu',
    winningTileId: ordinaryPair[1]!.id,
  });
  assert.ok(ordinary);
  assert.equal(ordinary.huBeforeDealer, 11);
  assert.equal(ordinary.yao, 0);

  const yaoPair = tiles(['dragon', 1, 0], ['dragon', 1, 1]);
  const yao = scoreWin({
    concealed: yaoPair,
    exposed,
    isDealer: false,
    winType: 'ping-hu',
    winningTileId: yaoPair[1]!.id,
  });
  assert.ok(yao);
  assert.equal(yao.huBeforeDealer, 12);
  assert.equal(yao.yao, 0);

  const ronUnits = extractUnits(ordinaryPair, exposed, true, ordinaryPair[1]!.id);
  assert.equal(ronUnits.some((unit) => unit.key === 'tong-5' && unit.kind === 'pair'), true);
});

test('锁定坎按坎计分：普通坎2胡，幺头坎4胡1幺', () => {
  const ordinaryTiles = tiles(['tong', 5, 0], ['tong', 5, 1], ['tong', 5, 2]);
  const yaoTiles = tiles(['tiao', 1, 0], ['tiao', 1, 1], ['tiao', 1, 2]);
  const ordinary = extractUnits([], [{ type: 'kan', tiles: ordinaryTiles }], false);
  const yao = extractUnits([], [{ type: 'kan', tiles: yaoTiles }], false);
  assert.deepEqual(unitValue(ordinary[0]!.key, ordinary[0]!.kind), { hu: 2, yao: 0 });
  assert.deepEqual(unitValue(yao[0]!.key, yao[0]!.kind), { hu: 4, yao: 1 });
});

test('未声明的四张相同牌只查作一坎，不追认自杠或对子', () => {
  const units = extractUnits(
    tiles(['tong', 5, 0], ['tong', 5, 1], ['tong', 5, 2], ['tong', 5, 3]),
    [],
    false,
  );
  assert.deepEqual(units, [{ key: 'tong-5', kind: 'pung' }]);
});

test('落地碰算碰：普通碰1胡，幺牌碰2胡，吃牌不计胡数', () => {
  const concealed = tiles(
    ['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0],
    ['tong', 5, 0], ['tong', 6, 0], ['tong', 7, 0],
    ['tiao', 3, 0], ['tiao', 3, 1],
  );
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) },
    { type: 'chi', tiles: tiles(['wan', 5, 0], ['wan', 6, 0], ['wan', 7, 0]) },
  ];
  const result = scoreWin({ concealed, exposed, isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  // 胡10 + 红中碰2 + 三条对1。
  assert.equal(result.huBeforeDealer, 13);
  assert.equal(result.yao, 0);
});

test('轮庄：只有庄家胡牌连庄，闲家胡或流局都换下一家', () => {
  assert.equal(nextDealer(0, 2, false), 1);
  assert.equal(nextDealer(0, 0, false), 0);
  assert.equal(nextDealer(2, null, true), 3);
  assert.equal(nextDealer(0, null, true, 'four_same'), 1);
});

test('起手杠胡按暗杠计分', () => {
  const hand = tiles(
    ['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2], ['dragon', 1, 3],
    ['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0],
    ['tong', 5, 0], ['tong', 6, 0], ['tong', 7, 0],
    ['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 8, 0],
  );
  const result = scoreQidongGangHu(hand, false);
  // 胡10 + 红中自杠12胡3幺 + 三条对1胡。
  assert.equal(result.huBeforeDealer, 10 + 12 + 1);
  assert.equal(result.yao, 3);
});

test('明杠与暗杠计分不同', () => {
  const concealed = tiles(
    ['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0],
    ['tong', 5, 0], ['tong', 6, 0], ['tong', 7, 0],
    ['tiao', 3, 0], ['tiao', 3, 1],
  );
  const exposed: Meld[] = [
    { type: 'ming-gang', tiles: tiles(['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2], ['wan', 1, 3]) },
    { type: 'an-gang', tiles: tiles(['dragon', 2, 0], ['dragon', 2, 1], ['dragon', 2, 2], ['dragon', 2, 3]) },
  ];
  const result = scoreWin({ concealed, exposed, isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  // 胡10 + 一万送杠8 + 发财自杠12 + 三条对1。
  assert.equal(result.huBeforeDealer, 31);
  assert.equal(result.yao, 5);

  const ziGangResult = scoreWin({
    concealed,
    exposed: [exposed[0]!, { ...exposed[1]!, type: 'zi-gang' }],
    isDealer: false,
    winType: 'ping-hu',
  });
  assert.ok(ziGangResult);
  assert.equal(ziGangResult.huBeforeDealer, 31);
  assert.equal(ziGangResult.yao, 5);
});

test('飘荤：四组单钓，牌面胡固定、结算胡差翻倍并收荤底', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 5, 0], ['tiao', 5, 1], ['tiao', 5, 2]) },
  ];
  assert.equal(isPiaoHun(tiles(['tong', 1, 0]), exposed), true);
  const result = settleChaHu({
    seats: [
      { hand: tiles(['tong', 1, 0]), exposed },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
  });
  assert.equal(result.hunDi, true);
  assert.equal(result.seats[0]?.piaoHun, true);
  // 赢家牌面14胡；对庄家的原始胡差14先按飘荤×2，再按庄家×2，三家荤底仍各30。
  assert.deepEqual(result.deltas, [202, -86, -58, -58]);
  assertAccounting(result);
});

test('含吃的三组碰坎杠加两对不误判为飘荤', () => {
  const exposed: Meld[] = [
    { type: 'chi', tiles: tiles(['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0]) },
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'kan', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
  ];
  const hand = tiles(
    ['tong', 5, 0], ['tong', 5, 1],
    ['tong', 6, 0], ['tong', 6, 1],
  );

  assert.equal(isPiaoHun(hand, exposed), false);
});

test('飘荤先查原始胡差再翻本笔结算，涉及庄家再翻胡差且幺差不翻', () => {
  const winnerExposed: Meld[] = [
    { type: 'kan', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
  ];
  const opponentExposed: Meld[] = [
    { type: 'kan', tiles: tiles(['tiao', 5, 0], ['tiao', 5, 1], ['tiao', 5, 2]) },
    { type: 'kan', tiles: tiles(['tiao', 6, 0], ['tiao', 6, 1], ['tiao', 6, 2]) },
    { type: 'kan', tiles: tiles(['tiao', 7, 0], ['tiao', 7, 1], ['tiao', 7, 2]) },
  ];
  const seats = [
    { hand: tiles(['tong', 1, 0]), exposed: winnerExposed },
    { hand: tiles(['wan', 8, 0]), exposed: opponentExposed },
    emptySeat(),
    emptySeat(),
  ];

  const nonDealerResult = settleChaHu({ seats, winnerSeat: 0, dealer: 2 });
  const winner = nonDealerResult.seats[0]!;
  const opponent = nonDealerResult.seats[1]!;
  const nonDealerTx = nonDealerResult.transactions.find(
    (tx) => tx.seatA === 0 && tx.seatB === 1,
  )!;

  // 一张幺坎4胡1幺 + 三个普通碰各1胡 + 胡牌10胡 = 17胡；对手三坎=6胡。
  assert.equal(winner.hu, 17);
  assert.equal(winner.huBeforeDealer, 17);
  assert.equal(winner.fen, 17 * HU_RATE + YAO_RATE);
  assert.equal(winner.yao, 1);
  assert.equal(winner.piaoHun, true);
  assert.equal(opponent.hu, 6);
  assert.equal(nonDealerTx.huMultiplierA, 2);
  assert.equal(nonDealerTx.huMultiplierB, 1);
  assert.equal(nonDealerTx.effectiveHuA, 17);
  assert.equal(nonDealerTx.effectiveHuB, 6);
  assert.equal(nonDealerTx.isDealerPair, false);
  assert.equal(nonDealerTx.rawDeltaHu, 17 - 6);
  assert.equal(nonDealerTx.piaoMultiplier, 2);
  assert.equal(nonDealerTx.dealerMultiplier, 1);
  assert.equal(nonDealerTx.deltaHu, (17 - 6) * 2);
  assert.equal(nonDealerTx.deltaYao, 1);
  assert.equal(nonDealerTx.points, (17 - 6) * 2 * HU_RATE + YAO_RATE);

  const dealerResult = settleChaHu({ seats, winnerSeat: 0, dealer: 1 });
  const dealerTx = dealerResult.transactions.find(
    (tx) => tx.seatA === 0 && tx.seatB === 1,
  )!;
  assert.equal(dealerTx.huMultiplierA, 2);
  assert.equal(dealerTx.huMultiplierB, 1);
  assert.equal(dealerTx.effectiveHuA, 17);
  assert.equal(dealerTx.effectiveHuB, 6);
  assert.equal(dealerTx.isDealerPair, true);
  assert.equal(dealerTx.rawDeltaHu, 17 - 6);
  assert.equal(dealerTx.piaoMultiplier, 2);
  assert.equal(dealerTx.dealerMultiplier, 2);
  assert.equal(dealerTx.deltaHu, (17 - 6) * 2 * 2);
  assert.equal(dealerTx.deltaYao, 1);
  assert.equal(dealerTx.points, (17 - 6) * 2 * 2 * HU_RATE + YAO_RATE);

  const dealerPiaoResult = settleChaHu({ seats, winnerSeat: 0, dealer: 0 });
  const dealerPiaoTx = dealerPiaoResult.transactions.find(
    (tx) => tx.seatA === 0 && tx.seatB === 1,
  )!;
  assert.equal(dealerPiaoTx.huMultiplierA, 2);
  assert.equal(dealerPiaoTx.huMultiplierB, 1);
  assert.equal(dealerPiaoTx.effectiveHuA, 17);
  assert.equal(dealerPiaoTx.effectiveHuB, 6);
  assert.equal(dealerPiaoTx.rawDeltaHu, 17 - 6);
  assert.equal(dealerPiaoTx.piaoMultiplier, 2);
  assert.equal(dealerPiaoTx.dealerMultiplier, 2);
  assert.equal(dealerPiaoTx.deltaHu, (17 - 6) * 2 * 2);
});

test('涉及庄家时先算原始胡差再整体翻倍', () => {
  const dealerExposed: Meld[] = [
    { type: 'kan', tiles: tiles(['tong', 2, 0], ['tong', 2, 1], ['tong', 2, 2]) },
    { type: 'kan', tiles: tiles(['tong', 3, 0], ['tong', 3, 1], ['tong', 3, 2]) },
    { type: 'kan', tiles: tiles(['tong', 4, 0], ['tong', 4, 1], ['tong', 4, 2]) },
  ];
  const reversed = settleChaHu({
    seats: [
      { hand: tiles(['wan', 6, 0]), exposed: dealerExposed }, // 庄家6胡，牌面胡仍为6胡
      { hand: tiles(['tong', 5, 0], ['tong', 5, 1]), exposed: [] }, // 胡家11胡
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 1,
    dealer: 0,
  });
  const reversedTx = reversed.transactions.find((tx) => tx.seatA === 0 && tx.seatB === 1)!;
  assert.equal(reversedTx.huA, 6);
  assert.equal(reversedTx.huB, 11);
  assert.equal(reversedTx.deltaHu, -10);

  const dealerCompared = settleChaHu({
    seats: [
      { hand: tiles(['wan', 6, 0]), exposed: dealerExposed },
      { hand: tiles(['dragon', 1, 0], ['dragon', 1, 1]), exposed: [] }, // 闲家12胡
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 1,
    dealer: 0,
  });
  const dealerComparedTx = dealerCompared.transactions.find((tx) => tx.seatA === 0 && tx.seatB === 1)!;
  assert.equal(dealerComparedTx.effectiveHuA, 6);
  assert.equal(dealerComparedTx.effectiveHuB, 12);
  assert.equal(dealerComparedTx.deltaHu, -12);
});

test('两对关门：关门本身不加胡，但胡牌仍按等牌状态飘荤', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
  ];
  const hand = tiles(
    ['tong', 5, 0], ['tong', 5, 1], ['tong', 5, 2],
    ['tong', 6, 0], ['tong', 6, 1],
  );
  const result = settleChaHu({
    seats: [
      {
        hand,
        exposed,
        winningDiscardId: hand[2]!.id,
        closedTwoPair: true,
        discardedBeforeClose: [hand[2]!.key],
      },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
    ron: true,
    discardKey: hand[2]!.key,
    discarderSeat: 2,
  });

  const winner = result.seats[0]!;
  assert.equal(result.baoZhuang, null);
  assert.equal(winner.piaoHun, true);
  assert.equal(winner.huBeforeDealer, 10 + 3 + 1 + 1);
  assert.equal(winner.yao, 0);
  assert.equal(winner.units.some((unit) => unit.key === 'tong-6' && unit.kind === 'pair'), true);
  assert.equal(winner.units.some((unit) => unit.key === 'tong-5' && unit.kind === 'peng'), true);
});

test('四组牌单钓自摸按飘荤结算，最后对子照常计胡', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 5, 0], ['tiao', 5, 1], ['tiao', 5, 2]) },
  ];
  const hand = tiles(['tong', 6, 0], ['tong', 6, 1]);
  const result = settleChaHu({
    seats: [
      { hand, exposed, winningTileId: hand[1]!.id },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
  });

  const winner = result.seats[0]!;
  assert.equal(winner.piaoHun, true);
  assert.equal(winner.huBeforeDealer, 10 + 4 + 1);
  assert.equal(winner.yao, 0);
  assert.equal(winner.units.length, 5);
});

test('查胡两两结：没胡的人手中对子和暗坎也算', () => {
  const result = settleChaHu({
    seats: [
      {
        hand: tiles(
          ['wan', 7, 0], ['wan', 7, 1],
        ),
        exposed: [{ type: 'kan', tiles: tiles(['dragon', 2, 0], ['dragon', 2, 1], ['dragon', 2, 2]) }],
      },
      {
        hand: tiles(
          ['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0],
          ['wan', 5, 0], ['wan', 6, 0], ['wan', 7, 0],
          ['tong', 2, 0], ['tong', 3, 0], ['tong', 4, 0],
          ['tiao', 2, 0], ['tiao', 3, 0], ['tiao', 4, 0],
          ['tong', 8, 0], ['tong', 8, 1],
        ),
        exposed: [],
      },
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 1,
    dealer: 2,
  });
  // 没胡：发财坎4胡1幺 + 七万对1胡。
  assert.equal(result.seats[0]?.hu, 5);
  assert.equal(result.seats[0]?.yao, 1);
  // 胡牌：八筒对1胡 + 胡牌10胡。
  assert.equal(result.seats[1]?.huBeforeDealer, 11);
});

test('查胡两两结：没胡的庄家散对也计胡，涉及庄家时翻整笔胡差', () => {
  const result = settleChaHu({
    seats: [
      {
        hand: tiles(
          ['tiao', 2, 0], ['tiao', 2, 1],
          ['wan', 7, 0], ['wan', 7, 1],
          ['wan', 9, 0], ['wan', 9, 1],
        ),
        exposed: [{ type: 'chi', tiles: tiles(['tiao', 3, 0], ['tiao', 4, 0], ['tiao', 5, 0]) }],
      },
      { hand: tiles(['tiao', 5, 0], ['tiao', 5, 1]), exposed: [] },
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 1,
    dealer: 0,
  });
  assert.equal(result.seats[0]?.hu, 4);
  assert.equal(result.seats[0]?.yao, 0);
  assert.equal(result.seats[1]?.hu, 11);
  assert.deepEqual(result.deltas, [2, 36, -19, -19]);
  assert.equal(result.deltas.reduce((sum, n) => sum + n, 0), 0);
});

test('包庄：三坎两对未关门时遇香牌点炮', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
  ];
  const hand = tiles(
    ['tong', 1, 0], ['tong', 1, 1], ['tong', 1, 2],
    ['tong', 2, 0], ['tong', 2, 1],
  );
  const result = settleChaHu({
    seats: [
      {
        hand,
        exposed,
        winningDiscardId: hand[2]!.id,
        changed: false,
        closedTwoPair: false,
        discardedBeforeClose: [],
      },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
    ron: true,
    discardKey: 'tong-1',
    discarderSeat: 2,
  });
  assert.ok(result.baoZhuang);
  assert.equal(result.baoZhuang?.reason, 'xiang');
  assert.equal(result.baoZhuang?.payerSeat, 2);
  assert.equal(result.seats[0]?.piaoHun, true);
  // 赢家牌面16胡；每组先查原始胡差，再按飘荤/庄家关系结算，另加三份荤底90。
  // 2号包庄后独付218。
  assert.equal(result.seats[0]?.hu, 16);
  assert.deepEqual(result.deltas, [218, 0, -218, 0]);
  assert.deepEqual(result.payables, [0, 0, 218, 0]);
  assert.deepEqual(result.receivables, [218, 0, 0, 0]);
  assertAccounting(result);
});

test('包庄流水也按原始胡差再翻飘荤，不能把赢家牌面胡先乘二', () => {
  const winnerExposed: Meld[] = [
    { type: 'kan', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
  ];
  const winningHand = tiles(
    ['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2],
    ['wan', 2, 0], ['wan', 2, 1],
  );
  const result = settleChaHu({
    seats: [
      {
        hand: winningHand,
        exposed: winnerExposed,
        winningDiscardId: winningHand[2]!.id,
        closedTwoPair: false,
        discardedBeforeClose: [],
      },
      {
        hand: tiles(['tiao', 8, 0]),
        exposed: [
          { type: 'kan', tiles: tiles(['tiao', 5, 0], ['tiao', 5, 1], ['tiao', 5, 2]) },
          { type: 'kan', tiles: tiles(['tiao', 6, 0], ['tiao', 6, 1], ['tiao', 6, 2]) },
          { type: 'kan', tiles: tiles(['tiao', 7, 0], ['tiao', 7, 1], ['tiao', 7, 2]) },
        ],
      },
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 3,
    ron: true,
    discardKey: 'wan-1',
    discarderSeat: 1,
  });
  const winner = result.seats[0]!;
  const opponent = result.seats[1]!;
  const tx = result.transactions.find((item) => item.seatA === 0 && item.seatB === 1)!;

  assert.equal(result.baoZhuang?.reason, 'xiang');
  assert.equal(winner.piaoHun, true);
  assert.equal(tx.rawDeltaHu, winner.hu - opponent.hu);
  assert.equal(tx.effectiveHuA, winner.hu);
  assert.equal(tx.effectiveHuB, opponent.hu);
  assert.equal(tx.piaoMultiplier, 2);
  assert.equal(tx.dealerMultiplier, 1);
  assert.equal(tx.deltaHu, (winner.hu - opponent.hu) * 2);
  assert.equal(tx.points, tx.deltaHu * HU_RATE + (winner.yao - opponent.yao) * YAO_RATE);
  // 包庄不抹掉非胡家之间的两组流水：1号仍从2号、3号收各自的差胡。
  assert.deepEqual(result.deltas, [260, -242, -6, -12]);
  assert.deepEqual(result.payables, [0, 260, 6, 12]);
  assert.deepEqual(result.receivables, [260, 18, 0, 0]);
  assert.equal(result.transactions.find((item) => item.seatA === 1 && item.seatB === 2)?.points, 6);
  assert.equal(result.transactions.find((item) => item.seatA === 1 && item.seatB === 3)?.points, 12);
  assertAccounting(result);
});

test('带吃听顺包庄按普通胡结算，不翻胡差也不收荤底', () => {
  const exposed: Meld[] = [
    { type: 'chi', tiles: tiles(['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0]) },
    { type: 'peng', tiles: tiles(['tong', 2, 0], ['tong', 2, 1], ['tong', 2, 2]) },
    { type: 'kan', tiles: tiles(['tong', 3, 0], ['tong', 3, 1], ['tong', 3, 2]) },
    { type: 'peng', tiles: tiles(['tong', 4, 0], ['tong', 4, 1], ['tong', 4, 2]) },
  ];
  const hand = tiles(['tiao', 3, 0], ['tiao', 5, 0]);
  const result = settleChaHu({
    seats: [
      { hand, exposed, winningDiscardId: hand[1]!.id, singleWaitChanged: false },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 3,
    ron: true,
    discardKey: hand[1]!.key,
    discarderSeat: 1,
  });

  assert.equal(result.baoZhuang?.reason, 'chow_wait_seq');
  assert.equal(result.seats[0]?.hu, 14);
  assert.equal(result.seats[0]?.piaoHun, false);
  assert.equal(result.hunDi, false);
  // 赢家14胡；对庄家的胡差为28，其余两家各14。1号包庄后代付56。
  assert.deepEqual(result.deltas, [56, -56, 0, 0]);
  assert.deepEqual(result.payables, [0, 56, 0, 0]);
  assert.deepEqual(result.receivables, [56, 0, 0, 0]);
  assertAccounting(result);
});

test('两对关门免包香；未关门时按全桌牌河区分香牌和臭牌', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'kan', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'ming-gang', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2], ['tiao', 4, 3]) },
  ];
  const hand = tiles(
    ['tong', 1, 0], ['tong', 1, 1], ['tong', 1, 2],
    ['tong', 2, 0], ['tong', 2, 1],
  );
  const base = { hand, exposed, ron: true, discardKey: 'tong-1' };

  // 1. 两对关门后，即使是生张也不触发包香。
  assert.equal(detectBaoZhuang({ ...base, closedTwoPair: true, discardedBeforeClose: [] }), null);
  // 2. 未关门且点炮牌为生张（香牌）：包庄。
  assert.equal(detectBaoZhuang({ ...base, closedTwoPair: false, discardedBeforeClose: [] }), 'xiang');
  // 3. 未关门但点炮牌为熟张（臭牌）：不包庄。
  assert.equal(detectBaoZhuang({ ...base, closedTwoPair: false, discardedBeforeClose: ['tong-1'] }), null);
});

test('无关点炮牌不能误触发三坎两对包香', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
  ];
  const hand = tiles(['tong', 1, 0], ['tong', 1, 1], ['tong', 2, 0], ['tong', 2, 1]);
  assert.equal(detectBaoZhuang({ hand, exposed, ron: true, discardKey: 'wan-9' }), null);
});

test('单钓听顺只有不换张才有包庄资格', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tong', 1, 0], ['tong', 1, 1], ['tong', 1, 2]) },
    { type: 'kan', tiles: tiles(['tong', 2, 0], ['tong', 2, 1], ['tong', 2, 2]) },
    { type: 'peng', tiles: tiles(['tong', 3, 0], ['tong', 3, 1], ['tong', 3, 2]) },
    { type: 'an-gang', tiles: tiles(['tong', 4, 0], ['tong', 4, 1], ['tong', 4, 2], ['tong', 4, 3]) },
  ];
  const hand = tiles(['tiao', 3, 0], ['tiao', 4, 0]);
  assert.equal(detectBaoZhuang({
    hand,
    exposed,
    ron: true,
    discardKey: 'tiao-4',
  }), 'four_wait_seq');
  assert.equal(detectBaoZhuang({
    hand,
    exposed,
    ron: true,
    discardKey: 'tiao-4',
    singleWaitChanged: true,
  }), null);
});

test('流局不结算', () => {
  const result = settleChaHu({
    seats: [emptySeat(), emptySeat(), emptySeat(), emptySeat()],
    winnerSeat: null,
    dealer: 0,
    drawReason: 'four_same',
  });
  assert.deepEqual(result.deltas, [0, 0, 0, 0]);
});

test('顺子相邻或隔一张可成包庄听口', () => {
  assert.equal(canFormSequence('tiao-3', 'tiao-4'), true);
  assert.equal(canFormSequence('tiao-3', 'tiao-5'), true);
  assert.equal(canFormSequence('tiao-3', 'tiao-7'), false);
  assert.equal(canFormSequence('tiao-3', 'tong-4'), false);
  assert.equal(canFormSequence('dragon-1', 'dragon-2'), false);
});

test('起手四张可杠', () => {
  assert.equal(hasOpeningKong(tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2], ['dragon', 1, 3], ['wan', 1, 0])), 'dragon-1');
  assert.equal(hasOpeningKong(tiles(['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2])), null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HUN_DI, makeTile, type Meld, type Tile } from '@pizhou/shared';
import {
  canFormSequence,
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

test('吃不算；没胡的人散对不算', () => {
  const units = extractUnits(
    tiles(['tiao', 5, 0], ['tiao', 5, 1]),
    [
      { type: 'chi', tiles: tiles(['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0]) },
      { type: 'peng', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) },
    ],
    false,
  );
  assert.equal(units.some((item) => item.kind === 'peng'), true);
  assert.equal(units.some((item) => item.kind === 'pair'), false);
});

test('没胡的人只有吃和散对时是 0 胡', () => {
  const units = extractUnits(
    tiles(
      ['tiao', 2, 0], ['tiao', 2, 1],
      ['wan', 7, 0], ['wan', 7, 1],
      ['wan', 9, 0], ['wan', 9, 1],
    ),
    [{ type: 'chi', tiles: tiles(['tiao', 3, 0], ['tiao', 4, 0], ['tiao', 5, 0]) }],
    false,
  );
  assert.deepEqual(units, []);
});

test('胡牌的人计将和暗刻，落地碰算碰', () => {
  const units = extractUnits(
    tiles(['wan', 9, 0], ['wan', 9, 1]),
    [{ type: 'peng', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) }],
    true,
  );
  assert.ok(units.some((item) => item.key === 'wan-9' && item.kind === 'pair'));
  assert.ok(units.some((item) => item.key === 'dragon-1' && item.kind === 'peng'));
});

test('基础平胡：10胡 + 对子1胡', () => {
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

test('胡牌拆出的暗刻计坎：幺头坎4胡1幺，普通坎2胡，对子2胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2],
    ['tong', 2, 0], ['tong', 2, 1], ['tong', 2, 2],
    ['tiao', 4, 0], ['tiao', 5, 0], ['tiao', 6, 0],
    ['wan', 3, 0], ['wan', 4, 0], ['wan', 5, 0],
    ['dragon', 1, 0], ['dragon', 1, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  // 10 + 一万坎4 + 二筒坎2 + 红中对2 = 18胡，1幺
  assert.equal(result.huBeforeDealer, 18);
  assert.equal(result.yao, 1);
});

test('庄家基础胡数平等计算（不直接翻倍），两两结账时差胡翻倍', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2],
    ['tong', 2, 0], ['tong', 3, 0], ['tong', 4, 0],
    ['tiao', 5, 0], ['tiao', 6, 0], ['tiao', 7, 0],
    ['wan', 6, 0], ['wan', 7, 0], ['wan', 8, 0],
    ['tiao', 9, 0], ['tiao', 9, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: true, winType: 'ping-hu' });
  assert.ok(result);
  // 10 + 一万坎4 + 九条对2 = 16胡，1幺；基础胡数平等为16
  assert.equal(result.huBeforeDealer, 16);
  assert.equal(result.yao, 1);
  assert.equal(result.dealerMultiplier, 2);
  assert.equal(result.hu, 16);

  // 查胡两两结：庄家(16胡1幺) vs 闲家A(0胡0幺) vs 闲家B(0胡0幺) vs 闲家C(0胡0幺)
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

  // 庄 vs 闲A: 差胡 (16 - 0) * 2 = 32分, 差幺 (1 - 0) * 10 = 10分, 共 42分
  // 庄 vs 闲B: 42分
  // 庄 vs 闲C: 42分
  // 庄总应收 = 42 * 3 = 126
  assert.equal(settlement.deltas[0], 126);
  assert.equal(settlement.deltas[1], -42);
  assert.equal(settlement.deltas[2], -42);
  assert.equal(settlement.deltas[3], -42);
  assert.equal(settlement.transactions.length, 6);
});

test('点炮胡进来的第三张不能把手中对子升级成坎', () => {
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
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-1' && unit.kind === 'pair'), true);
  // 10 + 五筒对1 + 一条对2 = 13胡，0幺
  assert.equal(winner.huBeforeDealer, 13);
  assert.equal(winner.yao, 0);
});

test('自摸第三张成坎', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
    ['tong', 5, 0], ['tong', 5, 1],
    ['tiao', 1, 0], ['tiao', 1, 1], ['tiao', 1, 2],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  // 10 + 五筒对1 + 一条坎4(1幺) = 15胡，1幺
  assert.equal(result.huBeforeDealer, 15);
  assert.equal(result.yao, 1);
});

test('锁定坎按坎计分：普通坎2胡，幺头坎4胡1幺', () => {
  const ordinaryTiles = tiles(['tong', 5, 0], ['tong', 5, 1], ['tong', 5, 2]);
  const yaoTiles = tiles(['tiao', 1, 0], ['tiao', 1, 1], ['tiao', 1, 2]);
  const ordinary = extractUnits([], [{ type: 'kan', tiles: ordinaryTiles }], false);
  const yao = extractUnits([], [{ type: 'kan', tiles: yaoTiles }], false);
  assert.deepEqual(unitValue(ordinary[0]!.key, ordinary[0]!.kind), { hu: 2, yao: 0 });
  assert.deepEqual(unitValue(yao[0]!.key, yao[0]!.kind), { hu: 4, yao: 1 });
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
  // 10 + 红中碰2 + 三条对1 = 13胡，0幺
  assert.equal(result.huBeforeDealer, 13);
  assert.equal(result.yao, 0);
});

test('庄家闲家轮庄：闲家胡则顺时针，流局或庄家胡则连庄，四同张下庄', () => {
  assert.equal(nextDealer(0, 2, false), 1);
  assert.equal(nextDealer(0, 0, false), 0);
  assert.equal(nextDealer(2, null, true), 2);
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
  // 10 + 红中自杠12(3幺) + 三条对1 = 23胡，3幺
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
  // 10 + 一万明杠8 + 发财暗杠12 + 三条对1 = 31胡，5幺
  assert.equal(result.huBeforeDealer, 31);
  assert.equal(result.yao, 5);
});

test('飘荤：四坎一张，胡翻倍并收荤底', () => {
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
  assert.ok((result.deltas[0] ?? 0) >= HUN_DI * 3);
});

test('查胡两两结：没胡的人只有主动坎和杠算，散牌不算', () => {
  const result = settleChaHu({
    seats: [
      {
        hand: tiles(
          ['dragon', 2, 0], ['dragon', 2, 1], ['dragon', 2, 2],
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
  // 没胡：发财坎 4胡1幺
  assert.equal(result.seats[0]?.hu, 4);
  assert.equal(result.seats[0]?.yao, 1);
  // 胡牌：10 + 八筒对1 = 11胡
  assert.equal(result.seats[1]?.huBeforeDealer, 11);
});

test('查胡两两结：没胡的庄家散对是 0 胡', () => {
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
  assert.equal(result.seats[0]?.hu, 0);
  assert.equal(result.seats[0]?.yao, 0);
  assert.equal(result.deltas.reduce((sum, n) => sum + n, 0), 0);
});

test('包庄：三坎两对香牌点炮', () => {
  const exposed: Meld[] = [
    { type: 'peng', tiles: tiles(['tiao', 2, 0], ['tiao', 2, 1], ['tiao', 2, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 3, 0], ['tiao', 3, 1], ['tiao', 3, 2]) },
    { type: 'peng', tiles: tiles(['tiao', 4, 0], ['tiao', 4, 1], ['tiao', 4, 2]) },
  ];
  const hand = tiles(['tong', 1, 0], ['tong', 1, 1], ['tong', 2, 0], ['tong', 2, 1]);
  const result = settleChaHu({
    seats: [
      { hand, exposed, changed: false, closedTwoPair: false, discardedBeforeClose: [] },
      emptySeat(),
      emptySeat(),
      emptySeat(),
    ],
    winnerSeat: 0,
    dealer: 1,
    ron: true,
    discardKey: 'wan-9',
    discarderSeat: 2,
  });
  assert.ok(result.baoZhuang);
  assert.equal(result.baoZhuang?.reason, 'xiang');
  assert.equal(result.baoZhuang?.payerSeat, 2);
  assert.equal(result.seats[0]?.piaoHun, true);
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

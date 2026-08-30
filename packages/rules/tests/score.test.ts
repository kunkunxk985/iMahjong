import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HUN_DI,
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
  assert.deepEqual(unitValue('dragon-1', 'peng'), { hu: 2, yao: 0 });
  assert.deepEqual(unitValue('dragon-1', 'pung'), { hu: 4, yao: 1 });
  assert.deepEqual(unitValue('dragon-1', 'song_kong'), { hu: 8, yao: 2 });
  assert.deepEqual(unitValue('dragon-1', 'zi_kong'), { hu: 12, yao: 3 });
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

test('胡牌将牌不计分，落地碰算碰', () => {
  const units = extractUnits(
    tiles(['wan', 9, 0], ['wan', 9, 1]),
    [{ type: 'peng', tiles: tiles(['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2]) }],
    true,
  );
  assert.ok(units.some((item) => item.key === 'dragon-1' && item.kind === 'peng'));
});

test('基础平胡：暗手将牌不计分，只加10胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0],
    ['tiao', 2, 0], ['tiao', 3, 0], ['tiao', 4, 0],
    ['tong', 5, 0], ['tong', 5, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  assert.equal(result.huBeforeDealer, 10);
  assert.equal(result.yao, 0);
  assert.equal(result.hu, 10);
});

test('未主动坎上的暗刻和暗手将牌都不计胡', () => {
  const concealed = tiles(
    ['wan', 1, 0], ['wan', 1, 1], ['wan', 1, 2],
    ['tong', 2, 0], ['tong', 2, 1], ['tong', 2, 2],
    ['tiao', 4, 0], ['tiao', 5, 0], ['tiao', 6, 0],
    ['wan', 3, 0], ['wan', 4, 0], ['wan', 5, 0],
    ['dragon', 1, 0], ['dragon', 1, 1],
  );
  const result = scoreWin({ concealed, exposed: [], isDealer: false, winType: 'ping-hu' });
  assert.ok(result);
  // 未主动坎上的三张不计，暗手红中将牌也不计，只剩胡牌基础10胡。
  assert.equal(result.huBeforeDealer, 10);
  assert.equal(result.yao, 0);
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
  // 未主动坎上的一万不计，九条将牌也不计，只剩胡牌基础10胡。
  assert.equal(result.huBeforeDealer, 10);
  assert.equal(result.yao, 0);
  assert.equal(result.dealerMultiplier, 2);
  assert.equal(result.hu, 10);

  // 查胡两两结：庄家(10胡0幺) vs 闲家A(0胡0幺) vs 闲家B(0胡0幺) vs 闲家C(0胡0幺)
  const settlement = settleChaHu({
    seats: [
      { hand: concealed, exposed: [] }, // 庄家 10胡 0幺
      { hand: tiles(['wan', 1, 0]), exposed: [{ type: 'chi', tiles: tiles(['wan', 2, 0], ['wan', 3, 0], ['wan', 4, 0]) }] }, // 闲家A: 0胡 0幺
      emptySeat(), // 闲家B: 0胡 0幺
      emptySeat(), // 闲家C: 0胡 0幺
    ],
    winnerSeat: 0,
    dealer: 0,
  });

  // 庄 vs 闲家：差胡 10 * 2 = 20 分，庄总应收 = 20 * 3 = 60
  assert.equal(settlement.deltas[0], 60);
  assert.equal(settlement.deltas[1], -20);
  assert.equal(settlement.deltas[2], -20);
  assert.equal(settlement.deltas[3], -20);
  assert.equal(settlement.transactions.length, 6);
});

test('点炮双碰：点炮形成碰，另一个对子不计分', () => {
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
  // 五筒对子不计分，只算一条幺牌碰：10 + 2 = 12胡，0幺
  assert.equal(winner.huBeforeDealer, 12);
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
  assert.equal(winner.hu, 11);
  assert.equal(winner.yao, 0);
  const discarderTransaction = result.transactions.find(
    (tx) => tx.seatA === 0 && tx.seatB === 1,
  )!;
  // 胡家 11 胡、点炮家 0 胡；不因点炮额外翻倍。
  assert.equal(discarderTransaction.deltaHu, 11);
  assert.equal(discarderTransaction.deltaYao, 0);
  assert.equal(discarderTransaction.points, 11 * HU_RATE);
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

test('点炮胡时，未主动坎上的手牌刻子不计胡', () => {
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
  // 白板只是暗手将牌，不生成计分项。
  // 九条没有主动坎上，不计坎
  assert.equal(winner.units.some((unit) => unit.key === 'tiao-9' && unit.kind === 'pung'), false);
  // 10(胡牌) + 一万幺牌碰(2) = 12胡, 0幺
  assert.equal(winner.huBeforeDealer, 12);
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
  const winningTile = concealed.at(-1)!;
  const result = scoreWin({
    concealed,
    exposed: [],
    isDealer: false,
    winType: 'ping-hu',
    winningTileId: winningTile.id,
  });
  assert.ok(result);
  // 自摸双碰只算自摸形成的一条幺牌坎，五筒对子不计：10 + 4 = 14胡，1幺
  assert.equal(result.huBeforeDealer, 14);
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
  assert.equal(result.hu, 12);
  assert.equal(result.yao, 0);
});

test('单钓自摸可以胡，但最后补成的对子不计对子胡', () => {
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
  assert.equal(ordinary.huBeforeDealer, 10);
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
  assert.equal(yao.huBeforeDealer, 10);
  assert.equal(yao.yao, 0);

  const ronUnits = extractUnits(ordinaryPair, exposed, true, ordinaryPair[1]!.id);
  assert.equal(ronUnits.some((unit) => unit.key === 'tong-5'), false);
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
  // 10 + 红中碰2；三条将牌不计 = 12胡，0幺
  assert.equal(result.huBeforeDealer, 12);
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
  // 10 + 红中自杠12(3幺)；三条将牌不计 = 22胡，3幺
  assert.equal(result.huBeforeDealer, 10 + 12);
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
  // 10 + 一万明杠8 + 发财暗杠12；三条将牌不计 = 30胡，5幺
  assert.equal(result.huBeforeDealer, 30);
  assert.equal(result.yao, 5);

  const ziGangResult = scoreWin({
    concealed,
    exposed: [exposed[0]!, { ...exposed[1]!, type: 'zi-gang' }],
    isDealer: false,
    winType: 'ping-hu',
  });
  assert.ok(ziGangResult);
  assert.equal(ziGangResult.huBeforeDealer, 30);
  assert.equal(ziGangResult.yao, 5);
});

test('飘荤：四坎一张，牌面胡数固定，结算胡差翻倍并收荤底', () => {
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
  assertAccounting(result);
});

test('飘荤与庄家只翻结算胡差，牌面胡和幺差不翻倍', () => {
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
  assert.equal(nonDealerTx.piaoMultiplier, 2);
  assert.equal(nonDealerTx.isDealerPair, false);
  assert.equal(nonDealerTx.deltaHu, (17 - 6) * 2);
  assert.equal(nonDealerTx.deltaYao, 1);
  assert.equal(nonDealerTx.points, (17 - 6) * 2 * HU_RATE + YAO_RATE);

  const dealerResult = settleChaHu({ seats, winnerSeat: 0, dealer: 1 });
  const dealerTx = dealerResult.transactions.find(
    (tx) => tx.seatA === 0 && tx.seatB === 1,
  )!;
  assert.equal(dealerTx.piaoMultiplier, 2);
  assert.equal(dealerTx.isDealerPair, true);
  assert.equal(dealerTx.deltaHu, (17 - 6) * 2 * 2);
  assert.equal(dealerTx.deltaYao, 1);
  assert.equal(dealerTx.points, (17 - 6) * 2 * 2 * HU_RATE + YAO_RATE);
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
      { hand, exposed, winningDiscardId: hand[2]!.id, closedTwoPair: true },
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
  assert.equal(winner.huBeforeDealer, 10 + 3 + 1);
  assert.equal(winner.yao, 0);
  assert.equal(winner.units.some((unit) => unit.key === 'tong-6'), false);
  assert.equal(winner.units.some((unit) => unit.key === 'tong-5' && unit.kind === 'peng'), true);
});

test('四组牌单钓自摸按飘荤结算，最后对子不计胡', () => {
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
  assert.equal(winner.huBeforeDealer, 10 + 4);
  assert.equal(winner.yao, 0);
  assert.equal(winner.units.length, 4);
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
  // 胡牌：八筒将牌不计，只加基础10胡。
  assert.equal(result.seats[1]?.huBeforeDealer, 10);
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
  // 赢家 15 胡：与庄家 1 号胡差×飘×庄=60，其余两家各30；另有三家荤底共90。
  // 2号包庄后独付 60+30+30+90=210，另外两家不再向胡家付款。
  assert.deepEqual(result.deltas, [210, 0, -210, 0]);
  assert.deepEqual(result.payables, [0, 0, 210, 0]);
  assert.deepEqual(result.receivables, [210, 0, 0, 0]);
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
  // 普通两家各14，庄家一对关系28；1号包庄后合计代付56。
  assert.deepEqual(result.deltas, [56, -56, 0, 0]);
  assert.deepEqual(result.payables, [0, 56, 0, 0]);
  assert.deepEqual(result.receivables, [56, 0, 0, 0]);
  assertAccounting(result);
});

test('关门免包香；未关门时按全桌关门前牌河区分香牌和臭牌', () => {
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

  assert.equal(detectBaoZhuang({ ...base, closedTwoPair: false, discardedBeforeClose: [] }), 'xiang');
  assert.equal(detectBaoZhuang({ ...base, closedTwoPair: false, discardedBeforeClose: ['tong-1'] }), null);
  assert.equal(detectBaoZhuang({ ...base, closedTwoPair: true, discardedBeforeClose: [] }), null);
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

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeTile, type AvailableAction, type PublicPlayerView, type Tile } from '@pizhou/shared';
import {
  chooseCompanionAction,
  companionThinkMs,
  discardScore,
  pickDiscard,
} from '../src/companion.ts';
import { calculateShanten, calculateTileAcceptance } from '../src/shanten.ts';
import { assessDiscardDanger, isTableInHighDefenseState } from '../src/defense.ts';
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
    singleWaitChanged: false,
  };
}

function mockPlayer(options: Partial<PublicPlayerView> & { seat: number }): PublicPlayerView {
  return {
    seat: options.seat,
    nickname: options.nickname ?? `Player${options.seat}`,
    avatar: options.avatar ?? 'avatar.png',
    ready: true,
    online: true,
    isHost: options.seat === 0,
    isDealer: options.seat === 0,
    closed: options.closed ?? false,
    score: 0,
    handCount: options.handCount ?? 13,
    discards: options.discards ?? [],
    melds: options.melds ?? [],
  };
}

// ----------------------------------------------------------------------------
// 1. Existing Baseline Tests (preserved for backward compatibility)
// ----------------------------------------------------------------------------

test('陪练优先打孤张幺九，留住对子', () => {
  const isolated = makeTile('dragon', 1, 0);
  const pairA = makeTile('wan', 5, 0);
  const pairB = makeTile('wan', 5, 1);
  const connected = makeTile('tiao', 3, 0);
  const connected2 = makeTile('tiao', 4, 0);
  const picked = pickDiscard([isolated, pairA, pairB, connected, connected2]);
  assert.equal(picked?.id, isolated.id);
});

test('discardScore 孤张与顺子保留权重正常', () => {
  const dragon = makeTile('dragon', 1, 0);
  const wan3 = makeTile('wan', 3, 0);
  const wan4 = makeTile('wan', 4, 0);
  assert.ok(discardScore(dragon, [dragon, wan3, wan4]) < discardScore(wan3, [dragon, wan3, wan4]));
});

test('isTableInHighDefenseState 正确识别关门与三副露危险状态', () => {
  const normal = mockPlayer({ seat: 1, closed: false });
  assert.equal(isTableInHighDefenseState([normal]), false);
  const closed = mockPlayer({ seat: 1, closed: true });
  assert.equal(isTableInHighDefenseState([closed]), true);
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

// ----------------------------------------------------------------------------
// 2. Shanten Search Tests (calculateShanten)
// ----------------------------------------------------------------------------

test('Shanten 搜索：标准4面子1雀头完整胡牌状态为 -1 向听', () => {
  // 14 tiles: 123w, 456w, 789w, 123t, 55s
  const hand: Tile[] = [
    makeTile('wan', 1, 0), makeTile('wan', 2, 0), makeTile('wan', 3, 0),
    makeTile('wan', 4, 0), makeTile('wan', 5, 0), makeTile('wan', 6, 0),
    makeTile('wan', 7, 0), makeTile('wan', 8, 0), makeTile('wan', 9, 0),
    makeTile('tong', 1, 0), makeTile('tong', 2, 0), makeTile('tong', 3, 0),
    makeTile('tiao', 5, 0), makeTile('tiao', 5, 1),
  ];
  const res = calculateShanten(hand, 0);
  assert.equal(res.shanten, -1);
});

test('Shanten 搜索：标准听牌（0向听）并准确给出听牌等牌', () => {
  // 13 tiles: 123w, 456w, 789w, 12t, 55s -> waiting for 3t
  const hand: Tile[] = [
    makeTile('wan', 1, 0), makeTile('wan', 2, 0), makeTile('wan', 3, 0),
    makeTile('wan', 4, 0), makeTile('wan', 5, 0), makeTile('wan', 6, 0),
    makeTile('wan', 7, 0), makeTile('wan', 8, 0), makeTile('wan', 9, 0),
    makeTile('tong', 1, 0), makeTile('tong', 2, 0),
    makeTile('tiao', 5, 0), makeTile('tiao', 5, 1),
  ];
  const res = calculateShanten(hand, 0);
  assert.equal(res.shanten, 0);
  assert.equal(res.waits.length, 1);
  assert.equal(res.waits[0]!.key, 'tong-3');
});

test('Shanten 搜索：一向听与两向听计算准确', () => {
  // 1-shanten: 123w, 456w, 12t, 45s, 99s (13 tiles, two open-ended taatsus)
  const oneShanten: Tile[] = [
    makeTile('wan', 1, 0), makeTile('wan', 2, 0), makeTile('wan', 3, 0),
    makeTile('wan', 4, 0), makeTile('wan', 5, 0), makeTile('wan', 6, 0),
    makeTile('tong', 1, 0), makeTile('tong', 2, 0),
    makeTile('tiao', 4, 0), makeTile('tiao', 5, 0),
    makeTile('tiao', 9, 0), makeTile('tiao', 9, 1),
    makeTile('dragon', 1, 0), // isolated
  ];
  const res1 = calculateShanten(oneShanten, 0);
  assert.equal(res1.shanten, 1);
});

test('Shanten 搜索：邳州特色三副露手牌两对（关门听牌）为 0 向听且等两张牌', () => {
  // 3 exposed melds, 4 concealed tiles: 11w, 55t
  const hand: Tile[] = [
    makeTile('wan', 1, 0), makeTile('wan', 1, 1),
    makeTile('tiao', 5, 0), makeTile('tiao', 5, 1),
  ];
  const res = calculateShanten(hand, 3);
  assert.equal(res.shanten, 0);
  const waitKeys = res.waits.map((w) => w.key).sort();
  assert.deepEqual(waitKeys, ['tiao-5', 'wan-1']);
});

test('Shanten 搜索：邳州特色四副露单钓为 0 向听且等单钓将牌', () => {
  // 4 exposed melds, 1 tile: 3t
  const hand: Tile[] = [makeTile('tiao', 3, 0)];
  const res = calculateShanten(hand, 4);
  assert.equal(res.shanten, 0);
  assert.equal(res.waits.length, 1);
  assert.equal(res.waits[0]!.key, 'tiao-3');
});

// ----------------------------------------------------------------------------
// 3. Tile Acceptance Tests (calculateTileAcceptance)
// ----------------------------------------------------------------------------

test('有效进张：两面搭子进张数（8张）显著高于嵌张搭子（4张）', () => {
  // Hand with a choice between keeping two-sided (34t -> waits 2t, 5t = 8 tiles)
  // vs keeping inside wait (35w -> waits 4w = 4 tiles)
  // Hand: 111w, 35w (kanchan), 34t (ryanmen), 88t (pair) -> 10 tiles (1 exposed meld)
  const hand: Tile[] = [
    makeTile('wan', 1, 0), makeTile('wan', 1, 1), makeTile('wan', 1, 2),
    makeTile('wan', 3, 0), makeTile('wan', 5, 0),
    makeTile('tiao', 3, 0), makeTile('tiao', 4, 0),
    makeTile('tiao', 8, 0), makeTile('tiao', 8, 1),
    makeTile('dragon', 1, 0), // isolated dragon to discard
  ];
  const res = calculateTileAcceptance(hand, 1, []);
  assert.ok(res.bestDiscards.length > 0);
  // Best discard should be the isolated dragon
  assert.equal(res.bestDiscards[0]!.tile.key, 'dragon-1');
  assert.equal(res.bestDiscards[0]!.nextShanten, 1);
  // Total acceptance after discarding dragon-1 includes 2t, 5t (8 tiles) + 4w (4 tiles) = 12 tiles
  assert.equal(res.bestDiscards[0]!.acceptance, 12);
});

test('有效进张：结合全桌牌河死牌准确削减进张数', () => {
  const hand: Tile[] = [
    makeTile('wan', 1, 0), makeTile('wan', 1, 1), makeTile('wan', 1, 2),
    makeTile('wan', 3, 0), makeTile('wan', 5, 0),
    makeTile('tiao', 3, 0), makeTile('tiao', 4, 0),
    makeTile('tiao', 8, 0), makeTile('tiao', 8, 1),
    makeTile('dragon', 1, 0),
  ];
  // 4w is already seen 3 times in discards river!
  const riverDiscards = [
    makeTile('wan', 4, 0),
    makeTile('wan', 4, 1),
    makeTile('wan', 4, 2),
  ];
  const res = calculateTileAcceptance(hand, 1, riverDiscards);
  const best = res.bestDiscards[0]!;
  assert.equal(best.tile.key, 'dragon-1');
  // 4w has only 1 remaining copy instead of 4, so total acceptance is 8 (2t, 5t) + 1 (4w) = 9
  assert.equal(best.acceptance, 9);
});

// ----------------------------------------------------------------------------
// 4. Defense & Threat Perception Tests (assessDiscardDanger)
// ----------------------------------------------------------------------------

test('防守危险度：对手自身打过的现物（Genbutsu）为绝对安全牌（0分）', () => {
  const closedOpp = mockPlayer({
    seat: 1,
    closed: true,
    discards: [makeTile('wan', 5, 0), makeTile('tong', 2, 0)],
  });
  const evalGenbutsu = assessDiscardDanger(
    makeTile('wan', 5, 1),
    [closedOpp],
    [makeTile('wan', 5, 0)],
  );
  assert.equal(evalGenbutsu.dangerScore, 0);
  assert.ok(evalGenbutsu.reason.includes('安全'));
});

test('防守危险度：全桌已见4张的绝张为全桌绝对安全（0分）', () => {
  const closedOpp = mockPlayer({ seat: 2, closed: true });
  const allDiscards = [
    makeTile('dragon', 1, 0),
    makeTile('dragon', 1, 1),
    makeTile('dragon', 1, 2),
    makeTile('dragon', 1, 3),
  ];
  const evalDead = assessDiscardDanger(makeTile('dragon', 1, 0), [closedOpp], allDiscards);
  assert.equal(evalDead.dangerScore, 0);
});

test('防守危险度：对手三副露未关门时，未见生张香牌危险度定为 100（防包香包庄）', () => {
  const threePkOpp = mockPlayer({
    seat: 3,
    closed: false,
    handCount: 4,
    melds: [
      { type: 'peng', tiles: [makeTile('wan', 1, 0), makeTile('wan', 1, 1), makeTile('wan', 1, 2)] },
      { type: 'kan', tiles: [makeTile('tong', 3, 0), makeTile('tong', 3, 1), makeTile('tong', 3, 2)] },
      { type: 'peng', tiles: [makeTile('tiao', 7, 0), makeTile('tiao', 7, 1), makeTile('tiao', 7, 2)] },
    ],
  });
  const rawTile = makeTile('dragon', 2, 0); // Unseen raw dragon
  const riverDiscards = [makeTile('wan', 2, 0), makeTile('tong', 5, 0)];
  const evalRaw = assessDiscardDanger(rawTile, [threePkOpp], riverDiscards);
  assert.equal(evalRaw.dangerScore, 100);
  assert.ok(evalRaw.reason.includes('包香'));
});

test('防守危险度：牌河已见臭牌可免除包香，危险度显著下降', () => {
  const threePkOpp = mockPlayer({
    seat: 3,
    closed: false,
    handCount: 4,
    melds: [
      { type: 'peng', tiles: [makeTile('wan', 1, 0), makeTile('wan', 1, 1), makeTile('wan', 1, 2)] },
      { type: 'kan', tiles: [makeTile('tong', 3, 0), makeTile('tong', 3, 1), makeTile('tong', 3, 2)] },
      { type: 'peng', tiles: [makeTile('tiao', 7, 0), makeTile('tiao', 7, 1), makeTile('tiao', 7, 2)] },
    ],
  });
  const foulTile = makeTile('wan', 8, 0);
  const riverDiscards = [makeTile('wan', 8, 1)]; // Already in river!
  const evalFoul = assessDiscardDanger(foulTile, [threePkOpp], riverDiscards);
  assert.ok(evalFoul.dangerScore <= 20);
  assert.ok(evalFoul.reason.includes('免除') || evalFoul.reason.includes('臭牌'));
});

test('防守弃牌选择：高危局面下（弃胡防守），AI 优先打出现物/安全牌而非生张', () => {
  const closedOpp = mockPlayer({
    seat: 1,
    closed: true,
    discards: [makeTile('tiao', 1, 0)],
  });
  // Bot has 2-shanten hand: isolated raw dragon vs genbutsu 1t
  const safeGenbutsu = makeTile('tiao', 1, 1);
  const dangerousRaw = makeTile('dragon', 3, 0);
  const hand: Tile[] = [
    safeGenbutsu,
    dangerousRaw,
    makeTile('wan', 2, 0), makeTile('wan', 4, 0),
    makeTile('tong', 6, 0), makeTile('tong', 8, 0),
  ];
  const picked = pickDiscard(hand, undefined, {
    publicViews: [closedOpp],
    allDiscards: [makeTile('tiao', 1, 0)],
  });
  // Bot should choose the 100% safe genbutsu instead of dropping raw dragon into closed opponent
  assert.equal(picked?.id, safeGenbutsu.id);
});

// ----------------------------------------------------------------------------
// 5. Tactical Decision Logic Tests (Chi, Peng, Guanmen)
// ----------------------------------------------------------------------------

test('战术鸣牌：吃牌破坏关门与飘荤，未听牌时不盲目吃牌', () => {
  const mySeat = seat([
    makeTile('wan', 1, 0), makeTile('wan', 1, 1),
    makeTile('wan', 3, 0), makeTile('wan', 4, 0),
    makeTile('tiao', 8, 0), makeTile('tiao', 9, 0),
  ]);
  // Opponent discards 2w, offering chi [1w, 2w, 3w] or [2w, 3w, 4w]
  const chiAction: AvailableAction = {
    kind: 'chi',
    tileIds: [mySeat.hand[2]!.id, mySeat.hand[3]!.id],
    tiles: [mySeat.hand[2]!, mySeat.hand[3]!, makeTile('wan', 2, 0)],
  };
  const action = chooseCompanionAction([chiAction, { kind: 'pass' }], mySeat, () => 0.5);
  // Should pass chi to preserve Guanmen & PiaoHun potential
  assert.equal(action?.kind, 'pass');
});

test('战术关门：两对等牌存活充足时主动关门锁定', () => {
  const mySeat: SeatRuntime = {
    ...seat(),
    melds: [
      { type: 'peng', tiles: [makeTile('wan', 1, 0), makeTile('wan', 1, 1), makeTile('wan', 1, 2)] },
      { type: 'kan', tiles: [makeTile('tong', 2, 0), makeTile('tong', 2, 1), makeTile('tong', 2, 2)] },
      { type: 'peng', tiles: [makeTile('tiao', 3, 0), makeTile('tiao', 3, 1), makeTile('tiao', 3, 2)] },
    ],
    // Hand has 5 tiles: 44w, 88t, and 9w (discard 9w to guanmen)
    hand: [
      makeTile('wan', 4, 0), makeTile('wan', 4, 1),
      makeTile('tiao', 8, 0), makeTile('tiao', 8, 1),
      makeTile('wan', 9, 0),
    ],
  };
  const closeGateAction: AvailableAction = {
    kind: 'close-gate',
    tileIds: [mySeat.hand[4]!.id],
  };
  const action = chooseCompanionAction([closeGateAction, { kind: 'discard' }], mySeat, () => 0.1);
  assert.equal(action?.kind, 'close-gate');
  assert.equal(action?.tileId, mySeat.hand[4]!.id);
});

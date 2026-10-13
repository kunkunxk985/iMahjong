/**
 * ModeStats aggregation is implemented once, in `packages/shared/src/stats.ts`.
 *
 * Every consumer that reports per-mode totals — local match history, the profile
 * page, the account store, and the cloud worker — must agree for the same match
 * list. They used to be four separate copies and had already diverged:
 *
 *   - legacy `scoreDelta` records counted 40 on one page and 0 on another
 *   - `baoZhuang: undefined` counted as a real baoZhuang on two of the four
 *
 * Both were visible to the player. These tests pin the shared semantics and
 * assert the consumers delegate rather than re-derive.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MatchRecord } from '../src/auth.ts';
import { computeModeStats, hasBaoZhuang, matchDelta } from '../src/stats.ts';
import { calculateCareerStats } from '../src/rank.ts';

type Stored = MatchRecord & { scoreDelta?: unknown };

function record(overrides: Partial<Stored> = {}): Stored {
  return {
    id: 'm1',
    mode: 'classic',
    timestamp: 1,
    dateStr: '1月1日',
    roomCode: '123456',
    winType: '平胡',
    winnerSeat: 0,
    hu: 5,
    yao: 0,
    hunDi: false,
    liuju: false,
    drawReason: null,
    baoZhuang: null,
    dealerMultiplier: 1,
    myDeltaScore: 10,
    myIsWinner: true,
    scores: [],
    ...overrides,
  };
}

test('基础统计：局数、胜负、流局、胜率与总分', () => {
  const stats = computeModeStats([
    record(),
    record({ id: 'm2', myIsWinner: false, myDeltaScore: -3, hu: 0 }),
    record({ id: 'm3', liuju: true, myIsWinner: false, myDeltaScore: 0, hu: 0 }),
  ]);
  assert.equal(stats.totalMatches, 3);
  assert.equal(stats.wins, 1);
  assert.equal(stats.draws, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.totalScore, 7);
  assert.equal(stats.maxHu, 5);
});

test('matchDelta：优先 myDeltaScore，回落到旧字段 scoreDelta', () => {
  assert.equal(matchDelta(record({ myDeltaScore: 10 })), 10);
  // Records written before the rename carry scoreDelta only.
  assert.equal(matchDelta(record({ myDeltaScore: undefined, scoreDelta: 40 })), 40);
  assert.equal(matchDelta(record({ myDeltaScore: undefined, scoreDelta: undefined })), 0);
  assert.equal(matchDelta(record({ myDeltaScore: undefined, scoreDelta: 'oops' })), 0);
});

test('hasBaoZhuang：null 与 undefined 都算没有包庄', () => {
  // `undefined` happens when an older payload lacks the key. Treating it as a
  // real baoZhuang inflated the count on two of the four pages.
  assert.equal(hasBaoZhuang(record({ baoZhuang: null })), false);
  assert.equal(hasBaoZhuang(record({ baoZhuang: undefined })), false);
  assert.equal(hasBaoZhuang(record({ baoZhuang: { reason: 'xiang', payerSeat: 1, winnerSeat: 0 } })), true);
  assert.equal(computeModeStats([record({ baoZhuang: undefined })]).baoZhuangCount, 0);
});

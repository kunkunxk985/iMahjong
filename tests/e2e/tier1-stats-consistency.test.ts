/**
 * Cross-consumer consistency for ModeStats.
 *
 * Lives in the root suite because it deliberately reaches across package
 * boundaries — the point is that shared, local history, and career stats all
 * report the same numbers. This is the guard that the four-way copy used to
 * need: they diverged on legacy `scoreDelta` records and on `baoZhuang`
 * being `undefined`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MatchRecord } from '@pizhou/shared';
import { computeModeStats } from '@pizhou/shared';
import { calculateStats } from '../../apps/desktop/src/storage/history.ts';
import { calculateCareerStats } from '../../packages/shared/src/rank.ts';

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

test('战绩统计：所有消费方对同一份记录给出一致结果', () => {
  const scenarios: Array<[string, Stored[]]> = [
    ['普通局', [record(), record({ id: 'm2', myIsWinner: false, myDeltaScore: -3, hu: 0 })]],
    ['旧字段 scoreDelta', [record({ myDeltaScore: undefined, scoreDelta: 40 })]],
    ['baoZhuang 为 undefined', [record({ baoZhuang: undefined })]],
    ['流局', [record({ liuju: true, myIsWinner: false, myDeltaScore: 0, hu: 0 })]],
    ['空列表', []],
  ];

  const sharedKeys = [
    'totalMatches', 'wins', 'draws', 'losses', 'totalScore', 'maxHu',
    'piaoHunCount', 'baoZhuangCount',
  ] as const;

  for (const [label, records] of scenarios) {
    const implementations = [
      computeModeStats(records),
      calculateStats(records as MatchRecord[]),
      calculateCareerStats(records as MatchRecord[]),
    ];
    for (const key of sharedKeys) {
      const values = implementations.map((impl) => (impl as Record<string, number>)[key]);
      assert.deepEqual(
        new Set(values).size,
        1,
        `${label}: ${key} 不一致 -> ${values.join(', ')}`,
      );
    }
  }
});

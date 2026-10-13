import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LeaderboardEntry } from '@pizhou/shared';

test('leaderboard sorting preserves tie breakers and does not mutate input', async () => {
  const model = await import('../src/components/profile/profileModel.ts');
  assert.equal(typeof model.sortLeaderboard, 'function', 'sorting policy must be independently testable');
  const first = { userId: 'a', totalScore: 10, wins: 1, winRate: 50, totalMatches: 2, maxWinScore: 8 } as LeaderboardEntry;
  const second = { userId: 'b', totalScore: 10, wins: 2, winRate: 50, totalMatches: 3, maxWinScore: 8 } as LeaderboardEntry;
  const entries = [first, second];
  for (const mode of ['score', 'winRate', 'matches'] as const) {
    assert.deepEqual(model.sortLeaderboard(entries, mode).map((entry) => entry.userId), ['b', 'a']);
  }
  assert.deepEqual(model.sortLeaderboard(entries, 'maxWin'), [first, second]);
  assert.deepEqual(entries, [first, second]);
});

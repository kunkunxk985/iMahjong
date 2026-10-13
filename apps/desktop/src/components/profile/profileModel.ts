import type { LeaderboardEntry } from '@pizhou/shared';

export type LeaderboardSort = 'score' | 'winRate' | 'matches' | 'maxWin';

export function sortLeaderboard(entries: readonly LeaderboardEntry[], sort: LeaderboardSort): LeaderboardEntry[] {
  const list = [...entries];
  if (sort === 'score') {
    list.sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins);
  } else if (sort === 'winRate') {
    list.sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches);
  } else if (sort === 'matches') {
    list.sort((a, b) => b.totalMatches - a.totalMatches || b.wins - a.wins);
  } else if (sort === 'maxWin') {
    list.sort((a, b) => b.maxWinScore - a.maxWinScore || b.totalScore - a.totalScore);
  }
  return list;
}

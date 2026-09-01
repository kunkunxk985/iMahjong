import type { GameMode, MatchPlayerScore, MatchRecord, ModeStats } from '@pizhou/shared';

export type { MatchPlayerScore, MatchRecord };

const HISTORY_STORAGE_KEY = 'pizhou_match_history_v2';

export function getMatchHistory(mode?: GameMode): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Fallback for older records without mode
        const normalized: MatchRecord[] = parsed.map((item) => ({
          ...item,
          mode: item.mode || (item.roomCode === '单机练习' || !item.roomCode ? 'local' : 'online'),
          myDeltaScore: item.myDeltaScore ?? 0,
          myIsWinner: item.myIsWinner ?? false,
        }));
        if (mode) {
          return normalized.filter((r) => r.mode === mode);
        }
        return normalized;
      }
    }
  } catch {}
  return [];
}

export function calculateStats(records: MatchRecord[]): ModeStats {
  const totalMatches = records.length;
  const wins = records.filter((m) => m.myIsWinner).length;
  const draws = records.filter((m) => m.liuju).length;
  const losses = totalMatches - wins - draws;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
  const totalScore = records.reduce((acc, m) => acc + (m.myDeltaScore || 0), 0);
  const maxHu = records.reduce((acc, m) => Math.max(acc, m.hu || 0), 0);
  const piaoHunCount = records.filter((m) => m.hunDi).length;
  const baoZhuangCount = records.filter((m) => m.baoZhuang !== null).length;

  return {
    totalMatches,
    wins,
    draws,
    losses,
    winRate,
    totalScore,
    maxHu,
    piaoHunCount,
    baoZhuangCount,
  };
}

export function saveMatchToHistory(record: MatchRecord): void {
  try {
    const current = getMatchHistory();
    // Keep up to 60 most recent matches locally
    const updated = [record, ...current.filter((r) => r.id !== record.id)].slice(0, 60);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearMatchHistory(mode?: GameMode): void {
  try {
    if (!mode) {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } else {
      const current = getMatchHistory();
      const kept = current.filter((r) => r.mode !== mode);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(kept));
    }
  } catch {}
}

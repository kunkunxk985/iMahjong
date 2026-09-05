import type { GameMode, MatchPlayerScore, MatchRecord, ModeStats } from '@pizhou/shared';
import { getStoredAuth } from '../api/auth.ts';

export type { MatchPlayerScore, MatchRecord };

export function getHistoryStorageKey(userId?: string): string {
  const resolved = (userId || getStoredAuth().user?.userId || '').trim();
  return resolved ? `pizhou_match_history_v2_${resolved}` : 'pizhou_match_history_v2_guest';
}

export function getMatchHistory(mode?: GameMode, userId?: string): MatchRecord[] {
  try {
    const key = getHistoryStorageKey(userId);
    const raw = localStorage.getItem(key);
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

export function saveMatchToHistory(record: MatchRecord, userId?: string): void {
  try {
    const resolvedUserId = (userId || record.userId || getStoredAuth().user?.userId || '').trim();
    if (resolvedUserId && !record.userId) {
      record.userId = resolvedUserId;
    }
    const current = getMatchHistory(undefined, resolvedUserId || undefined);
    // Keep up to 60 most recent matches locally
    const updated = [record, ...current.filter((r) => r.id !== record.id)].slice(0, 60);
    const key = getHistoryStorageKey(resolvedUserId || undefined);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}
}

export function clearMatchHistory(mode?: GameMode, userId?: string): void {
  try {
    const key = getHistoryStorageKey(userId);
    if (!mode) {
      localStorage.removeItem(key);
    } else {
      const current = getMatchHistory(undefined, userId);
      const kept = current.filter((r) => r.mode !== mode);
      localStorage.setItem(key, JSON.stringify(kept));
    }
  } catch {}
}

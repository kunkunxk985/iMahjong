import type { GameMode, MatchPlayerScore, MatchRecord } from '@pizhou/shared';
import { computeModeStats } from '@pizhou/shared';
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

/**
 * Local-history aggregation.
 *
 * Delegates to the shared implementation so the match-history page and the
 * profile page report identical numbers for the same matches. The local copy
 * diverged in two ways that were both visible to the player:
 *   - `myDeltaScore || 0` ignored legacy `scoreDelta` records (they counted 0)
 *   - `baoZhuang !== null` counted `undefined` as a real baoZhuang
 */
export const calculateStats = computeModeStats;

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

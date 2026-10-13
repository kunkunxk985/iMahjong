/**
 * Single source of truth for per-mode match statistics.
 *
 * This aggregation used to be implemented four times — server-core
 * (`accountStore.ts`), the worker (`db.ts`), local history (`storage/history.ts`)
 * and career stats (`rank.ts`). The copies had already diverged:
 *
 *   - `totalScore`: only one path honoured the legacy `scoreDelta` field for old
 *     records, so the same match counted 40 on one page and 0 on another.
 *   - `baoZhuangCount`: two copies used `!== null`, which counts `undefined` as a
 *     real baoZhuang. A record with no baoZhuang scored 1 instead of 0.
 *
 * Both are user-visible: the same match list produced different totals depending
 * on which page rendered it. Keep this module as the only implementation.
 */
import type { MatchRecord, ModeStats } from './auth.ts';

/** A record as it may actually arrive from storage, including legacy fields. */
type StoredMatch = MatchRecord & {
  /** Renamed to `myDeltaScore`; still present in older stored records. */
  scoreDelta?: unknown;
};

/**
 * The record's score for one seat.
 *
 * `myDeltaScore` is authoritative. `scoreDelta` is kept as a fallback because
 * records written before the rename are still on disk and in cloud storage;
 * dropping it silently zeroes those matches' contribution to the total.
 */
export function matchDelta(match: StoredMatch): number {
  if (Number.isFinite(match.myDeltaScore)) return match.myDeltaScore;
  // `scoreDelta` came off disk/JSON, so it is genuinely unknown-typed here.
  const legacy = Number(match.scoreDelta);
  return Number.isFinite(legacy) ? legacy : 0;
}

/**
 * Whether this match involved a baoZhuang.
 *
 * Must treat `undefined` as "none": the field is `BaoZhuang | null`, but records
 * deserialized from older payloads can be missing the key entirely. A plain
 * `!== null` check counts those as a real baoZhuang.
 */
export function hasBaoZhuang(match: StoredMatch): boolean {
  return match.baoZhuang !== null && match.baoZhuang !== undefined;
}

/** Aggregate a match list into the shared ModeStats shape. */
export function computeModeStats<T extends StoredMatch>(matches: readonly T[]): ModeStats {
  const totalMatches = matches.length;
  const wins = matches.filter((m) => Boolean(m.myIsWinner)).length;
  const draws = matches.filter((m) => Boolean(m.liuju)).length;

  return {
    totalMatches,
    wins,
    draws,
    losses: totalMatches - wins - draws,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0,
    totalScore: matches.reduce((acc, m) => acc + matchDelta(m), 0),
    maxHu: matches.reduce((acc, m) => acc + Math.max(0, Number.isFinite(m.hu) ? m.hu : 0), 0),
    piaoHunCount: matches.filter((m) => Boolean(m.hunDi)).length,
    baoZhuangCount: matches.filter((m) => hasBaoZhuang(m)).length,
  };
}

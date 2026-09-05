import {
  isYaoJiu,
  type AvailableAction,
  type GameAction,
  type Meld,
  type PublicPlayerView,
  type Tile,
} from '@pizhou/shared';
import { calculateShanten, calculateTileAcceptance, type DiscardAcceptance } from './shanten.ts';
import { assessDiscardDanger, isTableInHighDefenseState } from './defense.ts';
import type { SeatRuntime } from './types.ts';

export interface CompanionContext {
  publicViews?: PublicPlayerView[];
  allDiscards?: Tile[];
  currentSeat?: number;
  humanBusy?: boolean;
}

export interface PickDiscardOptions {
  publicViews?: PublicPlayerView[];
  allDiscards?: Tile[];
  melds?: Meld[];
  seatIndex?: number;
}

export interface CompanionTimingContext {
  decisionType?: 'tsumogiri' | 'defense' | 'guanmen' | 'normal';
}

function countKeys(hand: Tile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of hand) counts.set(tile.key, (counts.get(tile.key) ?? 0) + 1);
  return counts;
}

function hasNeighbor(hand: Tile[], tile: Tile): boolean {
  if (tile.suit === 'dragon') return false;
  return hand.some(
    (item) =>
      item.id !== tile.id &&
      item.suit === tile.suit &&
      Math.abs(item.rank - tile.rank) <= 2,
  );
}

/**
 * Heuristic fallback score (lower = better to discard).
 * Retained for backwards-compatibility and tie-breaking.
 */
export function discardScore(tile: Tile, hand: Tile[]): number {
  const counts = countKeys(hand);
  const same = counts.get(tile.key) ?? 0;
  if (same >= 3) return 120;
  if (same === 2) return 70;
  if (hasNeighbor(hand, tile)) return 45;
  if (isYaoJiu(tile)) return 8;
  return 18;
}

/**
 * Discard selection algorithm combining:
 * 1. Shanten minimization & tile acceptance maximization
 * 2. Defense threat perception against closed door & 3-meld incense players
 * 3. Humanized tsumogiri preference on ties
 */
export function pickDiscard(
  hand: Tile[],
  lastDrawnId?: string,
  options?: PickDiscardOptions,
): Tile | null {
  if (hand.length === 0) return null;
  if (hand.length === 1) return hand[0]!;

  const melds = options?.melds ?? [];
  const allDiscards = options?.allDiscards ?? [];
  const publicViews = options?.publicViews ?? [];
  const seatIndex = options?.seatIndex;

  // 1. Calculate tile acceptance for each candidate discard
  const { bestDiscards } = calculateTileAcceptance(hand, melds, allDiscards);
  if (bestDiscards.length === 0) {
    // Fallback to heuristic score
    let best = hand[0]!;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const tile of hand) {
      let score = discardScore(tile, hand);
      if (tile.id === lastDrawnId) score -= 1;
      if (score < bestScore) {
        best = tile;
        bestScore = score;
      }
    }
    return best;
  }

  // Check table threat level (closed door or 3 pk melds)
  const isThreatened = isTableInHighDefenseState(publicViews, seatIndex);
  const minNextShanten = bestDiscards[0]!.nextShanten;

  // Evaluate defensive danger for each candidate
  interface ScoredCandidate {
    item: DiscardAcceptance;
    dangerScore: number;
    finalRating: number;
  }

  const scored: ScoredCandidate[] = bestDiscards.map((item) => {
    const danger = assessDiscardDanger(item.tile, publicViews, allDiscards).dangerScore;
    let rating = 0;

    if (minNextShanten <= 0) {
      // Full Attack (Tenpai): Maximize acceptance to win fast, but avoid suicidal 100-danger raw tiles
      if (item.nextShanten === 0) {
        rating = item.acceptance * 10 - danger * 0.5;
      } else {
        rating = -1000 - item.nextShanten * 100;
      }
    } else if (isThreatened && minNextShanten >= 2) {
      // Full Defense (Fold): Opponent is ready/closed and we are 2+ shanten away -> Minimize danger
      rating = -danger * 10 + item.acceptance * 0.1;
    } else {
      // Balanced Push-Fold: 1-shanten or moderate threat
      if (item.nextShanten === minNextShanten) {
        const dangerPenalty = isThreatened ? danger * 1.5 : danger * 0.5;
        rating = item.acceptance * 2 - dangerPenalty;
      } else {
        rating = -500 - item.nextShanten * 50 - danger;
      }
    }

    // Small bias to discard last drawn tile if it doesn't improve the hand
    if (item.tile.id === lastDrawnId) {
      rating += 0.5;
    }

    return { item, dangerScore: danger, finalRating: rating };
  });

  scored.sort((a, b) => b.finalRating - a.finalRating);
  return scored[0]!.item.tile;
}

/**
 * Milliseconds a companion should wait before acting.
 * Includes adaptive timing for tsumogiri, deep defensive thinking, and claim responses.
 */
export function companionThinkMs(
  phase: string,
  humanBusy: boolean,
  rng: () => number = Math.random,
  timingContext?: CompanionTimingContext,
): number {
  if (!timingContext) {
    // Backwards-compatible baseline timing matching existing unit tests
    if (phase === 'self-turn') return 1500 + Math.floor(rng() * 1000);
    if (humanBusy) return 2200 + Math.floor(rng() * 900);
    return 800 + Math.floor(rng() * 700);
  }

  if (humanBusy) {
    return 2000 + Math.floor(rng() * 800);
  }

  if (timingContext.decisionType === 'tsumogiri') {
    return 600 + Math.floor(rng() * 350);
  }
  if (timingContext.decisionType === 'defense') {
    return 1800 + Math.floor(rng() * 800);
  }
  if (timingContext.decisionType === 'guanmen') {
    return 1900 + Math.floor(rng() * 700);
  }

  if (phase === 'self-turn') {
    return 1300 + Math.floor(rng() * 700);
  }
  return 800 + Math.floor(rng() * 600);
}

/**
 * Check remaining copies of a tile key in the unrevealed deck.
 */
function remainingCopiesInWall(
  key: string,
  hand: Tile[],
  melds: Meld[],
  allDiscards: Tile[],
): number {
  let seen = 0;
  for (const t of hand) if (t.key === key) seen++;
  for (const m of melds) {
    for (const t of m.tiles) if (t.key === key) seen++;
  }
  for (const d of allDiscards) if (d.key === key) seen++;
  return Math.max(0, 4 - seen);
}

/**
 * Intelligent tactical decision-making for companion bots.
 */
export function chooseCompanionAction(
  actions: AvailableAction[],
  seat: SeatRuntime,
  rng: () => number = Math.random,
  context?: CompanionContext,
): GameAction | null {
  if (actions.length === 0) return null;

  const publicViews = context?.publicViews ?? [];
  const allDiscards = context?.allDiscards ?? seat.discards;

  // 1. Hu (Win)
  const hu = actions.find((item) => item.kind === 'hu');
  if (hu?.key === 'qidong-gang-hu') {
    if (actions.some((item) => item.kind === 'pass') && rng() < 0.72) {
      return { kind: 'pass' };
    }
    return { kind: 'hu', key: 'qidong-gang-hu' };
  }
  if (hu) return { kind: 'hu' };

  // 2. Concealed Kongs (An-gang & Zi-gang) - always declare to gain hu points and replacement
  const anGang = actions.find((item) => item.kind === 'an-gang');
  if (anGang) return { kind: 'an-gang', key: anGang.key, tileIds: anGang.tileIds };

  const ziGang = actions.find((item) => item.kind === 'zi-gang');
  if (ziGang) return { kind: 'zi-gang', key: ziGang.key, tileId: ziGang.tileId };

  // 3. Kan (Lock 暗坎) - evaluates if locking kan benefits PiaoHun / Guanmen
  const kan = actions.find((item) => item.kind === 'kan');
  if (kan) {
    const currentShanten = calculateShanten(seat.hand, seat.melds).shanten;
    const tilesToLock = kan.tileIds
      ? seat.hand.filter((t) => kan.tileIds!.includes(t.id))
      : [];
    const restHand = seat.hand.filter((t) => !tilesToLock.some((l) => l.id === t.id));
    const nextShanten = calculateShanten(restHand, seat.melds.length + 1).shanten;

    // Lock kan if it doesn't hurt shanten progression or has high PiaoHun potential
    if (nextShanten <= currentShanten || rng() < 0.85) {
      return { kind: 'kan', key: kan.key, tileIds: kan.tileIds };
    }
  }

  // 4. Melded Kong (Ming-gang)
  const mingGang = actions.find((item) => item.kind === 'ming-gang');
  if (mingGang && rng() < 0.85) {
    return { kind: 'ming-gang', key: mingGang.key, tileIds: mingGang.tileIds };
  }

  // 5. Peng (Pung) - evaluate Shanten advancement and Guanmen synergy
  const peng = actions.find((item) => item.kind === 'peng');
  if (peng && peng.key) {
    const currentShanten = calculateShanten(seat.hand, seat.melds).shanten;
    const pengTiles = seat.hand.filter((t) => t.key === peng.key).slice(0, 2);
    const restHand = seat.hand.filter((t) => !pengTiles.some((pt) => pt.id === t.id));
    const afterShanten = calculateShanten(restHand, seat.melds.length + 1).shanten;

    const sample = seat.hand.find((tile) => tile.key === peng.key);
    const isValuable = sample ? isYaoJiu(sample) : false;
    const isGuanmenTarget = seat.melds.every((m) => m.type !== 'chi') && seat.melds.length < 3;

    // Peng if it advances shanten, or maintains shanten with valuable Yaojiu / Guanmen potential
    if (
      afterShanten < currentShanten ||
      (afterShanten === currentShanten && (isValuable || isGuanmenTarget || rng() < 0.6))
    ) {
      return { kind: 'peng', key: peng.key, tileIds: peng.tileIds };
    }
  }

  // 6. Chi (Chow) - Strict tactical gate: Chi forfeits Guanmen & PiaoHun permanently!
  const chi = actions.find((item) => item.kind === 'chi');
  if (chi?.tileIds && chi.tiles) {
    const alreadyHasChi = seat.melds.some((m) => m.type === 'chi');
    const currentShanten = calculateShanten(seat.hand, seat.melds).shanten;
    const usedIds = new Set(chi.tileIds);
    const restHand = seat.hand.filter((t) => !usedIds.has(t.id));
    const afterShanten = calculateShanten(restHand, seat.melds.length + 1).shanten;

    // Only Chi if:
    // A. It immediately enters Tenpai (afterShanten <= 0) with healthy waits
    // B. Or the player already forfeited Guanmen (already has a chi) and it strictly advances shanten
    if (afterShanten <= 0 || (alreadyHasChi && afterShanten < currentShanten)) {
      return { kind: 'chi', tileIds: chi.tileIds };
    }
  }

  // 7. Guanmen (Close Gate) - check that the 2 wait pairs are alive (not dead tenpai)
  const closeGate = actions.find((item) => item.kind === 'close-gate');
  if (closeGate) {
    const tileIds = closeGate.tileIds;
    let chosenTileId = tileIds?.[0];

    if (tileIds && tileIds.length > 1) {
      // Pick discard among close gate options that minimizes danger
      let minDanger = 1000;
      for (const id of tileIds) {
        const candidate = seat.hand.find((t) => t.id === id);
        if (candidate) {
          const danger = assessDiscardDanger(candidate, publicViews, allDiscards).dangerScore;
          if (danger < minDanger) {
            minDanger = danger;
            chosenTileId = id;
          }
        }
      }
    }

    // Inspect the remaining pairs after this discard
    const remainingHand = chosenTileId
      ? seat.hand.filter((t) => t.id !== chosenTileId)
      : seat.hand;
    const counts = countKeys(remainingHand);
    const waitKeys: string[] = [];
    for (const [k, c] of counts.entries()) {
      if (c === 2) waitKeys.push(k);
    }

    let liveCopies = 0;
    for (const k of waitKeys) {
      liveCopies += remainingCopiesInWall(k, seat.hand, seat.melds, allDiscards);
    }

    // If wait tiles have at least 2 copies remaining in wall, declare Guanmen
    if (liveCopies >= 2 || rng() < 0.6) {
      return { kind: 'close-gate', tileId: chosenTileId };
    }
  }

  // 8. Discard - tactical discard selection
  if (actions.some((item) => item.kind === 'discard')) {
    const tile = pickDiscard(seat.hand, seat.lastDrawnId, {
      melds: seat.melds,
      allDiscards,
      publicViews,
      seatIndex: context?.currentSeat,
    });
    if (tile) return { kind: 'discard', tileId: tile.id };
  }

  // 9. Pass
  if (actions.some((item) => item.kind === 'pass')) return { kind: 'pass' };

  return null;
}

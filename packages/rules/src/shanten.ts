import {
  countKeys,
  makeTile,
  parseKey,
  type Meld,
  type Tile,
} from '@pizhou/shared';
import { canHuTiles } from './win.ts';
import { ALL_TILE_KEYS } from './tenpai.ts';


export interface ShantenResult {
  shanten: number;
  waits: Tile[];
}

export interface DiscardAcceptance {
  tile: Tile;
  acceptance: number;
  nextShanten: number;
  effectiveTiles: Tile[];
}

export interface TileAcceptanceResult {
  bestDiscards: DiscardAcceptance[];
}

interface SuitTuple {
  melds: number;
  taatsu: number;
  pair: boolean;
}

/**
 * Recursive search for non-dominated decompositions of a single numbered suit (wan, tong, tiao).
 */
function searchNumberedSuit(
  pos: number,
  counts: number[],
  m: number,
  t: number,
  pair: boolean,
  results: SuitTuple[],
): void {
  if (pos >= 9) {
    results.push({ melds: m, taatsu: t, pair });
    return;
  }
  if (counts[pos] === 0) {
    searchNumberedSuit(pos + 1, counts, m, t, pair, results);
    return;
  }

  // 1. Pung (3 identical tiles)
  if (counts[pos]! >= 3) {
    counts[pos]! -= 3;
    searchNumberedSuit(pos, counts, m + 1, t, pair, results);
    counts[pos]! += 3;
  }

  // 2. Chow (sequence pos, pos+1, pos+2)
  if (pos <= 6 && counts[pos + 1]! > 0 && counts[pos + 2]! > 0) {
    counts[pos]!--;
    counts[pos + 1]!--;
    counts[pos + 2]!--;
    searchNumberedSuit(pos, counts, m + 1, t, pair, results);
    counts[pos]!++;
    counts[pos + 1]!++;
    counts[pos + 2]!++;
  }

  // 3. Pair as head (雀头)
  if (!pair && counts[pos]! >= 2) {
    counts[pos]! -= 2;
    searchNumberedSuit(pos, counts, m, t, true, results);
    counts[pos]! += 2;
  }

  // 4. Pair as taatsu (搭子)
  if (counts[pos]! >= 2) {
    counts[pos]! -= 2;
    searchNumberedSuit(pos, counts, m, t + 1, pair, results);
    counts[pos]! += 2;
  }

  // 5. Chow taatsu (两面/边张 pos, pos+1)
  if (pos <= 7 && counts[pos + 1]! > 0) {
    counts[pos]!--;
    counts[pos + 1]!--;
    searchNumberedSuit(pos, counts, m, t + 1, pair, results);
    counts[pos]!++;
    counts[pos + 1]!++;
  }

  // 6. Chow taatsu (嵌张 pos, pos+2)
  if (pos <= 6 && counts[pos + 2]! > 0) {
    counts[pos]!--;
    counts[pos + 2]!--;
    searchNumberedSuit(pos, counts, m, t + 1, pair, results);
    counts[pos]!++;
    counts[pos + 2]!++;
  }

  // 7. Isolated tile (孤张)
  counts[pos]!--;
  searchNumberedSuit(pos, counts, m, t, pair, results);
  counts[pos]!++;
}

/**
 * Filter dominated tuples for a suit to keep only Pareto-optimal options.
 */
function pruneSuitTuples(tuples: SuitTuple[]): SuitTuple[] {
  const best: SuitTuple[] = [];
  for (const item of tuples) {
    let dominated = false;
    for (let i = 0; i < best.length; i++) {
      const existing = best[i]!;
      if (existing.pair === item.pair) {
        if (existing.melds >= item.melds && existing.taatsu >= item.taatsu) {
          dominated = true;
          break;
        }
        if (existing.melds <= item.melds && existing.taatsu <= item.taatsu) {
          best.splice(i, 1);
          i--;
        }
      }
    }
    if (!dominated) {
      best.push(item);
    }
  }
  return best;
}

function getNumberedSuitTuples(counts: number[]): SuitTuple[] {
  const sum = counts.reduce((acc, n) => acc + n, 0);
  if (sum === 0) return [{ melds: 0, taatsu: 0, pair: false }];
  const raw: SuitTuple[] = [];
  searchNumberedSuit(0, [...counts], 0, 0, false, raw);
  return pruneSuitTuples(raw);
}

function getDragonTuples(counts: number[]): SuitTuple[] {
  let pungs = 0;
  let pairs = 0;
  for (const c of counts) {
    if (c >= 3) {
      pungs++;
      if (c === 4) pairs += 0; // remaining 1 tile is isolated
    } else if (c === 2) {
      pairs++;
    }
  }
  if (pairs === 0) {
    return [{ melds: pungs, taatsu: 0, pair: false }];
  }
  return [
    { melds: pungs, taatsu: pairs - 1, pair: true },
    { melds: pungs, taatsu: pairs, pair: false },
  ];
}

/**
 * Pure Shanten search algorithm for Pizhou Mahjong.
 * Supports standard 4-meld 1-pair, Guanmen (2 pairs with 3 melds), and 4-meld single wait.
 * Returns shanten (-1 for agari/win, 0 for tenpai, >=1 for x-shanten) and winning wait tiles.
 */
export function calculateShanten(
  hand: Array<Pick<Tile, 'key' | 'suit' | 'rank' | 'id'>>,
  melds: Meld[] | number = 0,
): ShantenResult {
  const exposedCount = Array.isArray(melds) ? melds.length : melds;
  const targetMelds = 4 - exposedCount;

  if (targetMelds < 0) {
    return { shanten: 8, waits: [] };
  }

  // Special case: 4 exposed melds (single wait)
  if (targetMelds === 0) {
    if (hand.length === 1) {
      const { suit, rank } = parseKey(hand[0]!.key);
      return { shanten: 0, waits: [makeTile(suit, rank, 0)] };
    }
    if (hand.length === 2) {
      if (hand[0]!.key === hand[1]!.key) {
        return { shanten: -1, waits: [] };
      }
      return { shanten: 0, waits: [] };
    }
  }

  // Check if hand is already a winning hand (self-turn with 3k+2 tiles)
  if (hand.length === targetMelds * 3 + 2 && canHuTiles(hand, exposedCount)) {
    return { shanten: -1, waits: [] };
  }

  // Count tiles per suit
  const wan = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const tong = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const tiao = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dragon = [0, 0, 0];

  for (const t of hand) {
    const { suit, rank } = parseKey(t.key);
    if (suit === 'wan') wan[rank - 1]++;
    else if (suit === 'tong') tong[rank - 1]++;
    else if (suit === 'tiao') tiao[rank - 1]++;
    else if (suit === 'dragon') dragon[rank - 1]++;
  }

  const wanTuples = getNumberedSuitTuples(wan);
  const tongTuples = getNumberedSuitTuples(tong);
  const tiaoTuples = getNumberedSuitTuples(tiao);
  const dragonTuples = getDragonTuples(dragon);

  let minShanten = 8;

  for (const w of wanTuples) {
    for (const to of tongTuples) {
      for (const ti of tiaoTuples) {
        for (const d of dragonTuples) {
          const totalMelds = w.melds + to.melds + ti.melds + d.melds;
          let totalTaatsu = w.taatsu + to.taatsu + ti.taatsu + d.taatsu;
          const pairCount = (w.pair ? 1 : 0) + (to.pair ? 1 : 0) + (ti.pair ? 1 : 0) + (d.pair ? 1 : 0);

          let hasPair = 0;
          if (pairCount >= 1) {
            hasPair = 1;
            totalTaatsu += pairCount - 1; // Extra pairs act as taatsu
          }

          const neededMelds = Math.max(0, targetMelds - totalMelds);
          const effectiveTaatsu = Math.min(neededMelds, totalTaatsu);
          const s = 2 * neededMelds - effectiveTaatsu - hasPair;
          if (s < minShanten) {
            minShanten = s;
          }
        }
      }
    }
  }

  // Pizhou Closed Gate (Guanmen): 3 melds and 2 pairs in hand (4 tiles)
  if (exposedCount === 3 && hand.length === 4) {
    const counts = countKeys(hand);
    const pairKeys = Object.entries(counts).filter(([, count]) => count === 2).map(([k]) => k);
    if (pairKeys.length === 2) {
      minShanten = Math.min(minShanten, 0);
    }
  }

  // If tenpai (0-shanten) and hand length is (3k+1), find wait tiles using ground-truth canHuTiles
  const waits: Tile[] = [];
  if (minShanten === 0 && hand.length === targetMelds * 3 + 1) {
    for (const key of ALL_TILE_KEYS) {
      if (canHuTiles([...hand, { key }], exposedCount)) {
        const { suit, rank } = parseKey(key);
        waits.push(makeTile(suit, rank, 0));
      }
    }
  }

  return { shanten: minShanten, waits };
}

/**
 * Count how many copies of each tile key are already visible to this player:
 * in hand, in exposed melds, and in the discards river.
 */
function countVisibleKeys(
  hand: Array<Pick<Tile, 'key'>>,
  melds: Meld[] | number = 0,
  discards: Array<Pick<Tile, 'key'>> = [],
): Record<string, number> {
  const visible: Record<string, number> = {};
  const add = (k: string) => {
    visible[k] = (visible[k] ?? 0) + 1;
  };
  for (const t of hand) add(t.key);
  for (const t of discards) add(t.key);
  if (Array.isArray(melds)) {
    for (const m of melds) {
      for (const t of m.tiles) add(t.key);
    }
  }
  return visible;
}

/**
 * Calculates effective tile acceptance for each candidate discard in a self-turn hand.
 * Evaluates which discards minimize Shanten and maximize unrevealed tile draw opportunities.
 */
export function calculateTileAcceptance(
  hand: Tile[],
  melds: Meld[] | number = 0,
  discards: Array<Pick<Tile, 'key'>> = [],
): TileAcceptanceResult {
  if (hand.length === 0) {
    return { bestDiscards: [] };
  }

  const visible = countVisibleKeys(hand, melds, discards);
  const exposedCount = Array.isArray(melds) ? melds.length : melds;

  interface DiscardEval {
    acceptance: number;
    nextShanten: number;
    effectiveTiles: Tile[];
  }

  const keyEvalCache = new Map<string, DiscardEval>();
  const results: DiscardAcceptance[] = [];

  for (let i = 0; i < hand.length; i++) {
    const tile = hand[i]!;
    let evalResult = keyEvalCache.get(tile.key);

    if (!evalResult) {
      const rest = hand.filter((_, idx) => idx !== i);
      const baseResult = calculateShanten(rest, exposedCount);
      const nextShanten = baseResult.shanten;
      let acceptance = 0;
      const effectiveTiles: Tile[] = [];

      if (nextShanten === 0) {
        // Hand is in Tenpai: effective tiles are winning waits
        for (const wait of baseResult.waits) {
          const seen = visible[wait.key] ?? 0;
          const remaining = Math.max(0, 4 - seen);
          acceptance += remaining;
          effectiveTiles.push(wait);
        }
      } else {
        // Hand is in x-shanten: test which tile additions reduce shanten
        for (const testKey of ALL_TILE_KEYS) {
          const { suit, rank } = parseKey(testKey);
          const testTile = makeTile(suit, rank, 0);
          const testHand = [...rest, testTile];
          const res = calculateShanten(testHand, exposedCount);
          if (res.shanten < nextShanten) {
            const seen = visible[testKey] ?? 0;
            const remaining = Math.max(0, 4 - seen);
            acceptance += remaining;
            effectiveTiles.push(testTile);
          }
        }
      }

      evalResult = { acceptance, nextShanten, effectiveTiles };
      keyEvalCache.set(tile.key, evalResult);
    }

    results.push({
      tile,
      acceptance: evalResult.acceptance,
      nextShanten: evalResult.nextShanten,
      effectiveTiles: evalResult.effectiveTiles,
    });
  }

  // Sort best discards:
  // 1. Lowest nextShanten (closer to tenpai/win)
  // 2. Highest tile acceptance (more unrevealed winning/advancing tiles)
  results.sort((a, b) => {
    if (a.nextShanten !== b.nextShanten) {
      return a.nextShanten - b.nextShanten;
    }
    if (a.acceptance !== b.acceptance) {
      return b.acceptance - a.acceptance;
    }
    // Tie-breaker: prefer discarding honors or edge terminals if isolated
    const aIsDragon = a.tile.suit === 'dragon' ? 1 : 0;
    const bIsDragon = b.tile.suit === 'dragon' ? 1 : 0;
    return bIsDragon - aIsDragon;
  });

  return { bestDiscards: results };
}

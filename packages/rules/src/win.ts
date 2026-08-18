import {
  chowKeysFrom,
  type Tile,
  parseKey,
} from '@pizhou/shared';

export interface ConcealedMeld {
  type: 'chow' | 'pung';
  key: string;
  keys?: [string, string, string];
}

export interface WinDecomp {
  pairKey: string;
  melds: ConcealedMeld[];
}

function cloneCounts(counts: Record<string, number>): Record<string, number> {
  return { ...counts };
}

function firstPositiveKey(counts: Record<string, number>): string | null {
  const keys = Object.keys(counts).sort((a, b) => {
    const pa = parseKey(a);
    const pb = parseKey(b);
    if (pa.suit !== pb.suit) {
      const order = { wan: 0, tong: 1, tiao: 2, dragon: 3 };
      return order[pa.suit] - order[pb.suit];
    }
    return pa.rank - pb.rank;
  });
  for (const key of keys) {
    if ((counts[key] ?? 0) > 0) return key;
  }
  return null;
}

function searchMelds(
  counts: Record<string, number>,
  pairKey: string,
  acc: ConcealedMeld[],
  results: WinDecomp[],
): void {
  const key = firstPositiveKey(counts);
  if (!key) {
    results.push({ pairKey, melds: acc.map((m) => ({ ...m, keys: m.keys ? [...m.keys] as [string, string, string] : undefined })) });
    return;
  }

  if ((counts[key] ?? 0) >= 3) {
    counts[key] = (counts[key] ?? 0) - 3;
    acc.push({ type: 'pung', key });
    searchMelds(counts, pairKey, acc, results);
    acc.pop();
    counts[key] = (counts[key] ?? 0) + 3;
  }

  const chow = chowKeysFrom(key);
  if (chow && (counts[chow[0]] ?? 0) > 0 && (counts[chow[1]] ?? 0) > 0 && (counts[chow[2]] ?? 0) > 0) {
    counts[chow[0]] = (counts[chow[0]] ?? 0) - 1;
    counts[chow[1]] = (counts[chow[1]] ?? 0) - 1;
    counts[chow[2]] = (counts[chow[2]] ?? 0) - 1;
    acc.push({ type: 'chow', key, keys: chow });
    searchMelds(counts, pairKey, acc, results);
    acc.pop();
    counts[chow[0]] = (counts[chow[0]] ?? 0) + 1;
    counts[chow[1]] = (counts[chow[1]] ?? 0) + 1;
    counts[chow[2]] = (counts[chow[2]] ?? 0) + 1;
  }
}

export function toKeyCounts(tiles: Array<Pick<Tile, 'key'>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tile of tiles) {
    counts[tile.key] = (counts[tile.key] ?? 0) + 1;
  }
  return counts;
}

export function findWinDecompositions(tiles: Array<Pick<Tile, 'key'>>): WinDecomp[] {
  if (tiles.length % 3 !== 2) return [];
  const base = toKeyCounts(tiles);
  const results: WinDecomp[] = [];
  const seenPairs = new Set<string>();
  for (const pairKey of Object.keys(base)) {
    if ((base[pairKey] ?? 0) < 2 || seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const counts = cloneCounts(base);
    counts[pairKey] = (counts[pairKey] ?? 0) - 2;
    searchMelds(counts, pairKey, [], results);
  }
  return results;
}

export function canHuTiles(tiles: Array<Pick<Tile, 'key'>>, exposedMeldCount: number): boolean {
  const needMelds = 4 - exposedMeldCount;
  if (needMelds < 0) return false;
  const needTiles = needMelds * 3 + 2;
  if (tiles.length !== needTiles) return false;
  return findWinDecompositions(tiles).some((decomp) => decomp.melds.length === needMelds);
}

export function isSevenPairs(tiles: Array<Pick<Tile, 'key'>>): boolean {
  if (tiles.length !== 14) return false;
  const counts = toKeyCounts(tiles);
  return Object.values(counts).every((n) => n === 2) && Object.keys(counts).length === 7;
}

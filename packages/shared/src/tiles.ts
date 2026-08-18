export type Suit = 'wan' | 'tong' | 'tiao' | 'dragon';

export interface Tile {
  id: string;
  suit: Suit;
  rank: number;
  key: string;
}

const NUM_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const DRAGON_LABELS = ['中', '发', '白'];
const SUIT_LABELS: Record<Exclude<Suit, 'dragon'>, string> = {
  wan: '万',
  tong: '筒',
  tiao: '条',
};

export function makeKey(suit: Suit, rank: number): string {
  return `${suit}-${rank}`;
}

export function parseKey(key: string): { suit: Suit; rank: number } {
  const sep = key.lastIndexOf('-');
  const suit = key.slice(0, sep) as Suit;
  const rank = Number(key.slice(sep + 1));
  return { suit, rank };
}

export function makeTile(suit: Suit, rank: number, copy: number): Tile {
  const key = makeKey(suit, rank);
  return { id: `${key}-${copy}`, suit, rank, key };
}

export function createPizhouDeck(): Tile[] {
  const tiles: Tile[] = [];
  for (const suit of ['wan', 'tong', 'tiao'] as const) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push(makeTile(suit, rank, copy));
      }
    }
  }
  for (let rank = 1; rank <= 3; rank += 1) {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push(makeTile('dragon', rank, copy));
    }
  }
  return tiles;
}

export function shuffleTiles(tiles: Tile[], rng: () => number = Math.random): Tile[] {
  const next = tiles.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = next[i];
    next[i] = next[j]!;
    next[j] = tmp!;
  }
  return next;
}

export function isHonor(tile: Pick<Tile, 'suit'> | string): boolean {
  const suit = typeof tile === 'string' ? parseKey(tile).suit : tile.suit;
  return suit === 'dragon';
}

export function isYaoJiu(tile: Pick<Tile, 'suit' | 'rank'> | string): boolean {
  const parsed = typeof tile === 'string' ? parseKey(tile) : tile;
  if (parsed.suit === 'dragon') return true;
  return parsed.rank === 1 || parsed.rank === 9;
}

export function canFormChow(a: Pick<Tile, 'suit' | 'rank'>, b: Pick<Tile, 'suit' | 'rank'>, c: Pick<Tile, 'suit' | 'rank'>): boolean {
  if (a.suit === 'dragon' || b.suit === 'dragon' || c.suit === 'dragon') return false;
  if (a.suit !== b.suit || a.suit !== c.suit) return false;
  const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
  return ranks[0]! + 1 === ranks[1] && ranks[1]! + 1 === ranks[2];
}

export function chowKeysFrom(key: string): [string, string, string] | null {
  const { suit, rank } = parseKey(key);
  if (suit === 'dragon' || rank > 7) return null;
  return [makeKey(suit, rank), makeKey(suit, rank + 1), makeKey(suit, rank + 2)];
}

export function tileLabel(tile: Pick<Tile, 'suit' | 'rank'> | string): string {
  const parsed = typeof tile === 'string' ? parseKey(tile) : tile;
  if (parsed.suit === 'dragon') return DRAGON_LABELS[parsed.rank - 1] ?? '?';
  return `${NUM_LABELS[parsed.rank - 1] ?? '?'}${SUIT_LABELS[parsed.suit]}`;
}

export function suitOrder(suit: Suit): number {
  if (suit === 'wan') return 0;
  if (suit === 'tong') return 1;
  if (suit === 'tiao') return 2;
  return 3;
}

export function compareTiles(a: Tile, b: Tile): number {
  const suitDiff = suitOrder(a.suit) - suitOrder(b.suit);
  if (suitDiff !== 0) return suitDiff;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.id.localeCompare(b.id);
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return tiles.slice().sort(compareTiles);
}

export function countKeys(tiles: Array<Pick<Tile, 'key'>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tile of tiles) {
    counts[tile.key] = (counts[tile.key] ?? 0) + 1;
  }
  return counts;
}

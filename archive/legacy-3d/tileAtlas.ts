import type { Tile } from '@pizhou/shared';

export const TILE_W = 0.38;
export const TILE_H = 0.54;
export const TILE_D = 0.11;

export function faceUrl(tile: Pick<Tile, 'suit' | 'rank'>): string {
  return `./assets/tiles/${tile.suit}-${tile.rank}.png`;
}

export const BACK_URL = './assets/tile-back.png';
export const FELT_URL = './assets/felt.jpg';
export const WOOD_URL = './assets/wood.jpg';

export const FACE_URLS: Record<string, string> = Object.fromEntries([
  ...(['wan', 'tong', 'tiao'] as const).flatMap((suit) =>
    Array.from({ length: 9 }, (_, i) => {
      const rank = i + 1;
      return [`${suit}-${rank}`, `./assets/tiles/${suit}-${rank}.png`] as const;
    }),
  ),
  ...[1, 2, 3].map((rank) => [`dragon-${rank}`, `./assets/tiles/dragon-${rank}.png`] as const),
]);

export function relativeSeat(seat: number, me: number): number {
  return (seat - me + 4) % 4;
}

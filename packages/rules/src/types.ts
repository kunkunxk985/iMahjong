import type { Meld, Tile } from '@pizhou/shared';

export interface SeatRuntime {
  hand: Tile[];
  discards: Tile[];
  melds: Meld[];
  lastDrawnId?: string;
}

import type { Meld, Tile } from '@pizhou/shared';

export interface SeatRuntime {
  hand: Tile[];
  discards: Tile[];
  melds: Meld[];
  lastDrawnId?: string;
  firstDiscardKey?: string;
  changed: boolean;
  closed: boolean;
  closedTwoPair: boolean;
  discardedBeforeClose: string[];
  waitKey?: string;
}

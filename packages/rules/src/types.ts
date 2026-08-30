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
  closedTwoPairKeys: string[];
  discardedBeforeClose: string[];
  waitKey?: string;
  /** 四组单钓后是否换过手里的等牌；换过即不再满足“不换张”包庄条件。 */
  singleWaitChanged: boolean;
}

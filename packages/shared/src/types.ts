import type { Tile } from './tiles.ts';

export type SeatIndex = 0 | 1 | 2 | 3;

export type RoomPhase = 'lobby' | 'playing' | 'settlement';

export type GamePhase = 'qidong' | 'self-turn' | 'claim-window' | 'settlement';

export type MeldType = 'chi' | 'peng' | 'ming-gang' | 'an-gang' | 'bu-gang';

export type ActionKind =
  | 'discard'
  | 'chi'
  | 'peng'
  | 'ming-gang'
  | 'an-gang'
  | 'bu-gang'
  | 'hu'
  | 'pass';

export type WinType = 'ping-hu' | 'qidong-gang-hu' | 'liuju';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  fromSeat?: number;
  claimedTileId?: string;
}

export interface ScoreBreakdownItem {
  label: string;
  hu: number;
  yao: number;
}

export interface SettlementScore {
  seat: number;
  nickname: string;
  delta: number;
  total: number;
}

export interface Settlement {
  liuju: boolean;
  winnerSeat: number | null;
  winnerNickname: string | null;
  winType: WinType;
  hu: number;
  huBeforeDealer: number;
  yao: number;
  dealerMultiplier: number;
  selfDraw: boolean;
  breakdown: ScoreBreakdownItem[];
  scores: SettlementScore[];
}

export interface GameAction {
  kind: ActionKind;
  tileId?: string;
  tileIds?: string[];
  key?: string;
}

export interface AvailableAction {
  kind: ActionKind;
  key?: string;
  tileId?: string;
  tileIds?: string[];
  tiles?: Tile[];
}

export interface PublicPlayerView {
  seat: number;
  nickname: string;
  ready: boolean;
  online: boolean;
  isHost: boolean;
  isDealer: boolean;
  isBot?: boolean;
  score: number;
  handCount: number;
  discards: Tile[];
  melds: Meld[];
}

export interface PrivatePlayerView extends PublicPlayerView {
  hand: Tile[];
  lastDrawnId?: string;
}

export interface ClientView {
  sequence: number;
  roomCode: string;
  mySeat: number;
  token: string;
  phase: RoomPhase;
  gamePhase: GamePhase | null;
  dealer: number;
  currentSeat: number | null;
  wallCount: number;
  turnDeadline: number | null;
  lastDiscard: { tile: Tile; fromSeat: number } | null;
  players: Array<PublicPlayerView | PrivatePlayerView>;
  availableActions: AvailableAction[];
  settlement: Settlement | null;
  hostSeat: number;
  round: number;
  notice?: string;
}

export function isPrivatePlayerView(player: PublicPlayerView | PrivatePlayerView): player is PrivatePlayerView {
  return Array.isArray((player as PrivatePlayerView).hand);
}

import type { Tile } from './tiles.ts';

export type SeatIndex = 0 | 1 | 2 | 3;

export type RoomPhase = 'lobby' | 'playing' | 'settlement';

export type GamePhase = 'qidong' | 'self-turn' | 'claim-window' | 'settlement';

export type MeldType = 'chi' | 'peng' | 'kan' | 'ming-gang' | 'an-gang' | 'zi-gang';

export type ActionKind =
  | 'discard'
  | 'chi'
  | 'peng'
  | 'kan'
  | 'ming-gang'
  | 'an-gang'
  | 'zi-gang'
  | 'hu'
  | 'pass'
  | 'close-gate';

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
  hu: number;
  yao: number;
  fen: number;
  delta: number;
  total: number;
  piaoHun?: boolean;
  isWinner?: boolean;
  isDealer?: boolean;
  notes?: string[];
  receivable?: number;
  payable?: number;
}

export interface PairwiseTransaction {
  seatA: number;
  seatB: number;
  huA: number;
  huB: number;
  yaoA: number;
  yaoB: number;
  /** A 家牌面胡数的飘荤倍率；庄家倍率作用于涉及庄家的整笔胡差。 */
  huMultiplierA: number;
  /** B 家牌面胡数的飘荤倍率；庄家倍率作用于涉及庄家的整笔胡差。 */
  huMultiplierB: number;
  /** A 家先按飘荤折算、尚未应用庄家胡差倍率的胡数。 */
  effectiveHuA: number;
  /** B 家先按飘荤折算、尚未应用庄家胡差倍率的胡数。 */
  effectiveHuB: number;
  isDealerPair: boolean;
  /** 两家先查折算胡差，再在涉及庄家时整体乘 2。 */
  deltaHu: number;
  deltaYao: number;
  points: number;
}

export type BaoZhuangReason = 'four_wait_seq' | 'chow_wait_seq' | 'xiang';

export interface BaoZhuang {
  reason: BaoZhuangReason;
  payerSeat: number;
  winnerSeat: number;
}

export interface Settlement {
  liuju: boolean;
  winnerSeat: number | null;
  winnerNickname: string | null;
  winType: WinType;
  hu: number;
  huBeforeDealer: number;
  yao: number;
  /** 赢家是否为庄家对应的展示标记；庄家倍率实际作用于涉及庄家的胡差。 */
  dealerMultiplier: number;
  selfDraw: boolean;
  breakdown: ScoreBreakdownItem[];
  scores: SettlementScore[];
  transactions?: PairwiseTransaction[];
  hunDi: boolean;
  baoZhuang: BaoZhuang | null;
  drawReason: string | null;
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
  avatar: string;
  /** 账号资料中的牌桌头衔；旧客户端/旧快照缺失时由界面回退到默认头衔。 */
  title?: string;
  ready: boolean;
  online: boolean;
  isHost: boolean;
  isDealer: boolean;
  /** 单钓自动关门或两对主动关门，均对牌桌公开显示。 */
  closed: boolean;
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
  pointRate?: number;
  notice?: string;
}

export function isPrivatePlayerView(player: PublicPlayerView | PrivatePlayerView): player is PrivatePlayerView {
  return Array.isArray((player as PrivatePlayerView).hand);
}

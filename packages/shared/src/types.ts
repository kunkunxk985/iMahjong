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
  /** A 家牌面胡数对应的飘荤标记（兼容旧版流水字段），不直接修改 huA。 */
  huMultiplierA: number;
  /** B 家牌面胡数对应的飘荤标记（兼容旧版流水字段），不直接修改 huB。 */
  huMultiplierB: number;
  /** A 家牌面胡数的兼容展示别名；牌面胡数固定，不含任何结算倍率。 */
  effectiveHuA: number;
  /** B 家牌面胡数的兼容展示别名；牌面胡数固定，不含任何结算倍率。 */
  effectiveHuB: number;
  isDealerPair: boolean;
  /** 未应用飘荤和庄家倍率前的原始牌面胡差：huA - huB。 */
  rawDeltaHu: number;
  /** 本笔是否按飘荤结算；飘荤倍率作用在原始胡差之后。 */
  piaoMultiplier: number;
  /** 本笔是否涉及庄家；庄家倍率作用在飘荤结算胡差之后。 */
  dealerMultiplier: number;
  /** 两家先查原始胡差，再按本笔倍率结算。 */
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
  /** 账号资料中的个性签名 / 牌桌宣言；旧客户端/旧快照缺失时由界面回退。 */
  bio?: string;
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

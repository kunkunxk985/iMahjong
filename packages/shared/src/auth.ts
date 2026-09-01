export type GameMode = 'online' | 'local';

export type FriendPresenceStatus = 'online' | 'playing' | 'offline';

export interface UserProfile {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  title: string;
  bio: string;
  isGuest: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MatchPlayerScore {
  seat: number;
  nickname: string;
  score: number;
  isWinner: boolean;
  isDealer: boolean;
  notes?: string[];
}

export interface MatchRecord {
  id: string;
  userId?: string;
  mode: GameMode;
  timestamp: number;
  dateStr: string;
  roomCode: string;
  winType: string;
  winnerNickname?: string;
  winnerSeat: number | null;
  hu: number;
  yao: number;
  dealerMultiplier: number;
  hunDi: boolean;
  liuju: boolean;
  drawReason?: string;
  baoZhuang: { reason: string; payerSeat: number; winnerSeat: number } | null;
  myDeltaScore: number;
  myIsWinner: boolean;
  scores: MatchPlayerScore[];
}

export interface ModeStats {
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number; // 0..100
  totalScore: number;
  maxHu: number;
  piaoHunCount: number;
  baoZhuangCount: number;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface FriendItem {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  title: string;
  bio: string;
  status: FriendPresenceStatus;
  playingRoomCode?: string;
  addedAt: number;
}

export interface FriendRequestItem {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromNickname: string;
  fromAvatar: string;
  fromTitle: string;
  createdAt: number;
}

export interface FriendInvite {
  fromUserId: string;
  fromNickname: string;
  fromAvatar: string;
  roomCode: string;
  timestamp: number;
}

export interface UserSearchResult {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  title: string;
  isFriend: boolean;
  hasPendingRequest: boolean;
}

export const PRESET_AVATARS = [
  '🀄', '🐱', '👑', '🦊', '🐼', '🎭', '🦚', '🏮', '⚡', '🌟', '🐉', '🎋'
] as const;

export const PRESET_TITLES = [
  '初学雀友',
  '邳州雀友',
  '大蒜宗师',
  '起手杠狂魔',
  '单钓不换张',
  '包庄终结者',
  '运河雀圣',
  '千牌不倒',
] as const;

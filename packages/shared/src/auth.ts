import { NICKNAME_MAX } from './constants.ts';
import { sanitizeNickname } from './seats.ts';

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

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 6;
export const TITLE_MAX = 24;
export const BIO_MAX = 120;

export function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

export function isValidUsername(value: string): boolean {
  return (
    value.length >= USERNAME_MIN &&
    value.length <= USERNAME_MAX &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function sanitizeProfileText(raw: unknown, fallback: string, maxLength: number): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return value || fallback;
}

/**
 * Avatars are kept small enough to travel with the room snapshot. The desktop
 * client resizes uploaded images before saving them to the CF Durable Object.
 */
export const AVATAR_DATA_URL_MAX_LENGTH = 100_000;
export const DEFAULT_AVATAR = '🀄';

const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i;

export function isImageAvatar(value: string | null | undefined): boolean {
  return Boolean(
    value &&
      value.length <= AVATAR_DATA_URL_MAX_LENGTH &&
      AVATAR_DATA_URL_PATTERN.test(value),
  );
}

export const PRESET_AVATARS = [
  '🀄', '🐱', '👑', '🦊', '🐼', '🎭', '🦚', '🏮', '⚡', '🌟', '🐉', '🎋'
] as const;

export function sanitizeAvatar(raw: unknown, fallback = DEFAULT_AVATAR): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (PRESET_AVATARS.includes(value as (typeof PRESET_AVATARS)[number])) return value;
  return isImageAvatar(value) ? value : fallback;
}

export function sanitizeProfileNickname(raw: unknown, fallback = '雀友'): string {
  return typeof raw === 'string' ? sanitizeNickname(raw, fallback) : fallback.slice(0, NICKNAME_MAX);
}

export function sanitizeProfileTitle(raw: unknown, fallback = '初学雀友'): string {
  return sanitizeProfileText(raw, fallback, TITLE_MAX);
}

export function sanitizeProfileBio(raw: unknown, fallback = '不碰坎不上，单钓不换张！'): string {
  if (typeof raw !== 'string') return fallback;
  return raw.replace(/\s+/g, ' ').trim().slice(0, BIO_MAX);
}

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

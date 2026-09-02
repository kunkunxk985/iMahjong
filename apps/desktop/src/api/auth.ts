import {
  DEFAULT_AVATAR,
  DEFAULT_TITLE,
  sanitizeAvatar,
  sanitizeProfileBio,
  sanitizeProfileNickname,
  sanitizeProfileTitle,
} from '@pizhou/shared';
import type {
  AuthResponse,
  FriendItem,
  FriendRequestItem,
  GameMode,
  MatchRecord,
  ModeStats,
  UserProfile,
  UserSearchResult,
} from '@pizhou/shared';

const TOKEN_KEY = 'pizhou.auth_token_v1';
const USER_KEY = 'pizhou.auth_user_v1';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readApiResponse<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  const message = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : fallback;
  if (!res.ok) throw new ApiError(message, res.status);
  return data as T;
}

const AUTH_RESPONSE_FORMAT_ERROR =
  '账号服务返回的资料不完整，请先部署最新 CF Worker 后重试';

function normalizeUserProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<UserProfile>;
  const userId = typeof candidate.userId === 'string' ? candidate.userId.trim() : '';
  const username = typeof candidate.username === 'string' ? candidate.username.trim() : '';
  if (!userId || !username) return null;

  const createdAt =
    typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
      ? candidate.createdAt
      : Date.now();
  return {
    userId,
    username,
    nickname: sanitizeProfileNickname(candidate.nickname, username),
    avatar: sanitizeAvatar(candidate.avatar, DEFAULT_AVATAR),
    title: sanitizeProfileTitle(candidate.title, DEFAULT_TITLE),
    bio: sanitizeProfileBio(candidate.bio),
    isGuest: candidate.isGuest === true,
    createdAt,
    updatedAt:
      typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : createdAt,
  };
}

async function readAuthResponse(res: Response, fallback: string): Promise<AuthResponse> {
  const data = await readApiResponse<unknown>(res, fallback);
  if (!data || typeof data !== 'object') {
    throw new ApiError(`${fallback}：${AUTH_RESPONSE_FORMAT_ERROR}`, 502);
  }

  const candidate = data as { token?: unknown; user?: unknown };
  const token = typeof candidate.token === 'string' ? candidate.token.trim() : '';
  const user = normalizeUserProfile(candidate.user);
  if (!token || !user) {
    throw new ApiError(`${fallback}：${AUTH_RESPONSE_FORMAT_ERROR}`, 502);
  }
  return { token, user };
}

async function readUserResponse(res: Response, fallback: string): Promise<UserProfile> {
  const data = await readApiResponse<unknown>(res, fallback);
  const user =
    data && typeof data === 'object'
      ? normalizeUserProfile((data as { user?: unknown }).user)
      : null;
  if (!user) {
    throw new ApiError(`${fallback}：${AUTH_RESPONSE_FORMAT_ERROR}`, 502);
  }
  return user;
}

export function wsToHttpUrl(wsUrl: string): string {
  if (!wsUrl) return 'http://127.0.0.1:8787';
  let url = wsUrl.trim();
  if (url.startsWith('wss://')) {
    url = url.replace('wss://', 'https://');
  } else if (url.startsWith('ws://')) {
    url = url.replace('ws://', 'http://');
  }
  // Strip trailing slashes
  return url.replace(/\/+$/, '');
}

export function getStoredAuth(): { token: string | null; user: UserProfile | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (!token || !userRaw) return { token: null, user: null };
    const user = normalizeUserProfile(JSON.parse(userRaw));
    if (!user) {
      saveStoredAuth(null, null);
      return { token: null, user: null };
    }
    return { token, user };
  } catch {
    saveStoredAuth(null, null);
    return { token: null, user: null };
  }
}

export function saveStoredAuth(token: string | null, user: UserProfile | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

export async function apiGuestLogin(serverWsUrl: string, nickname?: string): Promise<AuthResponse> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  const data = await readAuthResponse(res, '游客登录失败');
  saveStoredAuth(data.token, data.user);
  return data;
}

export async function apiRegister(
  serverWsUrl: string,
  username: string,
  password: string,
  nickname?: string,
): Promise<AuthResponse> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, nickname }),
  });
  const data = await readAuthResponse(res, '注册失败');
  saveStoredAuth(data.token, data.user);
  return data;
}

export async function apiLogin(serverWsUrl: string, username: string, password: string): Promise<AuthResponse> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await readAuthResponse(res, '登录失败');
  saveStoredAuth(data.token, data.user);
  return data;
}

export async function apiUpgradeGuest(
  serverWsUrl: string,
  token: string,
  username: string,
  password: string,
  nickname?: string,
): Promise<AuthResponse> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/upgrade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password, nickname }),
  });
  const data = await readAuthResponse(res, '升级正式账号失败');
  saveStoredAuth(data.token, data.user);
  return data;
}

export async function apiChangePassword(
  serverWsUrl: string,
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResponse> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await readAuthResponse(res, '修改密码失败');
  saveStoredAuth(data.token, data.user);
  return data;
}

export async function apiLogout(serverWsUrl: string, token: string): Promise<void> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await readApiResponse<{ success: boolean }>(res, '退出登录失败');
}

export async function apiGetProfile(serverWsUrl: string, token: string): Promise<UserProfile> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/profile`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const user = await readUserResponse(res, '获取个人资料失败');
  saveStoredAuth(token, user);
  return user;
}

export async function apiUpdateProfile(
  serverWsUrl: string,
  token: string,
  payload: { nickname?: string; avatar?: string; title?: string; bio?: string },
): Promise<UserProfile> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const user = await readUserResponse(res, '更新个人资料失败');
  saveStoredAuth(token, user);
  return user;
}

export async function apiGetMatches(
  serverWsUrl: string,
  token: string,
  mode?: GameMode,
): Promise<{ matches: MatchRecord[]; stats: ModeStats }> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const url = mode ? `${httpUrl}/api/matches?mode=${mode}` : `${httpUrl}/api/matches`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return readApiResponse<{ matches: MatchRecord[]; stats: ModeStats }>(res, '获取战绩失败');
}

export async function apiSaveMatch(serverWsUrl: string, token: string, record: MatchRecord): Promise<void> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(record),
  });
  await readApiResponse<{ success: boolean }>(res, '同步战绩失败');
}

// ==========================================
// Friends API Client
// ==========================================

export async function apiSearchUsers(
  serverWsUrl: string,
  token: string,
  query: string,
): Promise<UserSearchResult[]> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await readApiResponse<{ results?: UserSearchResult[] }>(res, '搜索雀友失败');
  return (data.results || []) as UserSearchResult[];
}

export async function apiGetFriends(serverWsUrl: string, token: string): Promise<FriendItem[]> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/list`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await readApiResponse<{ friends?: FriendItem[] }>(res, '获取好友列表失败');
  return (data.friends || []) as FriendItem[];
}

export async function apiGetFriendRequests(serverWsUrl: string, token: string): Promise<FriendRequestItem[]> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/requests`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await readApiResponse<{ requests?: FriendRequestItem[] }>(res, '获取好友申请失败');
  return (data.requests || []) as FriendRequestItem[];
}

export async function apiSendFriendRequest(
  serverWsUrl: string,
  token: string,
  toUserId: string,
): Promise<void> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ toUserId }),
  });
  await readApiResponse<{ success: boolean }>(res, '发送好友申请失败');
}

export async function apiRespondFriendRequest(
  serverWsUrl: string,
  token: string,
  requestId: string,
  accept: boolean,
): Promise<void> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId, accept }),
  });
  await readApiResponse<{ success: boolean }>(res, '处理好友申请失败');
}

export async function apiDeleteFriend(serverWsUrl: string, token: string, friendId: string): Promise<void> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ friendId }),
  });
  await readApiResponse<{ success: boolean }>(res, '删除好友失败');
}

export async function apiGetFriendStats(
  serverWsUrl: string,
  token: string,
  friendId: string,
): Promise<{
  user: UserProfile;
  stats: ModeStats;
  recentMatches: MatchRecord[];
  status: string;
  playingRoomCode?: string;
}> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/friends/stats?friendId=${encodeURIComponent(friendId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return readApiResponse(res, '获取好友战绩失败');
}

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
    const user = userRaw ? (JSON.parse(userRaw) as UserProfile) : null;
    return { token, user };
  } catch {
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '游客登录失败');
  saveStoredAuth(data.token, data.user);
  return data as AuthResponse;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '注册失败');
  saveStoredAuth(data.token, data.user);
  return data as AuthResponse;
}

export async function apiLogin(serverWsUrl: string, username: string, password: string): Promise<AuthResponse> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '登录失败');
  saveStoredAuth(data.token, data.user);
  return data as AuthResponse;
}

export async function apiGetProfile(serverWsUrl: string, token: string): Promise<UserProfile> {
  const httpUrl = wsToHttpUrl(serverWsUrl);
  const res = await fetch(`${httpUrl}/api/profile`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '获取个人资料失败');
  saveStoredAuth(token, data.user);
  return data.user as UserProfile;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '更新个人资料失败');
  saveStoredAuth(token, data.user);
  return data.user as UserProfile;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '获取战绩失败');
  return data as { matches: MatchRecord[]; stats: ModeStats };
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
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '同步战绩失败');
  }
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '搜索雀友失败');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '获取好友列表失败');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '获取好友申请失败');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '发送好友申请失败');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '处理好友申请失败');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '删除好友失败');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '获取好友战绩失败');
  return data;
}

import type { AuthResponse, GameMode, MatchRecord, ModeStats, UserProfile } from '@pizhou/shared';

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

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_AVATAR,
  DEFAULT_TITLE,
  isValidUsername,
  normalizeUsername,
  PASSWORD_MIN,
  sanitizeAvatar,
  sanitizeProfileBio,
  sanitizeProfileNickname,
  sanitizeProfileTitle,
  USERNAME_MAX,
  USERNAME_MIN,
} from '@pizhou/shared';
import type {
  AuthResponse,
  GameMode,
  LeaderboardEntry,
  MatchRecord,
  ModeStats,
  UserProfile,
} from '@pizhou/shared';
import {
  generateId,
  generateToken,
  hashPassword,
  verifyPassword,
} from './password.ts';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  is_guest: number;
  created_at: number;
}

export interface ProfileRow {
  user_id: string;
  nickname: string;
  avatar: string;
  title: string;
  bio: string;
  updated_at: number;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  deviceInfo?: string;
}

export const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MAX_SESSIONS_PER_USER = 10;

export interface AccountStore {
  init(): Promise<void>;
  createGuest(nickname?: string): Promise<AuthResponse>;
  register(username: string, password: string, nickname?: string): Promise<AuthResponse | string>;
  login(username: string, password: string): Promise<AuthResponse | string>;
  upgradeGuest(userId: string, username: string, password: string, nickname?: string): Promise<AuthResponse | string>;
  renewSession(token: string): Promise<AuthResponse | null>;
  revokeToken(token: string): Promise<boolean>;
  revokeAllUserSessions(userId: string, exceptToken?: string): Promise<void>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResponse | string>;
  getUserByToken(token: string): Promise<UserRow | null>;
  getUserById(userId: string): Promise<UserRow | null>;
  getUserByUsername(username: string): Promise<UserRow | null>;
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null>;
  saveMatch(userId: string, record: MatchRecord): Promise<void>;
  getMatches(userId: string, mode?: GameMode, limit?: number): Promise<{ matches: MatchRecord[]; stats: ModeStats }>;
  getMatchesByUserId(userId: string, mode?: GameMode, limit?: number): Promise<{ matches: MatchRecord[]; stats: ModeStats }>;
  createUser(username: string, passwordHash: string, isGuest: boolean, nickname?: string): Promise<AuthResponse>;
  createSession(userId: string, deviceInfo?: string): Promise<SessionRecord>;
  getSessionByToken(token: string): Promise<SessionRecord | null>;
  deleteSession(token: string): Promise<boolean>;
  deleteUserSessionsExcept(userId: string, exceptToken?: string): Promise<void>;
  saveProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile | null>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
}

export function computeModeStats(matches: MatchRecord[]): ModeStats {
  const totalMatches = matches.length;
  const wins = matches.filter((m) => m.myIsWinner).length;
  const draws = matches.filter((m) => m.liuju).length;
  const losses = totalMatches - wins - draws;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
  const totalScore = matches.reduce((acc, m) => {
    const delta = Number.isFinite(m.myDeltaScore)
      ? m.myDeltaScore
      : (Number.isFinite((m as any).scoreDelta) ? (m as any).scoreDelta : 0);
    return acc + delta;
  }, 0);
  const maxHu = matches.reduce((acc, m) => Math.max(acc, Number.isFinite(m.hu) ? m.hu : 0), 0);
  const piaoHunCount = matches.filter((m) => m.hunDi).length;
  const baoZhuangCount = matches.filter((m) => m.baoZhuang !== null && m.baoZhuang !== undefined).length;

  return {
    totalMatches,
    wins,
    draws,
    losses,
    winRate,
    totalScore,
    maxHu,
    piaoHunCount,
    baoZhuangCount,
  };
}

export class MemoryAccountStore implements AccountStore {
  protected users = new Map<string, UserRow>(); // id -> UserRow
  protected profiles = new Map<string, ProfileRow>(); // user_id -> ProfileRow
  protected sessions = new Map<string, SessionRecord>(); // token -> SessionRecord
  protected matches: Array<MatchRecord & { userId: string }> = [];

  async init(): Promise<void> {
    // In-memory does not need I/O initialization
  }

  protected async onUsersChanged(): Promise<void> {}
  protected async onProfilesChanged(): Promise<void> {}
  protected async onSessionsChanged(): Promise<void> {}
  protected async onMatchesChanged(): Promise<void> {}

  async getUserById(userId: string): Promise<UserRow | null> {
    if (!userId) return null;
    return this.users.get(userId) ?? null;
  }

  async getUserByUsername(username: string): Promise<UserRow | null> {
    const clean = normalizeUsername(username).toLowerCase();
    if (!clean) return null;
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === clean) return u;
    }
    return null;
  }

  async getUserByToken(token: string): Promise<UserRow | null> {
    const session = await this.getSessionByToken(token);
    if (!session) return null;
    return this.getUserById(session.userId);
  }

  async getSessionByToken(token: string): Promise<SessionRecord | null> {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt <= now) {
      this.sessions.delete(token);
      await this.onSessionsChanged();
      return null;
    }

    // Sliding window renewal on active access
    session.lastActiveAt = now;
    return session;
  }

  async createSession(userId: string, deviceInfo?: string): Promise<SessionRecord> {
    const now = Date.now();
    // Clean up expired sessions for this user
    for (const [t, s] of this.sessions.entries()) {
      if (s.userId === userId && s.expiresAt <= now) {
        this.sessions.delete(t);
      }
    }

    // Enforce max active sessions per user (evict oldest by lastActiveAt)
    const userSessions = Array.from(this.sessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.lastActiveAt - b.lastActiveAt);

    while (userSessions.length >= MAX_SESSIONS_PER_USER) {
      const oldest = userSessions.shift();
      if (oldest) {
        this.sessions.delete(oldest.token);
      }
    }

    const token = generateToken(userId);
    const session: SessionRecord = {
      token,
      userId,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: now + DEFAULT_SESSION_LIFETIME_MS,
      deviceInfo,
    };

    this.sessions.set(token, session);
    await this.onSessionsChanged();
    return session;
  }

  async deleteSession(token: string): Promise<boolean> {
    const existed = this.sessions.delete(token);
    if (existed) {
      await this.onSessionsChanged();
    }
    return existed;
  }

  async deleteUserSessionsExcept(userId: string, exceptToken?: string): Promise<void> {
    let changed = false;
    for (const [t, s] of this.sessions.entries()) {
      if (s.userId === userId && (!exceptToken || t !== exceptToken)) {
        this.sessions.delete(t);
        changed = true;
      }
    }
    if (changed) {
      await this.onSessionsChanged();
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    return this.deleteSession(token);
  }

  async revokeAllUserSessions(userId: string, exceptToken?: string): Promise<void> {
    return this.deleteUserSessionsExcept(userId, exceptToken);
  }

  async renewSession(token: string): Promise<AuthResponse | null> {
    const session = await this.getSessionByToken(token);
    if (!session) return null;

    const now = Date.now();
    session.lastActiveAt = now;
    session.expiresAt = now + DEFAULT_SESSION_LIFETIME_MS;
    await this.onSessionsChanged();

    const profile = await this.getProfile(session.userId);
    if (!profile) return null;

    return { token: session.token, user: profile };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const p = this.profiles.get(userId);
    const nickname = sanitizeProfileNickname(p?.nickname, user.username);
    const avatar = sanitizeAvatar(p?.avatar, DEFAULT_AVATAR);
    const title = sanitizeProfileTitle(p?.title, DEFAULT_TITLE);
    const bio = sanitizeProfileBio(p?.bio);

    return {
      userId: user.id,
      username: user.username,
      nickname,
      avatar,
      title,
      bio,
      isGuest: Boolean(user.is_guest),
      createdAt: user.created_at,
      updatedAt: p?.updated_at || user.created_at,
    };
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const current = await this.getProfile(userId);
    if (!current) return null;

    const now = Date.now();
    const nickname = sanitizeProfileNickname(data.nickname, current.nickname);
    const avatar = data.avatar === undefined ? current.avatar : sanitizeAvatar(data.avatar, current.avatar);
    const title = sanitizeProfileTitle(data.title, current.title);
    const bio = sanitizeProfileBio(data.bio, current.bio);

    const row: ProfileRow = {
      user_id: userId,
      nickname,
      avatar,
      title,
      bio,
      updated_at: now,
    };

    this.profiles.set(userId, row);
    await this.onProfilesChanged();
    return this.getProfile(userId);
  }

  async saveProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile | null> {
    return this.updateProfile(userId, profile);
  }

  async createUser(username: string, passwordHash: string, isGuest: boolean, nickname?: string): Promise<AuthResponse> {
    const userId = generateId(isGuest ? 'guest' : 'usr');
    const now = Date.now();
    const finalNick = sanitizeProfileNickname(nickname, isGuest ? `雀友${userId.replace('guest_', '')}` : username);

    const userRow: UserRow = {
      id: userId,
      username,
      password_hash: passwordHash,
      is_guest: isGuest ? 1 : 0,
      created_at: now,
    };

    const profileRow: ProfileRow = {
      user_id: userId,
      nickname: finalNick,
      avatar: DEFAULT_AVATAR,
      title: DEFAULT_TITLE,
      bio: sanitizeProfileBio(undefined),
      updated_at: now,
    };

    this.users.set(userId, userRow);
    this.profiles.set(userId, profileRow);
    await this.onUsersChanged();
    await this.onProfilesChanged();

    const session = await this.createSession(userId);
    const profile = await this.getProfile(userId);

    return {
      token: session.token,
      user: profile!,
    };
  }

  async createGuest(nickname?: string): Promise<AuthResponse> {
    const userId = generateId('guest');
    const username = `guest_${userId}`;
    const tokenSeed = generateToken(userId);
    const passHash = await hashPassword(tokenSeed);
    return this.createUser(username, passHash, true, nickname);
  }

  async register(username: string, password: string, nickname?: string): Promise<AuthResponse | string> {
    const cleanUser = normalizeUsername(username);
    if (cleanUser.length < USERNAME_MIN) return `账号长度至少${USERNAME_MIN}位`;
    if (cleanUser.length > USERNAME_MAX) return `账号长度不能超过${USERNAME_MAX}位`;
    if (!isValidUsername(cleanUser)) return '账号不能包含控制字符';
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `密码长度至少${PASSWORD_MIN}位`;

    const existing = await this.getUserByUsername(cleanUser);
    if (existing) return '账号已被注册';

    const passHash = await hashPassword(password);
    return this.createUser(cleanUser, passHash, false, nickname);
  }

  async login(username: string, password: string): Promise<AuthResponse | string> {
    const cleanUser = normalizeUsername(username);
    if (typeof password !== 'string' || !password) return '账号或密码不正确';

    const userRow = await this.getUserByUsername(cleanUser);
    if (!userRow) return '账号或密码不正确';

    const passwordCheck = await verifyPassword(password, userRow.password_hash);
    if (!passwordCheck.valid) return '账号或密码不正确';

    if (passwordCheck.needsUpgrade) {
      userRow.password_hash = await hashPassword(password);
      await this.onUsersChanged();
    }

    const session = await this.createSession(userRow.id);
    const profile = await this.getProfile(userRow.id);

    return {
      token: session.token,
      user: profile!,
    };
  }

  async upgradeGuest(
    userId: string,
    username: string,
    password: string,
    nickname?: string,
  ): Promise<AuthResponse | string> {
    const user = await this.getUserById(userId);
    if (!user) return '账号不存在';
    if (!user.is_guest) return '该账号已经是正式账号';

    const cleanUser = normalizeUsername(username);
    if (cleanUser.length < USERNAME_MIN) return `账号长度至少${USERNAME_MIN}位`;
    if (cleanUser.length > USERNAME_MAX) return `账号长度不能超过${USERNAME_MAX}位`;
    if (!isValidUsername(cleanUser)) return '账号不能包含控制字符';
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `密码长度至少${PASSWORD_MIN}位`;

    const existing = await this.getUserByUsername(cleanUser);
    if (existing && existing.id !== userId) return '账号已被注册';

    const passHash = await hashPassword(password);
    user.username = cleanUser;
    user.password_hash = passHash;
    user.is_guest = 0;
    await this.onUsersChanged();

    if (nickname !== undefined) {
      await this.updateProfile(userId, { nickname });
    }

    const session = await this.createSession(userId);
    const profile = await this.getProfile(userId);
    if (!profile) return '账号资料初始化失败';

    return { token: session.token, user: profile };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResponse | string> {
    const user = await this.getUserById(userId);
    if (!user) return '账号不存在';
    if (user.is_guest) return '游客账号请先升级为正式账号';
    if (typeof currentPassword !== 'string') return '当前密码不正确';
    if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN) return `新密码长度至少${PASSWORD_MIN}位`;
    if (currentPassword === newPassword) return '新密码不能与当前密码相同';

    const passwordCheck = await verifyPassword(currentPassword, user.password_hash);
    if (!passwordCheck.valid) return '当前密码不正确';

    const passHash = await hashPassword(newPassword);
    user.password_hash = passHash;
    await this.onUsersChanged();

    // Create new session for this device and revoke all others
    const session = await this.createSession(userId);
    await this.revokeAllUserSessions(userId, session.token);

    const profile = await this.getProfile(userId);
    if (!profile) return '账号资料读取失败';

    return { token: session.token, user: profile };
  }

  async saveMatch(userId: string, record: MatchRecord): Promise<void> {
    const id = record.id || (record as any).matchId || generateId('match');
    const item: MatchRecord & { userId: string } = {
      ...record,
      id,
      userId,
    };
    this.matches = [item, ...this.matches.filter((m) => !(m.id === id && m.userId === userId))];
    await this.onMatchesChanged();
  }

  async getMatches(
    userId: string,
    mode?: GameMode,
    limit = 50,
  ): Promise<{ matches: MatchRecord[]; stats: ModeStats }> {
    const userMatches = this.matches
      .filter((m) => m.userId === userId && (!mode || m.mode === mode))
      .slice(0, limit);

    const stats = computeModeStats(userMatches);
    return { matches: userMatches, stats };
  }

  async getMatchesByUserId(
    userId: string,
    mode?: GameMode,
    limit?: number,
  ): Promise<{ matches: MatchRecord[]; stats: ModeStats }> {
    return this.getMatches(userId, mode, limit);
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const list: LeaderboardEntry[] = [];
    for (const [userId, profile] of this.profiles.entries()) {
      const user = this.users.get(userId);
      const userMatches = this.matches.filter((m) => m.userId === userId);
      const totalMatches = userMatches.length;
      const wins = userMatches.filter((m) => Boolean(m.myIsWinner ?? (m as any).isWin)).length;
      const draws = userMatches.filter((m) => Boolean(m.liuju)).length;
      const losses = Math.max(0, totalMatches - wins - draws);
      const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
      const totalScore = userMatches.reduce((acc, m) => {
        const delta = Number.isFinite(m.myDeltaScore)
          ? m.myDeltaScore
          : Number.isFinite((m as any).scoreDelta)
          ? (m as any).scoreDelta
          : 0;
        return acc + delta;
      }, 0);
      const maxWinScore = userMatches.reduce((acc, m) => {
        const delta = Number.isFinite(m.myDeltaScore)
          ? m.myDeltaScore
          : Number.isFinite((m as any).scoreDelta)
          ? (m as any).scoreDelta
          : 0;
        return Math.max(acc, delta);
      }, 0);
      const maxHu = userMatches.reduce((acc, m) => Math.max(acc, Number.isFinite(m.hu) ? m.hu : 0), 0);

      list.push({
        rank: 0,
        userId,
        username: user?.username || profile.nickname,
        nickname: profile.nickname,
        avatar: profile.avatar,
        title: profile.title,
        bio: profile.bio,
        isGuest: Boolean(user?.is_guest),
        totalMatches,
        wins,
        losses,
        winRate,
        totalScore,
        maxWinScore,
        maxHu,
      });
    }

    // Default sort by totalScore descending, then by wins
    list.sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || b.totalMatches - a.totalMatches);
    list.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return list;
  }
}

export class DiskAccountStore extends MemoryAccountStore {
  readonly dirPath: string;
  private readonly fileQueues = new Map<string, Promise<void>>();

  constructor(options?: { dirPath?: string }) {
    super();
    this.dirPath =
      options?.dirPath ??
      process.env.PIZHOU_ACCOUNTS_DIR ??
      path.join(process.cwd(), '.pizhou-state', 'accounts');
  }

  override async init(): Promise<void> {
    await fs.promises.mkdir(this.dirPath, { recursive: true });

    // Load users
    try {
      const usersRaw = await fs.promises.readFile(path.join(this.dirPath, 'users.json'), 'utf8');
      const usersArray = JSON.parse(usersRaw) as UserRow[];
      if (Array.isArray(usersArray)) {
        this.users.clear();
        for (const u of usersArray) {
          if (u && typeof u.id === 'string') this.users.set(u.id, u);
        }
      }
    } catch {
      // Empty or absent file is acceptable on first run
    }

    // Load profiles
    try {
      const profilesRaw = await fs.promises.readFile(path.join(this.dirPath, 'profiles.json'), 'utf8');
      const profilesArray = JSON.parse(profilesRaw) as ProfileRow[];
      if (Array.isArray(profilesArray)) {
        this.profiles.clear();
        for (const p of profilesArray) {
          if (p && typeof p.user_id === 'string') this.profiles.set(p.user_id, p);
        }
      }
    } catch {
      // Empty or absent file is acceptable on first run
    }

    // Load sessions
    try {
      const sessionsRaw = await fs.promises.readFile(path.join(this.dirPath, 'sessions.json'), 'utf8');
      const sessionsArray = JSON.parse(sessionsRaw) as SessionRecord[];
      if (Array.isArray(sessionsArray)) {
        this.sessions.clear();
        const now = Date.now();
        for (const s of sessionsArray) {
          if (s && typeof s.token === 'string' && s.expiresAt > now) {
            this.sessions.set(s.token, s);
          }
        }
      }
    } catch {
      // Empty or absent file is acceptable on first run
    }

    // Load matches
    try {
      const matchesRaw = await fs.promises.readFile(path.join(this.dirPath, 'matches.json'), 'utf8');
      const matchesArray = JSON.parse(matchesRaw) as Array<MatchRecord & { userId: string }>;
      if (Array.isArray(matchesArray)) {
        this.matches = matchesArray.filter((m) => m && typeof m.id === 'string');
      }
    } catch {
      // Empty or absent file is acceptable on first run
    }
  }

  private async saveFileAtomic(filename: string, data: unknown): Promise<void> {
    const queue = this.fileQueues.get(filename) ?? Promise.resolve();
    const task = queue.then(async () => {
      await fs.promises.mkdir(this.dirPath, { recursive: true });
      const json = JSON.stringify(data, null, 2);
      const targetFile = path.join(this.dirPath, filename);
      const tempFile = path.join(
        this.dirPath,
        `.tmp-${filename}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
      );

      await fs.promises.writeFile(tempFile, json, 'utf8');
      await fs.promises.rename(tempFile, targetFile);
    });

    this.fileQueues.set(
      filename,
      task.catch((err) => {
        console.error(`[DiskAccountStore] Failed to save ${filename}:`, err);
      }),
    );

    await task;
  }

  override async onUsersChanged(): Promise<void> {
    const usersArray = Array.from(this.users.values());
    await this.saveFileAtomic('users.json', usersArray);
  }

  override async onProfilesChanged(): Promise<void> {
    const profilesArray = Array.from(this.profiles.values());
    await this.saveFileAtomic('profiles.json', profilesArray);
  }

  override async onSessionsChanged(): Promise<void> {
    const sessionsArray = Array.from(this.sessions.values());
    await this.saveFileAtomic('sessions.json', sessionsArray);
  }

  override async onMatchesChanged(): Promise<void> {
    await this.saveFileAtomic('matches.json', this.matches);
  }
}

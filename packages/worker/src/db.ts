import {
  DEFAULT_AVATAR,
  isValidUsername,
  normalizeUsername,
  PASSWORD_MIN,
  sanitizeAvatar,
  sanitizeProfileBio,
  sanitizeProfileNickname,
  sanitizeProfileTitle,
  USERNAME_MIN,
  USERNAME_MAX,
} from '@pizhou/shared';
import type {
  FriendItem,
  FriendRequestItem,
  GameMode,
  MatchRecord,
  ModeStats,
  UserProfile,
  UserSearchResult,
} from '@pizhou/shared';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  token: string;
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

export interface MatchRow {
  id: string;
  user_id: string;
  mode: string;
  room_code: string;
  timestamp: number;
  date_str: string;
  win_type: string;
  winner_nickname: string | null;
  winner_seat: number | null;
  hu: number;
  yao: number;
  dealer_multiplier: number;
  hun_di: number;
  liuju: number;
  draw_reason: string | null;
  bao_zhuang_json: string | null;
  my_delta_score: number;
  my_is_winner: number;
  scores_json: string;
  created_at: number;
}

export interface FriendRow {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: number;
}

export interface FriendRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: number;
}

const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
// Cloudflare Workers Web Crypto rejects PBKDF2 iteration counts above 100,000.
// Keep new hashes at the platform ceiling so account creation and guest login
// work in production as well as in the Node-based test environment.
const PASSWORD_HASH_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const LEGACY_PASSWORD_SALT = 'pizhou_salt_v1';

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeStringEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}

async function legacyHashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(`${password}:${LEGACY_PASSWORD_SALT}`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${encodeBase64Url(salt)}$${encodeBase64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedHash.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const legacyHash = await legacyHashPassword(password);
    return {
      valid: constantTimeStringEqual(legacyHash, storedHash),
      needsUpgrade: true,
    };
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) return { valid: false, needsUpgrade: false };
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 100_000) {
    return { valid: false, needsUpgrade: false };
  }

  try {
    const salt = decodeBase64Url(parts[2]!);
    const expected = decodeBase64Url(parts[3]!);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      expected.length * 8,
    );
    const actual = new Uint8Array(bits);
    let difference = actual.length ^ expected.length;
    for (let i = 0; i < Math.max(actual.length, expected.length); i += 1) {
      difference |= (actual[i] || 0) ^ (expected[i] || 0);
    }
    return { valid: difference === 0, needsUpgrade: iterations < PASSWORD_HASH_ITERATIONS };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

function generateToken(userId: string): string {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  return `tk_${userId}_${suffix}`;
}

export function generateId(prefix = 'u'): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}_${rand}`;
}

export class HubDatabase {
  private sql: any = null;

  // In-memory fallbacks for non-SQL environments or tests
  private memUsers = new Map<string, UserRow>();
  private memProfiles = new Map<string, ProfileRow>();
  private memMatches: MatchRow[] = [];
  private memFriends: FriendRow[] = [];
  private memFriendRequests: FriendRequestRow[] = [];

  constructor(storage?: any) {
    if (storage && storage.sql) {
      this.sql = storage.sql;
      this.initSql();
    }
  }

  private initSql(): void {
    if (!this.sql) return;
    try {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          is_guest INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profiles (
          user_id TEXT PRIMARY KEY,
          nickname TEXT NOT NULL,
          avatar TEXT NOT NULL DEFAULT '🀄',
          title TEXT DEFAULT '初学雀友',
          bio TEXT DEFAULT '不碰坎不上，单钓不换张！',
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          mode TEXT NOT NULL,
          room_code TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          date_str TEXT NOT NULL,
          win_type TEXT NOT NULL,
          winner_nickname TEXT,
          winner_seat INTEGER,
          hu INTEGER NOT NULL DEFAULT 0,
          yao INTEGER NOT NULL DEFAULT 0,
          dealer_multiplier INTEGER DEFAULT 1,
          hun_di INTEGER DEFAULT 0,
          liuju INTEGER DEFAULT 0,
          draw_reason TEXT,
          bao_zhuang_json TEXT,
          my_delta_score INTEGER NOT NULL,
          my_is_winner INTEGER DEFAULT 0,
          scores_json TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_matches_user_mode ON matches(user_id, mode, timestamp DESC);

        CREATE TABLE IF NOT EXISTS friends (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          friend_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(user_id, friend_id)
        );

        CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);

        CREATE TABLE IF NOT EXISTS friend_requests (
          id TEXT PRIMARY KEY,
          from_user_id TEXT NOT NULL,
          to_user_id TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          UNIQUE(from_user_id, to_user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id, status);
      `);
    } catch (e) {
      console.warn('HubDatabase initSql warning:', e);
    }
  }

  private async usernameExists(username: string, excludeUserId?: string): Promise<boolean> {
    if (this.sql) {
      const rows = this.sql.exec(
        `SELECT id FROM users WHERE LOWER(username) = LOWER(?)${excludeUserId ? ' AND id != ?' : ''}`,
        ...(excludeUserId ? [username, excludeUserId] : [username]),
      ).toArray();
      return rows.length > 0;
    }
    for (const user of this.memUsers.values()) {
      if (excludeUserId && user.id === excludeUserId) continue;
      if (user.username.toLowerCase() === username.toLowerCase()) return true;
    }
    return false;
  }

  async getUserById(userId: string): Promise<UserRow | null> {
    if (!userId) return null;
    if (this.sql) {
      const rows = this.sql.exec(`SELECT * FROM users WHERE id = ?`, userId).toArray();
      return (rows[0] as UserRow) ?? null;
    }
    return this.memUsers.get(userId) ?? null;
  }

  async createGuest(nickname?: string): Promise<{ token: string; user: UserProfile }> {
    const userId = generateId('guest');
    const username = `guest_${userId}`;
    const token = generateToken(userId);
    const passHash = await hashPassword(token);
    const now = Date.now();
    const finalNick = sanitizeProfileNickname(nickname, `雀友${userId.replace('guest_', '')}`);

    if (this.sql) {
      this.sql.exec(
        `INSERT INTO users (id, username, password_hash, token, is_guest, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
        userId,
        username,
        passHash,
        token,
        now,
      );
      this.sql.exec(
        `INSERT INTO profiles (user_id, nickname, avatar, title, bio, updated_at) VALUES (?, ?, '🀄', '初学雀友', '不碰坎不上，单钓不换张！', ?)`,
        userId,
        finalNick,
        now,
      );
    } else {
      this.memUsers.set(userId, {
        id: userId,
        username,
        password_hash: passHash,
        token,
        is_guest: 1,
        created_at: now,
      });
      this.memProfiles.set(userId, {
        user_id: userId,
        nickname: finalNick,
        avatar: DEFAULT_AVATAR,
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        updated_at: now,
      });
    }

    return {
      token,
      user: {
        userId,
        username,
        nickname: finalNick,
        avatar: DEFAULT_AVATAR,
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        isGuest: true,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  async register(username: string, password: string, nickname?: string): Promise<{ token: string; user: UserProfile } | string> {
    const cleanUser = normalizeUsername(username);
    if (cleanUser.length < USERNAME_MIN) return `账号长度至少${USERNAME_MIN}位`;
    if (cleanUser.length > USERNAME_MAX) return `账号长度不能超过${USERNAME_MAX}位`;
    if (!isValidUsername(cleanUser)) return '账号不能包含控制字符';
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `密码长度至少${PASSWORD_MIN}位`;
    if (await this.usernameExists(cleanUser)) return '账号已被注册';

    const userId = generateId('usr');
    const token = generateToken(userId);
    const passHash = await hashPassword(password);
    const now = Date.now();
    const finalNick = sanitizeProfileNickname(nickname, cleanUser);

    if (this.sql) {
      this.sql.exec(
        `INSERT INTO users (id, username, password_hash, token, is_guest, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
        userId,
        cleanUser,
        passHash,
        token,
        now,
      );
      this.sql.exec(
        `INSERT INTO profiles (user_id, nickname, avatar, title, bio, updated_at) VALUES (?, ?, '🀄', '初学雀友', '不碰坎不上，单钓不换张！', ?)`,
        userId,
        finalNick,
        now,
      );
    } else {
      this.memUsers.set(userId, {
        id: userId,
        username: cleanUser,
        password_hash: passHash,
        token,
        is_guest: 0,
        created_at: now,
      });
      this.memProfiles.set(userId, {
        user_id: userId,
        nickname: finalNick,
        avatar: DEFAULT_AVATAR,
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        updated_at: now,
      });
    }

    return {
      token,
      user: {
        userId,
        username: cleanUser,
        nickname: finalNick,
        avatar: DEFAULT_AVATAR,
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        isGuest: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  async login(username: string, password: string): Promise<{ token: string; user: UserProfile } | string> {
    const cleanUser = normalizeUsername(username);
    if (typeof password !== 'string') return '账号或密码不正确';

    let userRow: UserRow | null = null;
    if (this.sql) {
      const rows = this.sql.exec(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, cleanUser).toArray();
      if (rows.length > 0) userRow = rows[0] as UserRow;
    } else {
      for (const u of this.memUsers.values()) {
        if (u.username.toLowerCase() === cleanUser.toLowerCase()) {
          userRow = u;
          break;
        }
      }
    }

    if (!userRow) {
      return '账号或密码不正确';
    }

    const passwordCheck = await verifyPassword(password, userRow.password_hash);
    if (!passwordCheck.valid) return '账号或密码不正确';

    const token = generateToken(userRow.id);
    if (this.sql) {
      if (passwordCheck.needsUpgrade) {
        const upgradedHash = await hashPassword(password);
        this.sql.exec(`UPDATE users SET password_hash = ?, token = ? WHERE id = ?`, upgradedHash, token, userRow.id);
      } else {
        this.sql.exec(`UPDATE users SET token = ? WHERE id = ?`, token, userRow.id);
      }
    } else {
      if (passwordCheck.needsUpgrade) userRow.password_hash = await hashPassword(password);
      userRow.token = token;
    }

    const profile = await this.getProfile(userRow.id);
    return {
      token,
      user: profile || {
        userId: userRow.id,
        username: userRow.username,
        nickname: userRow.username,
        avatar: DEFAULT_AVATAR,
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        isGuest: Boolean(userRow.is_guest),
        createdAt: userRow.created_at,
        updatedAt: Date.now(),
      },
    };
  }

  async upgradeGuest(
    userId: string,
    username: string,
    password: string,
    nickname?: string,
  ): Promise<{ token: string; user: UserProfile } | string> {
    const user = await this.getUserById(userId);
    if (!user) return '账号不存在';
    if (!user.is_guest) return '该账号已经是正式账号';

    const cleanUser = normalizeUsername(username);
    if (cleanUser.length < USERNAME_MIN) return `账号长度至少${USERNAME_MIN}位`;
    if (cleanUser.length > USERNAME_MAX) return `账号长度不能超过${USERNAME_MAX}位`;
    if (!isValidUsername(cleanUser)) return '账号不能包含控制字符';
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `密码长度至少${PASSWORD_MIN}位`;
    if (await this.usernameExists(cleanUser, userId)) return '账号已被注册';

    const passHash = await hashPassword(password);
    const token = generateToken(userId);
    if (this.sql) {
      this.sql.exec(
        `UPDATE users SET username = ?, password_hash = ?, token = ?, is_guest = 0 WHERE id = ?`,
        cleanUser,
        passHash,
        token,
        userId,
      );
    } else {
      user.username = cleanUser;
      user.password_hash = passHash;
      user.token = token;
      user.is_guest = 0;
    }

    if (nickname !== undefined) {
      await this.updateProfile(userId, { nickname });
    }
    const profile = await this.getProfile(userId);
    if (!profile) return '账号资料初始化失败';
    return { token, user: profile };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ token: string; user: UserProfile } | string> {
    const user = await this.getUserById(userId);
    if (!user) return '账号不存在';
    if (user.is_guest) return '游客账号请先升级为正式账号';
    if (typeof currentPassword !== 'string') return '当前密码不正确';
    if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN) return `新密码长度至少${PASSWORD_MIN}位`;
    if (currentPassword === newPassword) return '新密码不能与当前密码相同';

    const passwordCheck = await verifyPassword(currentPassword, user.password_hash);
    if (!passwordCheck.valid) return '当前密码不正确';

    const passHash = await hashPassword(newPassword);
    const token = generateToken(userId);
    if (this.sql) {
      this.sql.exec(
        `UPDATE users SET password_hash = ?, token = ? WHERE id = ?`,
        passHash,
        token,
        userId,
      );
    } else {
      user.password_hash = passHash;
      user.token = token;
    }

    const profile = await this.getProfile(userId);
    if (!profile) return '账号资料读取失败';
    return { token, user: profile };
  }

  async revokeToken(token: string): Promise<boolean> {
    const user = await this.getUserByToken(token);
    if (!user) return false;
    const replacement = generateToken(user.id);
    if (this.sql) {
      this.sql.exec(`UPDATE users SET token = ? WHERE id = ?`, replacement, user.id);
    } else {
      user.token = replacement;
    }
    return true;
  }

  async getUserByToken(token: string): Promise<UserRow | null> {
    if (!token) return null;
    if (this.sql) {
      const rows = this.sql.exec(`SELECT * FROM users WHERE token = ?`, token).toArray();
      return (rows[0] as UserRow) ?? null;
    }
    for (const u of this.memUsers.values()) {
      if (u.token === token) return u;
    }
    return null;
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (this.sql) {
      const rows = this.sql.exec(
        `SELECT u.id, u.username, u.is_guest, u.created_at, p.nickname, p.avatar, p.title, p.bio, p.updated_at
         FROM users u
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE u.id = ?`,
        userId,
      ).toArray();
      if (rows.length === 0) return null;
      const r = rows[0] as any;
      return {
        userId: r.id,
        username: r.username,
        nickname: sanitizeProfileNickname(r.nickname, r.username),
        avatar: sanitizeAvatar(r.avatar, DEFAULT_AVATAR),
        title: sanitizeProfileTitle(r.title),
        bio: sanitizeProfileBio(r.bio),
        isGuest: Boolean(r.is_guest),
        createdAt: r.created_at,
        updatedAt: r.updated_at || r.created_at,
      };
    }

    const user = this.memUsers.get(userId);
    if (!user) return null;
    const p = this.memProfiles.get(userId);
    return {
      userId: user.id,
      username: user.username,
      nickname: sanitizeProfileNickname(p?.nickname, user.username),
      avatar: sanitizeAvatar(p?.avatar, DEFAULT_AVATAR),
      title: sanitizeProfileTitle(p?.title),
      bio: sanitizeProfileBio(p?.bio),
      isGuest: Boolean(user.is_guest),
      createdAt: user.created_at,
      updatedAt: p?.updated_at || user.created_at,
    };
  }

  async updateProfile(userId: string, data: { nickname?: string; avatar?: string; title?: string; bio?: string }): Promise<UserProfile | null> {
    const now = Date.now();
    const current = await this.getProfile(userId);
    if (!current) return null;

    const nickname = sanitizeProfileNickname(data.nickname, current.nickname);
    const avatar = data.avatar === undefined
      ? current.avatar
      : sanitizeAvatar(data.avatar, current.avatar);
    const title = sanitizeProfileTitle(data.title, current.title);
    const bio = sanitizeProfileBio(data.bio, current.bio);

    if (this.sql) {
      this.sql.exec(
        `INSERT INTO profiles (user_id, nickname, avatar, title, bio, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           nickname = excluded.nickname,
           avatar = excluded.avatar,
           title = excluded.title,
           bio = excluded.bio,
           updated_at = excluded.updated_at`,
        userId,
        nickname,
        avatar,
        title,
        bio,
        now,
      );
    } else {
      this.memProfiles.set(userId, {
        user_id: userId,
        nickname,
        avatar,
        title,
        bio,
        updated_at: now,
      });
    }

    return this.getProfile(userId);
  }

  async saveMatch(userId: string, record: MatchRecord): Promise<void> {
    const now = Date.now();
    const baoZhuangJson = record.baoZhuang ? JSON.stringify(record.baoZhuang) : null;
    const scoresJson = JSON.stringify(record.scores || []);

    if (this.sql) {
      this.sql.exec(
        `INSERT OR REPLACE INTO matches (
          id, user_id, mode, room_code, timestamp, date_str, win_type,
          winner_nickname, winner_seat, hu, yao, dealer_multiplier,
          hun_di, liuju, draw_reason, bao_zhuang_json, my_delta_score,
          my_is_winner, scores_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        record.id,
        userId,
        record.mode,
        record.roomCode,
        record.timestamp,
        record.dateStr,
        record.winType,
        record.winnerNickname ?? null,
        record.winnerSeat,
        record.hu,
        record.yao,
        record.dealerMultiplier,
        record.hunDi ? 1 : 0,
        record.liuju ? 1 : 0,
        record.drawReason ?? null,
        baoZhuangJson,
        record.myDeltaScore,
        record.myIsWinner ? 1 : 0,
        scoresJson,
        now,
      );
    } else {
      const row: MatchRow = {
        id: record.id,
        user_id: userId,
        mode: record.mode,
        room_code: record.roomCode,
        timestamp: record.timestamp,
        date_str: record.dateStr,
        win_type: record.winType,
        winner_nickname: record.winnerNickname ?? null,
        winner_seat: record.winnerSeat,
        hu: record.hu,
        yao: record.yao,
        dealer_multiplier: record.dealerMultiplier,
        hun_di: record.hunDi ? 1 : 0,
        liuju: record.liuju ? 1 : 0,
        draw_reason: record.drawReason ?? null,
        bao_zhuang_json: baoZhuangJson,
        my_delta_score: record.myDeltaScore,
        my_is_winner: record.myIsWinner ? 1 : 0,
        scores_json: scoresJson,
        created_at: now,
      };
      this.memMatches = [row, ...this.memMatches.filter((m) => m.id !== record.id)];
    }
  }

  async getMatches(userId: string, mode?: GameMode, limit = 50): Promise<{ matches: MatchRecord[]; stats: ModeStats }> {
    let rows: MatchRow[] = [];

    if (this.sql) {
      if (mode) {
        rows = this.sql.exec(
          `SELECT * FROM matches WHERE user_id = ? AND mode = ? ORDER BY timestamp DESC LIMIT ?`,
          userId,
          mode,
          limit,
        ).toArray() as MatchRow[];
      } else {
        rows = this.sql.exec(
          `SELECT * FROM matches WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`,
          userId,
          limit,
        ).toArray() as MatchRow[];
      }
    } else {
      rows = this.memMatches.filter((m) => m.user_id === userId && (!mode || m.mode === mode)).slice(0, limit);
    }

    const matches: MatchRecord[] = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      mode: r.mode as GameMode,
      roomCode: r.room_code,
      timestamp: r.timestamp,
      dateStr: r.date_str,
      winType: r.win_type,
      winnerNickname: r.winner_nickname ?? undefined,
      winnerSeat: r.winner_seat,
      hu: r.hu,
      yao: r.yao,
      dealerMultiplier: r.dealer_multiplier,
      hunDi: Boolean(r.hun_di),
      liuju: Boolean(r.liuju),
      drawReason: r.draw_reason ?? undefined,
      baoZhuang: r.bao_zhuang_json ? JSON.parse(r.bao_zhuang_json) : null,
      myDeltaScore: r.my_delta_score,
      myIsWinner: Boolean(r.my_is_winner),
      scores: r.scores_json ? JSON.parse(r.scores_json) : [],
    }));

    const totalMatches = matches.length;
    const wins = matches.filter((m) => m.myIsWinner).length;
    const draws = matches.filter((m) => m.liuju).length;
    const losses = totalMatches - wins - draws;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
    const totalScore = matches.reduce((acc, m) => acc + m.myDeltaScore, 0);
    const maxHu = matches.reduce((acc, m) => Math.max(acc, m.hu), 0);
    const piaoHunCount = matches.filter((m) => m.hunDi).length;
    const baoZhuangCount = matches.filter((m) => m.baoZhuang !== null).length;

    const stats: ModeStats = {
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

    return { matches, stats };
  }

  // ==========================================
  // Friends & Social Features
  // ==========================================

  async searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    let users: Array<{ id: string; username: string; nickname: string; avatar: string; title: string }> = [];

    if (this.sql) {
      users = this.sql.exec(
        `SELECT u.id, u.username, p.nickname, p.avatar, p.title
         FROM users u
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE (LOWER(u.username) LIKE ? OR LOWER(p.nickname) LIKE ? OR LOWER(u.id) LIKE ?)
           AND u.id != ?
         LIMIT 10`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        currentUserId,
      ).toArray();
    } else {
      for (const u of this.memUsers.values()) {
        if (u.id === currentUserId) continue;
        const p = this.memProfiles.get(u.id);
        const nick = p?.nickname || u.username;
        if (
          u.username.toLowerCase().includes(q) ||
          nick.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        ) {
          users.push({
            id: u.id,
            username: u.username,
            nickname: sanitizeProfileNickname(nick, u.username),
            avatar: sanitizeAvatar(p?.avatar, DEFAULT_AVATAR),
            title: sanitizeProfileTitle(p?.title),
          });
        }
      }
    }

    // Determine friendship & pending request status
    const results: UserSearchResult[] = [];
    for (const u of users) {
      const isFriend = await this.isFriend(currentUserId, u.id);
      const hasPending = await this.hasPendingRequest(currentUserId, u.id);
      results.push({
        userId: u.id,
        username: u.username,
        nickname: sanitizeProfileNickname(u.nickname, u.username),
        avatar: sanitizeAvatar(u.avatar, DEFAULT_AVATAR),
        title: sanitizeProfileTitle(u.title),
        isFriend,
        hasPendingRequest: hasPending,
      });
    }

    return results;
  }

  async isFriend(userIdA: string, userIdB: string): Promise<boolean> {
    if (this.sql) {
      const rows = this.sql.exec(
        `SELECT id FROM friends WHERE user_id = ? AND friend_id = ?`,
        userIdA,
        userIdB,
      ).toArray();
      return rows.length > 0;
    }
    return this.memFriends.some((f) => f.user_id === userIdA && f.friend_id === userIdB);
  }

  async hasPendingRequest(fromUserId: string, toUserId: string): Promise<boolean> {
    if (this.sql) {
      const rows = this.sql.exec(
        `SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
        fromUserId,
        toUserId,
      ).toArray();
      return rows.length > 0;
    }
    return this.memFriendRequests.some(
      (r) => r.from_user_id === fromUserId && r.to_user_id === toUserId && r.status === 'pending',
    );
  }

  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<{ success: true } | string> {
    if (fromUserId === toUserId) return '不能添加自己为好友';
    const target = await this.getProfile(toUserId);
    if (!target) return '找不到该玩家';

    if (await this.isFriend(fromUserId, toUserId)) return '对方已经是您的好友';
    if (await this.hasPendingRequest(fromUserId, toUserId)) return '好友申请已发送，等待对方同意';

    const id = `freq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    if (this.sql) {
      this.sql.exec(
        `INSERT OR REPLACE INTO friend_requests (id, from_user_id, to_user_id, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
        id,
        fromUserId,
        toUserId,
        now,
      );
    } else {
      this.memFriendRequests = [
        { id, from_user_id: fromUserId, to_user_id: toUserId, status: 'pending', created_at: now },
        ...this.memFriendRequests.filter((r) => !(r.from_user_id === fromUserId && r.to_user_id === toUserId)),
      ];
    }

    return { success: true };
  }

  async getFriendRequests(userId: string): Promise<FriendRequestItem[]> {
    if (this.sql) {
      const rows = this.sql.exec(
        `SELECT r.id, r.from_user_id, r.created_at, u.username as from_username, p.nickname as from_nickname, p.avatar as from_avatar, p.title as from_title
         FROM friend_requests r
         JOIN users u ON r.from_user_id = u.id
         LEFT JOIN profiles p ON r.from_user_id = p.user_id
         WHERE r.to_user_id = ? AND r.status = 'pending'
         ORDER BY r.created_at DESC`,
        userId,
      ).toArray() as any[];

      return rows.map((r) => ({
        id: r.id,
        fromUserId: r.from_user_id,
        fromUsername: r.from_username,
        fromNickname: sanitizeProfileNickname(r.from_nickname, r.from_username),
        fromAvatar: sanitizeAvatar(r.from_avatar, DEFAULT_AVATAR),
        fromTitle: sanitizeProfileTitle(r.from_title),
        createdAt: r.created_at,
      }));
    }

    const items: FriendRequestItem[] = [];
    for (const r of this.memFriendRequests) {
      if (r.to_user_id === userId && r.status === 'pending') {
        const u = this.memUsers.get(r.from_user_id);
        const p = this.memProfiles.get(r.from_user_id);
        if (u) {
          items.push({
            id: r.id,
            fromUserId: r.from_user_id,
            fromUsername: u.username,
            fromNickname: sanitizeProfileNickname(p?.nickname, u.username),
            fromAvatar: sanitizeAvatar(p?.avatar, DEFAULT_AVATAR),
            fromTitle: sanitizeProfileTitle(p?.title),
            createdAt: r.created_at,
          });
        }
      }
    }
    return items;
  }

  async respondFriendRequest(requestId: string, userId: string, accept: boolean): Promise<{ success: true } | string> {
    let req: FriendRequestRow | null = null;
    if (this.sql) {
      const rows = this.sql.exec(`SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ?`, requestId, userId).toArray();
      if (rows.length > 0) req = rows[0] as FriendRequestRow;
    } else {
      req = this.memFriendRequests.find((r) => r.id === requestId && r.to_user_id === userId) ?? null;
    }

    if (!req) return '好友申请不存在或已处理';

    const now = Date.now();
    if (accept) {
      const fid1 = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fid2 = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_2`;

      if (this.sql) {
        this.sql.exec(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, requestId);
        this.sql.exec(
          `INSERT OR IGNORE INTO friends (id, user_id, friend_id, created_at) VALUES (?, ?, ?, ?)`,
          fid1,
          req.to_user_id,
          req.from_user_id,
          now,
        );
        this.sql.exec(
          `INSERT OR IGNORE INTO friends (id, user_id, friend_id, created_at) VALUES (?, ?, ?, ?)`,
          fid2,
          req.from_user_id,
          req.to_user_id,
          now,
        );
      } else {
        req.status = 'accepted';
        this.memFriends.push({ id: fid1, user_id: req.to_user_id, friend_id: req.from_user_id, created_at: now });
        this.memFriends.push({ id: fid2, user_id: req.from_user_id, friend_id: req.to_user_id, created_at: now });
      }
    } else {
      if (this.sql) {
        this.sql.exec(`UPDATE friend_requests SET status = 'rejected' WHERE id = ?`, requestId);
      } else {
        req.status = 'rejected';
      }
    }

    return { success: true };
  }

  async getFriends(userId: string): Promise<FriendItem[]> {
    if (this.sql) {
      const rows = this.sql.exec(
        `SELECT f.friend_id, f.created_at as added_at, u.username, p.nickname, p.avatar, p.title, p.bio
         FROM friends f
         JOIN users u ON f.friend_id = u.id
         LEFT JOIN profiles p ON f.friend_id = p.user_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`,
        userId,
      ).toArray() as any[];

      return rows.map((r) => ({
        userId: r.friend_id,
        username: r.username,
        nickname: sanitizeProfileNickname(r.nickname, r.username),
        avatar: sanitizeAvatar(r.avatar, DEFAULT_AVATAR),
        title: sanitizeProfileTitle(r.title),
        bio: sanitizeProfileBio(r.bio),
        status: 'offline',
        addedAt: r.added_at,
      }));
    }

    const items: FriendItem[] = [];
    for (const f of this.memFriends) {
      if (f.user_id === userId) {
        const u = this.memUsers.get(f.friend_id);
        const p = this.memProfiles.get(f.friend_id);
        if (u) {
          items.push({
            userId: f.friend_id,
            username: u.username,
            nickname: sanitizeProfileNickname(p?.nickname, u.username),
            avatar: sanitizeAvatar(p?.avatar, DEFAULT_AVATAR),
            title: sanitizeProfileTitle(p?.title),
            bio: sanitizeProfileBio(p?.bio),
            status: 'offline',
            addedAt: f.created_at,
          });
        }
      }
    }
    return items;
  }

  async deleteFriend(userId: string, friendId: string): Promise<void> {
    if (this.sql) {
      this.sql.exec(
        `DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
        userId,
        friendId,
        friendId,
        userId,
      );
    } else {
      this.memFriends = this.memFriends.filter(
        (f) => !(f.user_id === userId && f.friend_id === friendId) && !(f.user_id === friendId && f.friend_id === userId),
      );
    }
  }
}

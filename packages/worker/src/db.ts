import type { GameMode, MatchRecord, ModeStats, UserProfile } from '@pizhou/shared';

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

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(`${password}:pizhou_salt_v1`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
      `);
    } catch (e) {
      console.warn('HubDatabase initSql warning:', e);
    }
  }

  async createGuest(nickname?: string): Promise<{ token: string; user: UserProfile }> {
    const userId = generateId('guest');
    const username = `guest_${userId}`;
    const token = `tk_${userId}_${Math.random().toString(36).slice(2, 10)}`;
    const passHash = await hashPassword(token);
    const now = Date.now();
    const finalNick = nickname?.trim() || `雀友${userId.replace('guest_', '')}`;

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
        avatar: '🀄',
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
        avatar: '🀄',
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        isGuest: true,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  async register(username: string, password: string, nickname?: string): Promise<{ token: string; user: UserProfile } | string> {
    const cleanUser = username.trim();
    if (cleanUser.length < 3) return '账号长度至少3位';
    if (!password || password.length < 4) return '密码长度至少4位';

    if (this.sql) {
      const existing = this.sql.exec(`SELECT id FROM users WHERE username = ?`, cleanUser).toArray();
      if (existing.length > 0) return '账号已被注册';
    } else {
      for (const u of this.memUsers.values()) {
        if (u.username === cleanUser) return '账号已被注册';
      }
    }

    const userId = generateId('usr');
    const token = `tk_${userId}_${Math.random().toString(36).slice(2, 10)}`;
    const passHash = await hashPassword(password);
    const now = Date.now();
    const finalNick = nickname?.trim() || cleanUser;

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
        avatar: '🀄',
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
        avatar: '🀄',
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        isGuest: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  async login(username: string, password: string): Promise<{ token: string; user: UserProfile } | string> {
    const cleanUser = username.trim();
    const passHash = await hashPassword(password);

    let userRow: UserRow | null = null;
    if (this.sql) {
      const rows = this.sql.exec(`SELECT * FROM users WHERE username = ?`, cleanUser).toArray();
      if (rows.length > 0) userRow = rows[0] as UserRow;
    } else {
      for (const u of this.memUsers.values()) {
        if (u.username === cleanUser) {
          userRow = u;
          break;
        }
      }
    }

    if (!userRow || userRow.password_hash !== passHash) {
      return '账号或密码不正确';
    }

    // Refresh token
    const token = `tk_${userRow.id}_${Math.random().toString(36).slice(2, 10)}`;
    if (this.sql) {
      this.sql.exec(`UPDATE users SET token = ? WHERE id = ?`, token, userRow.id);
    } else {
      userRow.token = token;
    }

    const profile = await this.getProfile(userRow.id);
    return {
      token,
      user: profile || {
        userId: userRow.id,
        username: userRow.username,
        nickname: userRow.username,
        avatar: '🀄',
        title: '初学雀友',
        bio: '不碰坎不上，单钓不换张！',
        isGuest: Boolean(userRow.is_guest),
        createdAt: userRow.created_at,
        updatedAt: Date.now(),
      },
    };
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
        nickname: r.nickname || r.username,
        avatar: r.avatar || '🀄',
        title: r.title || '初学雀友',
        bio: r.bio || '不碰坎不上，单钓不换张！',
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
      nickname: p?.nickname || user.username,
      avatar: p?.avatar || '🀄',
      title: p?.title || '初学雀友',
      bio: p?.bio || '不碰坎不上，单钓不换张！',
      isGuest: Boolean(user.is_guest),
      createdAt: user.created_at,
      updatedAt: p?.updated_at || user.created_at,
    };
  }

  async updateProfile(userId: string, data: { nickname?: string; avatar?: string; title?: string; bio?: string }): Promise<UserProfile | null> {
    const now = Date.now();
    const current = await this.getProfile(userId);
    if (!current) return null;

    const nickname = data.nickname?.trim() || current.nickname;
    const avatar = data.avatar || current.avatar;
    const title = data.title || current.title;
    const bio = data.bio !== undefined ? data.bio : current.bio;

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

    // Calculate stats
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
}

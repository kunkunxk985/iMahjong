import {
  RoomManager,
  broadcastSettlement,
  broadcastState,
  cancelBots,
  handleMessage,
  parseClientMessage,
  scheduleBots,
  send,
  type UniversalWebSocket,
} from '@pizhou/server-core/core';
import type { FriendPresenceStatus } from '@pizhou/shared';
import { HubDatabase } from './db.js';

export interface Env {
  PIZHOU_HUB: DurableObjectNamespace;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  });
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}

async function readJsonBody(request: Request): Promise<Record<string, any> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'Content-Type, Authorization',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
        },
      });
    }

    // Forward WebSocket connections and REST APIs to the Global Hub Durable Object
    const id = env.PIZHOU_HUB.idFromName('global_pizhou_hub');
    const stub = env.PIZHOU_HUB.get(id);
    return stub.fetch(request);
  },
};

export class PizhouHubDO {
  private db: HubDatabase;
  private manager = new RoomManager();
  private timer: any = null;

  // Realtime Presence tracking
  private userSockets = new Map<string, Set<UniversalWebSocket>>();
  private socketUser = new Map<UniversalWebSocket, { userId: string; token: string }>();

  constructor(state: DurableObjectState) {
    this.db = new HubDatabase((state as any).storage);
    this.startTick();
  }

  private startTick() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const roomCode of this.manager.sweep(now)) {
        cancelBots(roomCode);
      }
      for (const room of this.manager.all()) {
        if (room.game && room.phase === 'playing') {
          const result = room.game.tick(now);
          if (result.changed) {
            if (room.game.settlement) {
              room.applySettlementTotals();
              broadcastSettlement(room, room.game.settlement);
            } else {
              broadcastState(room);
            }
            scheduleBots(room);
          }
        }
      }
    }, 1000);
  }

  private getBearerToken(request: Request): string | null {
    const auth = request.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    const url = new URL(request.url);
    return url.searchParams.get('token');
  }

  private getUserPresence(userId: string): { status: FriendPresenceStatus; playingRoomCode?: string } {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      return { status: 'offline' };
    }

    // Check if player is currently in a room
    for (const room of this.manager.all()) {
      for (const p of room.occupied) {
        if (p.ws && sockets.has(p.ws as any)) {
          return { status: 'playing', playingRoomCode: room.code };
        }
      }
    }
    return { status: 'online' };
  }

  private broadcastPresence(userId: string, status: FriendPresenceStatus, playingRoomCode?: string) {
    const msg = {
      type: 'friend:presence' as const,
      userId,
      status,
      playingRoomCode,
    };
    for (const ws of this.socketUser.keys()) {
      send(ws, msg);
    }
  }

  private unbindSocketUser(ws: UniversalWebSocket): void {
    const info = this.socketUser.get(ws);
    if (!info) return;
    this.socketUser.delete(ws);
    const set = this.userSockets.get(info.userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      this.userSockets.delete(info.userId);
      this.broadcastPresence(info.userId, 'offline');
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket();
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'Content-Type, Authorization',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
        },
      });
    }

    const path = url.pathname;

    // --- REST APIs ---
    try {
      // 1. Guest auto-login
      if (path === '/api/auth/guest' && request.method === 'POST') {
        const body = await readJsonBody(request) ?? {};
        const result = await this.db.createGuest(body?.nickname);
        return jsonResponse(result);
      }

      // 2. Register
      if (path === '/api/auth/register' && request.method === 'POST') {
        const body = await readJsonBody(request);
        if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
          return jsonResponse({ error: '请填写账号和密码' }, 400);
        }
        const result = await this.db.register(body.username, body.password, body.nickname);
        if (typeof result === 'string') {
          return jsonResponse({ error: result }, 400);
        }
        return jsonResponse(result);
      }

      // 3. Login
      if (path === '/api/auth/login' && request.method === 'POST') {
        const body = await readJsonBody(request);
        if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
          return jsonResponse({ error: '请填写账号和密码' }, 400);
        }
        const result = await this.db.login(body.username, body.password);
        if (typeof result === 'string') {
          return jsonResponse({ error: result }, 400);
        }
        return jsonResponse(result);
      }

      // 4. Upgrade a guest account without losing its profile, friends or matches
      if (path === '/api/auth/upgrade' && request.method === 'POST') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const body = await readJsonBody(request);
        if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
          return jsonResponse({ error: '请填写新账号和密码' }, 400);
        }
        const result = await this.db.upgradeGuest(userRow.id, body.username, body.password, body.nickname);
        if (typeof result === 'string') return jsonResponse({ error: result }, 400);
        return jsonResponse(result);
      }

      // 5. Change the password and rotate the active session token
      if (path === '/api/auth/password' && request.method === 'POST') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const body = await readJsonBody(request);
        if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
          return jsonResponse({ error: '请填写当前密码和新密码' }, 400);
        }
        const result = await this.db.changePassword(userRow.id, body.currentPassword, body.newPassword);
        if (typeof result === 'string') return jsonResponse({ error: result }, 400);
        return jsonResponse(result);
      }

      // 6. Explicitly revoke the cloud session. Logout remains idempotent so a
      // client can still clear local state when the network is unavailable.
      if (path === '/api/auth/logout' && request.method === 'POST') {
        const token = this.getBearerToken(request);
        if (token) await this.db.revokeToken(token);
        return jsonResponse({ success: true });
      }

      // 7. Profile API (GET & POST)
      if (path === '/api/profile') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        if (request.method === 'GET') {
          const profile = await this.db.getProfile(userRow.id);
          return jsonResponse({ user: profile });
        }

        if (request.method === 'POST') {
          const body = await readJsonBody(request);
          if (!body) return jsonResponse({ error: '资料格式不正确' }, 400);
          const updated = await this.db.updateProfile(userRow.id, body);
          return jsonResponse({ user: updated });
        }
      }

      // 8. Matches & Stats API (GET & POST)
      if (path === '/api/matches') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        if (request.method === 'GET') {
          const mode = (url.searchParams.get('mode') as any) || undefined;
          const limit = Number(url.searchParams.get('limit')) || 50;
          const data = await this.db.getMatches(userRow.id, mode, limit);
          return jsonResponse(data);
        }

        if (request.method === 'POST') {
          const body = (await request.json()) as any;
          if (!body || !body.id) {
            return jsonResponse({ error: '战绩格式不正确' }, 400);
          }
          await this.db.saveMatch(userRow.id, body);
          return jsonResponse({ success: true, id: body.id });
        }
      }

      // 9. Friends: Search Users
      if (path === '/api/friends/search' && request.method === 'GET') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const q = url.searchParams.get('q') || '';
        const results = await this.db.searchUsers(q, userRow.id);
        return jsonResponse({ results });
      }

      // 10. Friends: List Friends with Live Presence
      if (path === '/api/friends/list' && request.method === 'GET') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const rawFriends = await this.db.getFriends(userRow.id);
        const friends = rawFriends.map((f) => {
          const presence = this.getUserPresence(f.userId);
          return {
            ...f,
            status: presence.status,
            playingRoomCode: presence.playingRoomCode,
          };
        });
        return jsonResponse({ friends });
      }

      // 11. Friends: Request List
      if (path === '/api/friends/requests' && request.method === 'GET') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const requests = await this.db.getFriendRequests(userRow.id);
        return jsonResponse({ requests });
      }

      // 12. Friends: Send Friend Request
      if (path === '/api/friends/request' && request.method === 'POST') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const body = (await request.json()) as any;
        if (!body || !body.toUserId) {
          return jsonResponse({ error: '请指定添加的雀友' }, 400);
        }
        const result = await this.db.sendFriendRequest(userRow.id, body.toUserId);
        if (typeof result === 'string') {
          return jsonResponse({ error: result }, 400);
        }
        return jsonResponse(result);
      }

      // 13. Friends: Respond to Friend Request (Accept / Reject)
      if (path === '/api/friends/respond' && request.method === 'POST') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const body = (await request.json()) as any;
        if (!body || !body.requestId || typeof body.accept !== 'boolean') {
          return jsonResponse({ error: '参数不正确' }, 400);
        }
        const result = await this.db.respondFriendRequest(body.requestId, userRow.id, body.accept);
        if (typeof result === 'string') {
          return jsonResponse({ error: result }, 400);
        }
        return jsonResponse(result);
      }

      // 14. Friends: Delete Friend
      if (path === '/api/friends/delete' && request.method === 'POST') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const body = (await request.json()) as any;
        if (!body || !body.friendId) {
          return jsonResponse({ error: '请指定删除的雀友' }, 400);
        }
        await this.db.deleteFriend(userRow.id, body.friendId);
        return jsonResponse({ success: true });
      }

      // 15. Friends: Get Friend Profile & Online Match History
      if (path === '/api/friends/stats' && request.method === 'GET') {
        const token = this.getBearerToken(request);
        if (!token) return jsonResponse({ error: '未登录' }, 401);
        const userRow = await this.db.getUserByToken(token);
        if (!userRow) return jsonResponse({ error: '登录已失效' }, 401);

        const friendId = url.searchParams.get('friendId');
        if (!friendId) return jsonResponse({ error: '缺少 friendId 参数' }, 400);

        const profile = await this.db.getProfile(friendId);
        if (!profile) return jsonResponse({ error: '雀友不存在' }, 404);

        const data = await this.db.getMatches(friendId, 'online', 20);
        const presence = this.getUserPresence(friendId);

        return jsonResponse({
          user: profile,
          stats: data.stats,
          recentMatches: data.matches,
          status: presence.status,
          playingRoomCode: presence.playingRoomCode,
        });
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message || '内部服务器错误' }, 500);
    }

    // Default Health / Info
    return textResponse('pizhou-mahjong-server\n', 200);
  }

  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket inside Cloudflare Worker
    server.accept();

    const uws: UniversalWebSocket = {
      get readyState() {
        return server.readyState;
      },
      send(data: string) {
        try {
          server.send(data);
        } catch {}
      },
      close(code?: number, reason?: string) {
        try {
          server.close(code, reason);
        } catch {}
      },
    };

    server.addEventListener('message', async (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      const message = parseClientMessage(raw);
      if (!message) {
        send(uws, { type: 'error', message: '消息格式不正确' });
        return;
      }

      // Handle Friend WS messages
      if (message.type === 'friend:bindUser') {
        const u = await this.db.getUserByToken(message.token);
        if (u && u.id === message.userId) {
          const previous = this.socketUser.get(uws);
          if (previous && previous.userId !== u.id) this.unbindSocketUser(uws);
          this.socketUser.set(uws, { userId: u.id, token: message.token });
          let set = this.userSockets.get(u.id);
          if (!set) {
            set = new Set();
            this.userSockets.set(u.id, set);
          }
          set.add(uws);
          this.broadcastPresence(u.id, 'online');
        } else {
          this.unbindSocketUser(uws);
        }
        return;
      }

      if (message.type === 'friend:unbindUser') {
        this.unbindSocketUser(uws);
        return;
      }

      if (message.type === 'friend:invite') {
        const info = this.socketUser.get(uws);
        if (!info) return;
        const senderProfile = await this.db.getProfile(info.userId);
        if (!senderProfile) return;

        const targetSockets = this.userSockets.get(message.toUserId);
        if (targetSockets && targetSockets.size > 0) {
          for (const targetWs of targetSockets) {
            send(targetWs, {
              type: 'friend:invited',
              fromUserId: senderProfile.userId,
              fromNickname: senderProfile.nickname,
              fromAvatar: senderProfile.avatar,
              roomCode: message.roomCode,
            });
          }
        }
        return;
      }

      try {
        handleMessage(this.manager, uws as any, message);

        // Update presence status if room state changed
        const info = this.socketUser.get(uws);
        if (info) {
          const presence = this.getUserPresence(info.userId);
          this.broadcastPresence(info.userId, presence.status, presence.playingRoomCode);
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : '服务器错误';
        send(uws, { type: 'error', message: text });
      }
    });

    server.addEventListener('close', () => {
      // Clean up socket user & presence
      this.unbindSocketUser(uws);

      const found = this.manager.dropSocket(uws as any);
      if (!found) return;
      for (const item of found.room.occupied) {
        send(item.ws, {
          type: 'player:disconnected',
          seat: found.player.seat,
          nickname: found.player.nickname,
        });
      }
      broadcastState(found.room);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}

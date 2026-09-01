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
        let body: any = {};
        try {
          body = await request.json();
        } catch {}
        const result = await this.db.createGuest(body?.nickname);
        return jsonResponse(result);
      }

      // 2. Register
      if (path === '/api/auth/register' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (!body || !body.username || !body.password) {
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
        const body = (await request.json()) as any;
        if (!body || !body.username || !body.password) {
          return jsonResponse({ error: '请填写账号和密码' }, 400);
        }
        const result = await this.db.login(body.username, body.password);
        if (typeof result === 'string') {
          return jsonResponse({ error: result }, 400);
        }
        return jsonResponse(result);
      }

      // 4. Profile API (GET & POST)
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
          const body = (await request.json()) as any;
          const updated = await this.db.updateProfile(userRow.id, body || {});
          return jsonResponse({ user: updated });
        }
      }

      // 5. Matches & Stats API (GET & POST)
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

    server.addEventListener('message', (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      const message = parseClientMessage(raw);
      if (!message) {
        send(uws, { type: 'error', message: '消息格式不正确' });
        return;
      }
      try {
        handleMessage(this.manager, uws as any, message);
      } catch (error) {
        const text = error instanceof Error ? error.message : '服务器错误';
        send(uws, { type: 'error', message: text });
      }
    });

    server.addEventListener('close', () => {
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

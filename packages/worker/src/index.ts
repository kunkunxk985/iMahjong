import {
  RoomManager,
  broadcastSettlement,
  broadcastState,
  cancelAllBots,
  cancelBots,
  handleMessage,
  parseClientMessage,
  scheduleBots,
  send,
  type UniversalWebSocket,
} from '@pizhou/server-core';

export interface Env {
  PIZHOU_HUB: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('pizhou-mahjong-server\n', {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'access-control-allow-origin': '*',
        },
      });
    }

    // Forward WebSocket connections to the Global Hub Durable Object
    const id = env.PIZHOU_HUB.idFromName('global_pizhou_hub');
    const stub = env.PIZHOU_HUB.get(id);
    return stub.fetch(request);
  },
};

export class PizhouHubDO {
  private state: DurableObjectState;
  private manager = new RoomManager();
  private timer: any = null;

  constructor(state: DurableObjectState) {
    this.state = state;
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

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('pizhou-mahjong-server\n', { status: 200 });
    }

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

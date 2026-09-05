import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { SERVER_PORT } from '@pizhou/shared';
import { lanAddresses } from './lan.ts';
import {
  RoomManager,
  broadcastSettlement,
  broadcastState,
  parseClientMessage,
  send,
} from './room.ts';
import { cancelAllBots, cancelBots, scheduleBots } from './bots.ts';
import { DiskRoomStore, type RoomPersistenceStore } from './persistence.ts';
import { RateLimiter } from './rateLimiter.ts';
import { handleMessage } from './messageHandler.ts';
import { handleHttpApi } from './httpRouter.ts';
import { DiskAccountStore, type AccountStore } from './accountStore.ts';

export interface StartedServer {
  port: number;
  host: string;
  lan: string[];
  accountStore: AccountStore;
  close: () => Promise<void>;
}

export interface StartServerOptions {
  port?: number;
  host?: string;
  log?: boolean;
  store?: RoomPersistenceStore;
  accountStore?: AccountStore;
  stateDir?: string;
  accountsDir?: string;
  rateLimiter?: RateLimiter;
}

export async function startMahjongServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const port = options.port ?? Number(process.env.PORT ?? SERVER_PORT);
  const host = options.host ?? '0.0.0.0';
  const store = options.store ?? new DiskRoomStore({ dirPath: options.stateDir });
  const accountsDir =
    options.accountsDir ??
    (options.stateDir ? path.join(options.stateDir, 'accounts') : undefined);
  const accountStore = options.accountStore ?? new DiskAccountStore({ dirPath: accountsDir });
  const manager = new RoomManager(store);
  const rateLimiter = options.rateLimiter ?? new RateLimiter();

  // Restore existing rooms and game states from persistent disk store
  await manager.init();
  await accountStore.init();
  for (const room of manager.all()) {
    if (room.solo && room.phase === 'playing') {
      scheduleBots(room);
    }
  }

  const httpServer = createServer(async (req, res) => {
    try {
      const handled = await handleHttpApi(req, res, accountStore);
      if (!handled) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('pizhou-mahjong-server\n');
      }
    } catch (err) {
      console.error('[httpRouter] Unhandled server error:', err);
      if (!res.headersSent) {
        res.writeHead(500, {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
        });
        res.end(JSON.stringify({ error: '服务器内部错误' }));
      }
    }
  });

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: 64 * 1024,
  });

  wss.on('error', () => {
    // Ignore server socket error
  });

  wss.on('wsClientError', (_err, socket) => {
    socket.destroy();
  });

  let socketSeq = 0;
  wss.on('connection', (ws, req) => {
    socketSeq += 1;
    const socketId = socketSeq;
    const socket = ws as unknown as { isAlive: boolean; clientIp: string; socketId: number };
    socket.isAlive = true;
    socket.socketId = socketId;

    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    socket.clientIp = clientIp;

    ws.on('error', () => {
      // Ignore transport or payload limit errors on closing socket
    });

    ws.on('pong', () => {
      socket.isAlive = true;
    });

    ws.on('ping', () => {
      socket.isAlive = true;
      try {
        ws.pong();
      } catch {
        // Ignore errors on closing socket
      }
    });

    ws.on('message', (data) => {
      socket.isAlive = true;

      // Rate limit incoming messages: per socket limit (relaxed on loopback for tests)
      const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
      const socketLimit = isLoopback ? 300 : 50;
      if (!rateLimiter.consume(`sock:${socketId}`, socketLimit, 1000)) {
        send(ws, { type: 'error', message: '消息发送过于频繁，请稍候', code: 'rate-limited' });
        return;
      }
      if (!isLoopback && !rateLimiter.consume(`ip:${clientIp}`, 100, 1000)) {
        send(ws, { type: 'error', message: '消息发送过于频繁，请稍候', code: 'rate-limited' });
        return;
      }

      const message = parseClientMessage(String(data));
      if (!message) {
        send(ws, { type: 'error', message: '消息格式不正确' });
        return;
      }
      try {
        handleMessage(manager, ws, message, { rateLimiter, clientIp });
      } catch (error) {
        const text = error instanceof Error ? error.message : '服务器错误';
        send(ws, { type: 'error', message: text });
      }
    });

    ws.on('close', () => {
      const found = manager.dropSocket(ws);
      if (!found) return;
      for (const item of found.room.occupied) {
        send(item.ws, { type: 'player:disconnected', seat: found.player.seat, nickname: found.player.nickname });
      }
      broadcastState(found.room);
    });
  });

  let tickCount = 0;
  const tick = setInterval(() => {
    const now = Date.now();
    tickCount += 1;

    // Active ping sweep every 10 seconds to detect zombie sockets
    if (tickCount % 10 === 0) {
      for (const client of wss.clients) {
        const socket = client as unknown as { isAlive: boolean };
        if (socket.isAlive === false) {
          client.terminate();
        } else {
          socket.isAlive = false;
          try {
            client.ping();
          } catch {
            client.terminate();
          }
        }
      }
    }

    // Sweep heartbeat-offline players and expired rooms
    const { removed, offline } = manager.sweepDetailed(now);
    for (const roomCode of removed) cancelBots(roomCode);

    for (const { room, player, ws } of offline) {
      if (ws) {
        try {
          ws.close?.(4001, 'Heartbeat timeout');
        } catch {
          // Ignore
        }
      }
      for (const item of room.occupied) {
        send(item.ws, { type: 'player:disconnected', seat: player.seat, nickname: player.nickname });
      }
      broadcastState(room);
    }

    // Game engine tick progression
    for (const room of manager.all()) {
      if (room.game && room.phase === 'playing') {
        const result = room.game.tick(now);
        if (result.changed) {
          manager.persist(room);
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

  await listen(httpServer, port, host);
  const address = httpServer.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : port;
  const lan = lanAddresses();
  if (options.log !== false) {
    console.log('邳州麻将服务已启动');
    console.log(`本机:     ws://localhost:${actualPort}`);
    for (const ip of lan) {
      console.log(`局域网:   ws://${ip}:${actualPort}`);
    }
  }

  return {
    port: actualPort,
    host,
    lan,
    accountStore,
    close: () =>
      new Promise((resolve) => {
        clearInterval(tick);
        cancelAllBots();
        rateLimiter.destroy();
        for (const client of wss.clients) {
          try {
            client.terminate();
          } catch {
            // Ignore
          }
        }
        wss.close();
        httpServer.close(() => resolve());
      }),
  };
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListen);
      reject(error);
    };
    const onListen = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListen);
    server.listen(port, host);
  });
}

export async function probeMahjongServer(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const text = await res.text();
    return text.includes('pizhou-mahjong-server');
  } catch {
    return false;
  }
}

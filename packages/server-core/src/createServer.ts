import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
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

export interface StartedServer {
  port: number;
  host: string;
  lan: string[];
  close: () => Promise<void>;
}

export async function startMahjongServer(options: {
  port?: number;
  host?: string;
  log?: boolean;
} = {}): Promise<StartedServer> {
  const port = options.port ?? Number(process.env.PORT ?? SERVER_PORT);
  const host = options.host ?? '0.0.0.0';
  const manager = new RoomManager();

  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('pizhou-mahjong-server\n');
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const message = parseClientMessage(String(data));
      if (!message) {
        send(ws, { type: 'error', message: '消息格式不正确' });
        return;
      }
      try {
        handleMessage(manager, ws, message);
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

  const tick = setInterval(() => {
    const now = Date.now();
    for (const roomCode of manager.sweep(now)) cancelBots(roomCode);
    for (const room of manager.all()) {
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

  await listen(httpServer, port, host);
  const lan = lanAddresses();
  if (options.log !== false) {
    console.log('邳州麻将服务已启动');
    console.log(`本机:     ws://localhost:${port}`);
    for (const ip of lan) {
      console.log(`局域网:   ws://${ip}:${port}`);
    }
  }

  return {
    port,
    host,
    lan,
    close: () =>
      new Promise((resolve) => {
        clearInterval(tick);
        cancelAllBots();
        wss.close();
        httpServer.close(() => resolve());
      }),
  };
}

import { handleMessage } from './messageHandler.ts';

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

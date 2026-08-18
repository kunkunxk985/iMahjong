import { createServer, type Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { SERVER_PORT } from '@pizhou/shared';
import { lanAddresses } from './lan.ts';
import {
  RoomManager,
  broadcastSettlement,
  broadcastState,
  handleAction,
  parseClientMessage,
  send,
} from './room.ts';
import { scheduleBots } from './bots.ts';

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
    manager.sweep(now);
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
        wss.close();
        httpServer.close(() => resolve());
      }),
  };
}

function handleMessage(
  manager: RoomManager,
  ws: WebSocket,
  message: ReturnType<typeof parseClientMessage> & object,
): void {
  if (!message) return;

  if (message.type === 'player:heartbeat' || message.type === 'ping') {
    const found = manager.bySocket(ws);
    if (found) found.room.heartbeat(found.player);
    send(ws, message.type === 'ping' ? { type: 'pong' } : { type: 'player:heartbeat' });
    return;
  }

  if (message.type === 'room:create') {
    const { room, player } = manager.create(message.nickname, ws, Boolean(message.solo));
    send(ws, { type: 'room:created', roomCode: room.code, token: player.token, seat: player.seat });
    if (room.solo) {
      const error = room.startGame();
      if (error) {
        send(ws, { type: 'error', message: error });
        broadcastState(room);
        return;
      }
      send(ws, { type: 'game:roundStarted', view: room.viewFor(player) });
      broadcastState(room);
      scheduleBots(room);
      return;
    }
    broadcastState(room);
    return;
  }

  if (message.type === 'room:join') {
    const result = manager.join(message.roomCode.trim(), message.nickname, ws);
    if (typeof result === 'string') {
      send(ws, { type: 'error', message: result, code: 'join-failed' });
      return;
    }
    send(ws, {
      type: 'room:joined',
      roomCode: result.room.code,
      token: result.player.token,
      seat: result.player.seat,
    });
    broadcastState(result.room);
    return;
  }

  if (message.type === 'player:reconnect') {
    const result = manager.reconnect(message.roomCode.trim(), message.token, ws);
    if (typeof result === 'string') {
      send(ws, { type: 'error', message: result, code: 'reconnect-failed' });
      return;
    }
    send(ws, {
      type: 'player:reconnected',
      roomCode: result.room.code,
      token: result.player.token,
      seat: result.player.seat,
    });
    broadcastState(result.room);
    return;
  }

  const found = manager.bySocket(ws);
  if (!found) {
    send(ws, { type: 'error', message: '请先创建或加入房间' });
    return;
  }
  const { room, player } = found;
  room.heartbeat(player);

  if (message.type === 'room:ready') {
    if (room.phase === 'playing') {
      send(ws, { type: 'error', message: '对局进行中不能改准备状态' });
      return;
    }
    player.ready = message.ready ?? !player.ready;
    broadcastState(room);
    return;
  }

  if (message.type === 'room:start') {
    if (player.seat !== room.hostSeat) {
      send(ws, { type: 'error', message: '只有房主可以开始' });
      return;
    }
    if (room.phase === 'settlement') {
      if (!room.allReady()) {
        send(ws, { type: 'error', message: '所有玩家准备后才能开始' });
        return;
      }
      room.resetToLobbyForAgain();
    }
    const error = room.startGame();
    if (error) {
      send(ws, { type: 'error', message: error });
      return;
    }
    for (const item of room.occupied) {
      send(item.ws, { type: 'game:roundStarted', view: room.viewFor(item) });
    }
    broadcastState(room);
    scheduleBots(room);
    return;
  }

  if (message.type === 'room:leave') {
    const left = manager.leave(ws);
    if (!left) return;
    send(ws, { type: 'error', message: '已离开房间', code: 'left' });
    if (manager.get(left.room.code)) broadcastState(left.room);
    return;
  }

  if (message.type === 'room:again' || message.type === 'game:nextRound') {
    if (room.phase !== 'settlement') {
      send(ws, { type: 'error', message: '只能在结算后开始下一局' });
      return;
    }
    player.ready = true;
    if (room.allReady()) {
      room.resetToLobbyForAgain();
      for (const item of room.occupied) item.ready = true;
      const error = room.startGame();
      if (error) {
        send(ws, { type: 'error', message: error });
        broadcastState(room);
        return;
      }
      for (const item of room.occupied) {
        send(item.ws, { type: 'game:roundStarted', view: room.viewFor(item) });
      }
      broadcastState(room);
      scheduleBots(room);
      return;
    }
    broadcastState(room);
    return;
  }

  if (message.type === 'game:action') {
    const error = handleAction(room, player, message.sequence, message.actionId, message.action);
    if (error) {
      send(ws, { type: 'error', message: error });
      broadcastState(room);
      return;
    }
    if (room.phase === 'settlement' && room.game?.settlement) {
      broadcastSettlement(room, room.game.settlement);
      scheduleBots(room);
      return;
    }
    broadcastState(room);
    scheduleBots(room);
  }
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

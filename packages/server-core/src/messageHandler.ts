import { CHAT_MESSAGE_MAX } from '@pizhou/shared';
import {
  RoomManager,
  broadcastSettlement,
  broadcastState,
  handleAction,
  parseClientMessage,
  send,
  type UniversalWebSocket,
} from './room.ts';
import { cancelBots, scheduleBots } from './bots.ts';
import type { RateLimiter } from './rateLimiter.ts';

export interface MessageHandlerContext {
  rateLimiter?: RateLimiter;
  clientIp?: string;
}

function sanitizeChatMessage(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MESSAGE_MAX);
}

function createChatId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function handleMessage(
  manager: RoomManager,
  ws: UniversalWebSocket,
  message: ReturnType<typeof parseClientMessage> & object,
  context?: MessageHandlerContext,
): void {
  if (!message) return;

  if (message.type === 'player:heartbeat' || message.type === 'ping') {
    const found = manager.bySocket(ws);
    if (found) found.room.heartbeat(found.player);
    send(ws, message.type === 'ping' ? { type: 'pong' } : { type: 'player:heartbeat' });
    return;
  }

  if (message.type === 'room:create') {
    const ip = context?.clientIp ?? '127.0.0.1';
    if (context?.rateLimiter && !context.rateLimiter.consume(`create-room:${ip}`, 5, 60_000)) {
      send(ws, { type: 'error', message: '创建房间过于频繁，请稍后再试', code: 'rate-limited' });
      return;
    }
    const { room, player } = manager.create(
      message.nickname,
      ws,
      Boolean(message.solo),
      message.pointRate,
      message.avatar,
      message.title,
      message.bio,
      message.botCount,
    );
    send(ws, { type: 'room:created', roomCode: room.code, token: player.token, seat: player.seat });
    if (room.solo) {
      const error = room.startGame();
      if (error) {
        send(ws, { type: 'error', message: error });
        broadcastState(room);
        return;
      }
      manager.persist(room);
      send(ws, { type: 'game:roundStarted', view: room.viewFor(player) });
      broadcastState(room);
      scheduleBots(room);
      return;
    }
    broadcastState(room);
    return;
  }

  if (message.type === 'room:join') {
    const result = manager.join(
      message.roomCode.trim(),
      message.nickname,
      ws,
      message.avatar,
      message.title,
      message.bio,
    );
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
    if (message.nickname !== undefined) {
      const profileError = result.room.updatePlayerProfile(
        result.player,
        message.nickname,
        message.avatar,
        message.title,
        message.bio,
      );
      if (profileError) send(ws, { type: 'error', message: profileError, code: 'profile-update-failed' });
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

  // Friend actions are persisted by the Cloudflare Worker. The local core is
  // also used by the desktop preview, so treat these messages as transport
  // no-ops instead of showing a misleading "请先创建或加入房间" error before
  // the player has entered a table.
  if (
    message.type === 'friend:bindUser' ||
    message.type === 'friend:unbindUser' ||
    message.type === 'friend:invite'
  ) {
    return;
  }

  const found = manager.bySocket(ws);
  if (!found) {
    send(ws, { type: 'error', message: '请先创建或加入房间' });
    return;
  }
  const { room, player } = found;
  room.heartbeat(player);

  if (message.type === 'game:chat') {
    if (context?.rateLimiter && !context.rateLimiter.consume(`chat:${room.code}:${player.seat}`, 3, 5000)) {
      send(ws, { type: 'error', message: '发言过于频繁，请稍后再试', code: 'chat-rate-limited' });
      return;
    }
    const content = sanitizeChatMessage(message.message);
    if (!content) {
      send(ws, { type: 'error', message: '互动内容不能为空', code: 'chat-invalid' });
      return;
    }
    const chat = {
      type: 'game:chat' as const,
      id: createChatId(),
      seat: player.seat,
      nickname: player.nickname,
      avatar: player.avatar,
      title: player.title,
      message: content,
      isEmote: Boolean(message.isEmote),
    };
    for (const item of room.occupied) send(item.ws, chat);
    return;
  }

  if (message.type === 'room:ready') {
    if (room.phase === 'playing') {
      send(ws, { type: 'error', message: '对局进行中不能改准备状态' });
      return;
    }
    player.ready = message.ready ?? !player.ready;
    manager.persist(room);
    broadcastState(room);
    return;
  }

  if (message.type === 'player:updateProfile') {
    const profileError = room.updatePlayerProfile(player, message.nickname, message.avatar, message.title, message.bio);
    if (profileError) {
      send(ws, { type: 'error', message: profileError, code: 'profile-update-failed' });
      return;
    }
    manager.persist(room);
    broadcastState(room);
    return;
  }

  if (message.type === 'room:config') {
    if (player.seat !== room.hostSeat) {
      send(ws, { type: 'error', message: '只有房主可以调整底分单价' });
      return;
    }
    if (room.phase !== 'lobby' || room.round > 0) {
      send(ws, { type: 'error', message: '游戏开始后底分单价已固定，不可中途修改' });
      return;
    }
    if (typeof message.pointRate === 'number' && message.pointRate >= 0) {
      room.pointRate = message.pointRate;
      manager.persist(room);
      broadcastState(room);
    }
    return;
  }

  if (message.type === 'room:bot:add') {
    if (player.seat !== room.hostSeat) {
      send(ws, { type: 'error', message: '只有房主可以添加陪练人机' });
      return;
    }
    if (room.phase !== 'lobby') {
      send(ws, { type: 'error', message: '对局进行中无法添加人机' });
      return;
    }
    const result = room.addBot();
    if (typeof result === 'string') {
      send(ws, { type: 'error', message: result });
      return;
    }
    manager.persist(room);
    broadcastState(room);
    return;
  }

  if (message.type === 'room:bot:remove') {
    if (player.seat !== room.hostSeat) {
      send(ws, { type: 'error', message: '只有房主可以移除陪练人机' });
      return;
    }
    if (room.phase !== 'lobby') {
      send(ws, { type: 'error', message: '对局进行中无法移除人机' });
      return;
    }
    const result = room.removeBot(message.seat);
    if (typeof result === 'string') {
      send(ws, { type: 'error', message: result });
      return;
    }
    manager.persist(room);
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
    manager.persist(room);
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
    else cancelBots(left.room.code);
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
      manager.persist(room);
      for (const item of room.occupied) {
        send(item.ws, { type: 'game:roundStarted', view: room.viewFor(item) });
      }
      broadcastState(room);
      scheduleBots(room);
      return;
    }
    manager.persist(room);
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
    manager.persist(room);
    if (room.phase === 'settlement' && room.game?.settlement) {
      broadcastSettlement(room, room.game.settlement);
      scheduleBots(room);
      return;
    }
    broadcastState(room);
    scheduleBots(room);
  }
}

/** Renderer-side WebSocket transport. Domain rules stay on the server. */
import {
  DEFAULT_AVATAR,
  DEFAULT_TITLE,
  DEFAULT_WS_URL,
  HEARTBEAT_INTERVAL_MS,
  isViewMessage,
  newActionId,
  type C2SMessage,
  type ClientView,
  type FriendInvite,
  type FriendPresenceStatus,
  type GameChatMessage,
  type GameAction,
  type S2CMessage,
  type Settlement,
} from '@pizhou/shared';

export interface ClientHandlers {
  onView: (view: ClientView) => void;
  onSettlement: (settlement: Settlement, view: ClientView) => void;
  onError: (message: string, code?: string) => void;
  onStatus: (status: 'connecting' | 'open' | 'closed') => void;
  onLeft?: () => void;
  onFriendInvited?: (invite: FriendInvite) => void;
  onFriendPresence?: (presence: { userId: string; status: FriendPresenceStatus; playingRoomCode?: string }) => void;
  onChat?: (chat: GameChatMessage) => void;
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export class GameClient {
  url = DEFAULT_WS_URL;
  private ws: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private lastServerActivity = Date.now();
  private handlers: ClientHandlers;
  private pendingReconnect: { roomCode: string; token: string } | null = null;
  private boundUser: { userId: string; token: string } | null = null;
  private playerProfile: { nickname: string; avatar: string; title: string; bio?: string } | null = null;
  private roomActive = false;
  private retries = 0;
  private closedByUser = false;

  constructor(handlers: ClientHandlers) {
    this.handlers = handlers;
  }

  connect(url: string): void {
    this.closedByUser = false;
    this.disconnect(false);
    this.url = url;
    this.handlers.onStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.handlers.onStatus('closed');
      this.handlers.onError('服务器地址格式不正确');
      return;
    }
    this.ws = ws;
    this.lastServerActivity = Date.now();
    this.watchdog = setInterval(() => this.checkWatchdog(), 5000);
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retries = 0;
      this.lastServerActivity = Date.now();
      this.handlers.onStatus('open');
      this.heartbeat = setInterval(() => this.send({ type: 'player:heartbeat' }), HEARTBEAT_INTERVAL_MS);
      this.clearWatchdog();
      this.watchdog = setInterval(() => this.checkWatchdog(), 5000);
      if (this.boundUser) {
        this.send({ type: 'friend:bindUser', userId: this.boundUser.userId, token: this.boundUser.token });
      }
      if (this.pendingReconnect) {
        const pending = this.pendingReconnect;
        this.send({
          type: 'player:reconnect',
          roomCode: pending.roomCode,
          token: pending.token,
          ...(this.playerProfile ?? {}),
        });
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearHeartbeat();
      this.clearWatchdog();
      this.retry = null;
      this.handlers.onStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };
    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.handlers.onError('无法连接服务器');
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.lastServerActivity = Date.now();
      let message: S2CMessage;
      try {
        message = JSON.parse(String(event.data)) as S2CMessage;
      } catch {
        this.handlers.onError('服务器返回了无法识别的消息');
        return;
      }
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        this.handlers.onError('服务器返回了无法识别的消息');
        return;
      }

      if (message.type === 'friend:invited') {
        this.handlers.onFriendInvited?.({
          fromUserId: message.fromUserId,
          fromNickname: message.fromNickname,
          fromAvatar: message.fromAvatar,
          roomCode: message.roomCode,
          timestamp: Date.now(),
        });
        return;
      }

      if (message.type === 'friend:presence') {
        this.handlers.onFriendPresence?.({
          userId: message.userId,
          status: message.status,
          playingRoomCode: message.playingRoomCode,
        });
        return;
      }

      if (message.type === 'game:chat') {
        this.handlers.onChat?.(message);
        return;
      }

      if (isViewMessage(message)) {
        this.roomActive = true;
        if (message.type === 'game:settlement') {
          this.handlers.onSettlement(message.settlement, message.view);
        } else {
          this.handlers.onView(message.view);
        }
        if (message.view.token && message.view.roomCode) {
          this.pendingReconnect = { roomCode: message.view.roomCode, token: message.view.token };
        }
      }
      if (message.type === 'error') {
        if (message.code === 'left' || message.code === 'reconnect-failed') {
          this.pendingReconnect = null;
          this.roomActive = false;
          if (message.code === 'left') {
            this.handlers.onLeft?.();
            return;
          }
        }
        this.handlers.onError(message.message, message.code);
      }
    };
  }

  disconnect(user = true): void {
    this.closedByUser = user;
    this.clearHeartbeat();
    this.clearWatchdog();
    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // Ignore sockets that are already closing.
      }
    }
  }

  bindUser(userId: string, token: string): void {
    this.boundUser = { userId, token };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'friend:bindUser', userId, token });
    }
  }

  unbindUser(): void {
    this.boundUser = null;
    this.playerProfile = null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'friend:unbindUser' });
    }
  }

  setPlayerProfile(nickname: string, avatar = DEFAULT_AVATAR, title = DEFAULT_TITLE, bio?: string): void {
    this.playerProfile = { nickname, avatar, title, bio };
    if (this.roomActive && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'player:updateProfile', nickname, avatar, title, bio });
    }
  }

  inviteFriend(toUserId: string, roomCode: string): void {
    this.send({ type: 'friend:invite', toUserId, roomCode });
  }

  sendChat(message: string, isEmote = false): void {
    this.send({ type: 'game:chat', message, isEmote });
  }

  createRoom(
    nickname: string,
    avatarOrSolo: string | boolean = DEFAULT_AVATAR,
    solo = false,
    title = DEFAULT_TITLE,
    bio?: string,
    botCount?: number,
    pointRate?: number,
  ): void {
    const avatar = typeof avatarOrSolo === 'string' ? avatarOrSolo : DEFAULT_AVATAR;
    const isSolo = typeof avatarOrSolo === 'boolean' ? avatarOrSolo : solo;
    this.playerProfile = { nickname, avatar, title, bio };
    this.send({ type: 'room:create', nickname, avatar, title, bio, solo: isSolo, botCount, pointRate });
  }

  addBot(): void {
    this.send({ type: 'room:bot:add' });
  }

  removeBot(seat?: number): void {
    this.send({ type: 'room:bot:remove', seat });
  }

  joinRoom(roomCode: string, nickname: string, avatar = DEFAULT_AVATAR, title = DEFAULT_TITLE, bio?: string): void {
    this.playerProfile = { nickname, avatar, title, bio };
    this.send({ type: 'room:join', roomCode, nickname, avatar, title, bio });
  }

  leave(): void {
    this.pendingReconnect = null;
    this.roomActive = false;
    this.send({ type: 'room:leave' });
  }

  ready(ready: boolean): void {
    this.send({ type: 'room:ready', ready });
  }

  start(): void {
    this.send({ type: 'room:start' });
  }

  setConfig(config: { pointRate: number }): void {
    this.send({ type: 'room:config', pointRate: config.pointRate });
  }

  again(): void {
    this.send({ type: 'game:nextRound' });
  }

  reconnect(roomCode: string, token: string): void {
    this.pendingReconnect = { roomCode, token };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'player:reconnect', roomCode, token, ...(this.playerProfile ?? {}) });
    }
  }

  action(sequence: number, action: GameAction): void {
    this.send({ type: 'game:action', sequence, actionId: newActionId(), action });
  }

  private scheduleReconnect(): void {
    if (!this.pendingReconnect || this.retries >= 30) return;
    this.retries += 1;
    // Exponential backoff with random jitter: base 500ms, multiplier 1.8, max 10s
    const base = Math.min(500 * Math.pow(1.8, Math.max(0, this.retries - 1)), 10_000);
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.round(base * jitter);
    this.retry = setTimeout(() => this.connect(this.url), delay);
  }

  private checkWatchdog(): void {
    if (!this.ws) return;
    if (Date.now() - this.lastServerActivity > 25_000) {
      // Retire the socket ourselves: a half-open connection may never emit close.
      this.disconnect(false);
      this.handlers.onStatus('closed');
      this.handlers.onError(
        this.pendingReconnect ? '网络连接响应超时，正在自动重连...' : '网络连接响应超时，请重新连接服务器',
        'watchdog-timeout',
      );
      this.scheduleReconnect();
    }
  }

  private send(message: C2SMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.handlers.onError('尚未连上服务器');
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private clearWatchdog(): void {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }
}

export function isLoopbackWs(url: string): boolean {
  return /^wss?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url.trim());
}

import {
  DEFAULT_WS_URL,
  HEARTBEAT_INTERVAL_MS,
  isViewMessage,
  newActionId,
  type C2SMessage,
  type ClientView,
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
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export class GameClient {
  url = DEFAULT_WS_URL;
  private ws: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private handlers: ClientHandlers;
  private pendingReconnect: { roomCode: string; token: string } | null = null;
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
    ws.onopen = () => {
      this.retries = 0;
      this.handlers.onStatus('open');
      this.heartbeat = setInterval(() => this.send({ type: 'player:heartbeat' }), HEARTBEAT_INTERVAL_MS);
      if (this.pendingReconnect) {
        const pending = this.pendingReconnect;
        this.send({ type: 'player:reconnect', roomCode: pending.roomCode, token: pending.token });
      }
    };
    ws.onclose = () => {
      this.clearHeartbeat();
      this.retry = null;
      this.handlers.onStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };
    ws.onerror = () => {
      this.handlers.onError('无法连接服务器');
    };
    ws.onmessage = (event) => {
      let message: S2CMessage;
      try {
        message = JSON.parse(String(event.data)) as S2CMessage;
      } catch {
        this.handlers.onError('服务器返回了无法识别的消息');
        return;
      }
      if (isViewMessage(message)) {
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
        if (message.code === 'left') {
          this.pendingReconnect = null;
          this.handlers.onLeft?.();
          return;
        }
        this.handlers.onError(message.message, message.code);
      }
    };
  }

  disconnect(user = true): void {
    this.closedByUser = user;
    this.clearHeartbeat();
    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  createRoom(nickname: string, solo = false): void {
    this.send({ type: 'room:create', nickname, solo });
  }

  joinRoom(roomCode: string, nickname: string): void {
    this.send({ type: 'room:join', roomCode, nickname });
  }

  leave(): void {
    this.pendingReconnect = null;
    this.send({ type: 'room:leave' });
  }

  ready(ready: boolean): void {
    this.send({ type: 'room:ready', ready });
  }

  start(): void {
    this.send({ type: 'room:start' });
  }

  again(): void {
    this.send({ type: 'game:nextRound' });
  }

  reconnect(roomCode: string, token: string): void {
    this.pendingReconnect = { roomCode, token };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'player:reconnect', roomCode, token });
    }
  }

  action(sequence: number, action: GameAction): void {
    this.send({ type: 'game:action', sequence, actionId: newActionId(), action });
  }

  private scheduleReconnect(): void {
    if (!this.pendingReconnect || this.retries >= 20) return;
    this.retries += 1;
    this.retry = setTimeout(() => this.connect(this.url), Math.min(1000 * this.retries, 5000));
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
}

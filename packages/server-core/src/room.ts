import { randomInt, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  EMPTY_ROOM_TTL_MS,
  HEARTBEAT_TIMEOUT_MS,
  NICKNAME_MAX,
  PLAYER_COUNT,
  RECONNECT_WINDOW_MS,
  type C2SMessage,
  type ClientView,
  type GameAction,
  type RoomPhase,
  type S2CMessage,
  type Settlement,
} from '@pizhou/shared';
import { nextDealer, PizhouGame, type PlayerMeta } from '@pizhou/rules';

export interface RoomPlayer {
  seat: number;
  nickname: string;
  token: string;
  ready: boolean;
  ws: WebSocket | null;
  lastSeen: number;
  offlineAt: number | null;
  score: number;
  isBot: boolean;
}

export class Room {
  readonly code: string;
  readonly createdAt = Date.now();
  readonly players: Array<RoomPlayer | null> = [null, null, null, null];
  hostSeat = 0;
  dealer = 0;
  round = 0;
  solo = false;
  game: PizhouGame | null = null;
  phase: RoomPhase = 'lobby';

  constructor(code: string) {
    this.code = code;
  }

  get occupied(): RoomPlayer[] {
    return this.players.filter((player): player is RoomPlayer => player !== null);
  }

  get onlineCount(): number {
    return this.occupied.filter((player) => player.isBot || (player.ws && player.offlineAt === null)).length;
  }

  addPlayer(nickname: string, ws: WebSocket): RoomPlayer | string {
    const seat = this.players.findIndex((player) => player === null);
    if (seat < 0) return '房间已满';
    const name = sanitizeNickname(nickname, seat);
    if (this.occupied.some((player) => player.nickname === name)) return '昵称已被使用';
    const player: RoomPlayer = {
      seat,
      nickname: name,
      token: randomUUID(),
      ready: false,
      ws,
      lastSeen: Date.now(),
      offlineAt: null,
      score: 0,
      isBot: false,
    };
    this.players[seat] = player;
    if (this.occupied.length === 1) this.hostSeat = seat;
    return player;
  }

  addBot(nickname: string): RoomPlayer | string {
    const seat = this.players.findIndex((player) => player === null);
    if (seat < 0) return '房间已满';
    const player: RoomPlayer = {
      seat,
      nickname,
      token: randomUUID(),
      ready: true,
      ws: null,
      lastSeen: Date.now(),
      offlineAt: null,
      score: 0,
      isBot: true,
    };
    this.players[seat] = player;
    return player;
  }

  fillSoloBots(): void {
    const names = ['陪练·南', '陪练·西', '陪练·北'];
    for (const name of names) {
      const added = this.addBot(name);
      if (typeof added === 'string') break;
    }
  }

  removePlayer(player: RoomPlayer): void {
    this.players[player.seat] = null;
    if (player.seat === this.hostSeat) {
      this.hostSeat = this.occupied[0]?.seat ?? 0;
    }
  }

  findByToken(token: string): RoomPlayer | null {
    return this.occupied.find((player) => player.token === token) ?? null;
  }

  findBySocket(ws: WebSocket): RoomPlayer | null {
    return this.occupied.find((player) => player.ws === ws) ?? null;
  }

  markOffline(player: RoomPlayer, now = Date.now()): void {
    player.ws = null;
    player.offlineAt = now;
  }

  reconnect(player: RoomPlayer, ws: WebSocket, now = Date.now()): string | null {
    if (player.offlineAt && now - player.offlineAt > RECONNECT_WINDOW_MS) {
      return '重连已超过30分钟';
    }
    player.ws = ws;
    player.offlineAt = null;
    player.lastSeen = now;
    return null;
  }

  allReady(): boolean {
    return this.occupied.length === PLAYER_COUNT && this.occupied.every((player) => player.ready);
  }

  canStart(): boolean {
    return this.phase !== 'playing' && this.allReady();
  }

  startGame(): string | null {
    if (this.occupied.length !== PLAYER_COUNT) return '需要4名玩家';
    if (!this.allReady()) return '所有玩家准备后才能开始';
    if (this.round === 0) this.dealer = this.hostSeat;
    this.round += 1;
    this.game = new PizhouGame({ dealer: this.dealer, timeoutMs: this.solo ? 18_000 : undefined });
    this.phase = 'playing';
    return null;
  }

  nextRoundDealer(): number {
    const settlement = this.game?.settlement;
    if (!settlement) return this.dealer;
    return nextDealer(this.dealer, settlement.winnerSeat, settlement.liuju);
  }

  applySettlementTotals(): void {
    const settlement = this.game?.settlement;
    if (!settlement) return;
    for (const item of settlement.scores) {
      const player = this.players[item.seat];
      if (!player) continue;
      player.score += item.delta;
      item.nickname = player.nickname;
      item.total = player.score;
    }
    if (settlement.winnerSeat !== null) {
      settlement.winnerNickname = this.players[settlement.winnerSeat]?.nickname ?? null;
    }
    this.phase = 'settlement';
    for (const player of this.occupied) player.ready = player.isBot;
  }

  resetToLobbyForAgain(): void {
    this.dealer = this.nextRoundDealer();
    this.game = null;
    this.phase = 'lobby';
  }

  heartbeat(player: RoomPlayer, now = Date.now()): void {
    player.lastSeen = now;
  }

  sweep(now = Date.now()): { heartbeatOffline: RoomPlayer[]; expired: boolean } {
    const heartbeatOffline: RoomPlayer[] = [];
    for (const player of this.occupied) {
      if (player.isBot) continue;
      if (player.ws && now - player.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        this.markOffline(player, now);
        heartbeatOffline.push(player);
      }
    }
    const lastActivity = Math.max(
      this.createdAt,
      ...this.occupied.map((player) => player.offlineAt ?? player.lastSeen),
    );
    const expired = this.onlineCount === 0 && now - lastActivity > EMPTY_ROOM_TTL_MS;
    return { heartbeatOffline, expired };
  }

  viewFor(player: RoomPlayer): ClientView {
    const metas: PlayerMeta[] = [0, 1, 2, 3].map((seat) => {
      const item = this.players[seat];
      return {
        nickname: item?.nickname ?? `空位${seat + 1}`,
        ready: item?.ready ?? false,
        online: Boolean(item && (item.isBot || (item.ws && item.offlineAt === null))),
        isHost: seat === this.hostSeat,
        isBot: item?.isBot,
        score: item?.score ?? 0,
      };
    });

    if (this.game) {
      return this.game.getClientView({
        mySeat: player.seat,
        roomCode: this.code,
        token: player.token,
        hostSeat: this.hostSeat,
        metas,
        round: this.round,
      });
    }

    return {
      sequence: 0,
      roomCode: this.code,
      mySeat: player.seat,
      token: player.token,
      phase: this.phase,
      gamePhase: null,
      dealer: this.dealer,
      currentSeat: null,
      wallCount: 0,
      turnDeadline: null,
      lastDiscard: null,
      players: [0, 1, 2, 3].map((seat) => ({
        seat,
        nickname: metas[seat]!.nickname,
        ready: metas[seat]!.ready,
        online: metas[seat]!.online,
        isHost: metas[seat]!.isHost,
        isDealer: seat === this.dealer,
        isBot: metas[seat]!.isBot,
        score: metas[seat]!.score,
        handCount: 0,
        discards: [],
        melds: [],
        ...(seat === player.seat ? { hand: [] } : {}),
      })),
      availableActions: [],
      settlement: null,
      hostSeat: this.hostSeat,
      round: this.round,
    };
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  create(nickname: string, ws: WebSocket, solo = false): { room: Room; player: RoomPlayer } {
    const room = new Room(this.uniqueCode());
    const player = room.addPlayer(nickname, ws);
    if (typeof player === 'string') throw new Error(player);
    if (solo) {
      room.solo = true;
      player.ready = true;
      room.fillSoloBots();
    }
    this.rooms.set(room.code, room);
    return { room, player };
  }

  join(roomCode: string, nickname: string, ws: WebSocket): { room: Room; player: RoomPlayer } | string {
    const room = this.rooms.get(roomCode.trim().toUpperCase());
    if (!room) return '房间不存在';
    if (room.phase === 'playing') return '对局已开始，请使用重连';
    if (room.occupied.length >= PLAYER_COUNT) return '房间已满';
    const player = room.addPlayer(nickname, ws);
    if (typeof player === 'string') return player;
    return { room, player };
  }

  leave(ws: WebSocket): { room: Room; player: RoomPlayer; removed: boolean } | null {
    const found = this.bySocket(ws);
    if (!found) return null;
    if (found.room.phase === 'lobby') {
      found.room.removePlayer(found.player);
      const leftover = found.room.occupied;
      if (leftover.length === 0 || leftover.every((item) => item.isBot)) {
        this.rooms.delete(found.room.code);
      }
      return { ...found, removed: true };
    }
    found.room.markOffline(found.player);
    return { ...found, removed: false };
  }

  reconnect(roomCode: string, token: string, ws: WebSocket): { room: Room; player: RoomPlayer } | string {
    const room = this.rooms.get(roomCode);
    if (!room) return '房间不存在';
    const player = room.findByToken(token);
    if (!player) return '找不到原来的座位';
    const error = room.reconnect(player, ws);
    if (error) return error;
    return { room, player };
  }

  bySocket(ws: WebSocket): { room: Room; player: RoomPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.findBySocket(ws);
      if (player) return { room, player };
    }
    return null;
  }

  dropSocket(ws: WebSocket): { room: Room; player: RoomPlayer } | null {
    const found = this.bySocket(ws);
    if (!found) return null;
    found.room.markOffline(found.player);
    return found;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  all(): Room[] {
    return [...this.rooms.values()];
  }

  sweep(now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      const { expired } = room.sweep(now);
      if (expired) this.rooms.delete(code);
    }
  }

  private uniqueCode(): string {
    for (let i = 0; i < 50; i += 1) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('无法分配房间号');
  }
}

export function sanitizeNickname(raw: string, seat: number): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
  return trimmed || `玩家${seat + 1}`;
}

export function send(ws: WebSocket | null, message: S2CMessage): void {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(message));
}

export function broadcastState(room: Room): void {
  for (const player of room.occupied) {
    send(player.ws, { type: 'game:state', view: room.viewFor(player) });
  }
}

export function broadcastSettlement(room: Room, settlement: Settlement): void {
  for (const player of room.occupied) {
    send(player.ws, { type: 'game:settlement', settlement, view: room.viewFor(player) });
  }
}

export function parseClientMessage(raw: string): C2SMessage | null {
  try {
    const data = JSON.parse(raw) as C2SMessage;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function handleAction(room: Room, player: RoomPlayer, sequence: number, actionId: string, action: GameAction): string | null {
  if (!room.game || room.phase !== 'playing') return '还没开始对局';
  const result = room.game.apply(player.seat, action, actionId, sequence);
  if (result.duplicate) return null;
  if (!result.ok) return result.error ?? '操作失败';
  if (room.game.settlement) room.applySettlementTotals();
  return null;
}

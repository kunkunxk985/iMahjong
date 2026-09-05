import { randomUUID } from 'node:crypto';
import {
  EMPTY_ROOM_TTL_MS,
  HEARTBEAT_TIMEOUT_MS,
  PLAYER_COUNT,
  RECONNECT_WINDOW_MS,
  DEFAULT_AVATAR,
  DEFAULT_TITLE,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  sanitizeAvatar,
  sanitizeProfileTitle,
  sanitizeProfileBio,
  sanitizeNickname,
  type C2SMessage,
  type ClientView,
  type GameAction,
  type RoomPhase,
  type S2CMessage,
  type Settlement,
} from '@pizhou/shared';
import { nextDealer, PizhouGame, type PlayerMeta } from '@pizhou/rules';
import type { RoomPersistenceStore } from './persistence.ts';

export type UniversalWebSocket = {
  readyState: number;
  send(data: string): void;
  close?(code?: number, reason?: string): void;
};

export interface RoomPlayer {
  seat: number;
  nickname: string;
  avatar: string;
  title: string;
  bio?: string;
  token: string;
  ready: boolean;
  ws: UniversalWebSocket | null;
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
  pointRate = 0.1;
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

  addPlayer(
    nickname: string,
    ws: UniversalWebSocket,
    avatar = DEFAULT_AVATAR,
    title = DEFAULT_TITLE,
    bio?: string,
  ): RoomPlayer | string {
    const seat = this.players.findIndex((player) => player === null);
    if (seat < 0) return '房间已满';
    const name = sanitizeNickname(nickname, `玩家${seat + 1}`);
    if (this.occupied.some((player) => player.nickname === name)) return '昵称已被使用';
    const player: RoomPlayer = {
      seat,
      nickname: name,
      avatar: sanitizeAvatar(avatar),
      title: sanitizeProfileTitle(title),
      bio: typeof bio === 'string' ? sanitizeProfileBio(bio) : undefined,
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

  addBot(nickname?: string): RoomPlayer | string {
    const seat = this.players.findIndex((player) => player === null);
    if (seat < 0) return '房间已满';
    const botPresets = [
      { name: '陪练·阿东', avatar: 'guofeng_yushi', title: '稳健防守', bio: '牌风稳健，主打不点炮！' },
      { name: '陪练·阿南', avatar: 'guofeng_mingling', title: '巧变千金', bio: '不碰坎不上，单钓不换张！' },
      { name: '陪练·阿西', avatar: 'guofeng_daoshi', title: '运河隐士', bio: '专吃上家，卡张就摸！' },
      { name: '陪练·阿北', avatar: 'guofeng_nuxia', title: '决断如电', bio: '快手出牌，绝不拖泥带水！' },
    ];
    const defaultPreset = botPresets[seat] ?? botPresets[0];
    const chosenName = nickname?.trim() || (this.occupied.some((p) => p.nickname === defaultPreset.name) ? `陪练·${seat + 1}号` : defaultPreset.name);
    const player: RoomPlayer = {
      seat,
      nickname: chosenName,
      avatar: defaultPreset.avatar,
      title: defaultPreset.title,
      bio: defaultPreset.bio,
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

  addBots(count: number): number {
    let addedCount = 0;
    const toAdd = Math.min(count, PLAYER_COUNT - this.occupied.length);
    for (let i = 0; i < toAdd; i++) {
      const added = this.addBot();
      if (typeof added === 'string') break;
      addedCount += 1;
    }
    return addedCount;
  }

  removeBot(seat?: number): boolean | string {
    if (typeof seat === 'number') {
      const player = this.players[seat];
      if (!player) return '该位置没有玩家';
      if (!player.isBot) return '无法移除真实玩家';
      this.players[seat] = null;
      return true;
    }
    for (let i = this.players.length - 1; i >= 0; i--) {
      const player = this.players[i];
      if (player && player.isBot) {
        this.players[i] = null;
        return true;
      }
    }
    return '房间内没有陪练人机';
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
      const nextHuman = this.occupied.find((item) => !item.isBot);
      this.hostSeat = nextHuman ? nextHuman.seat : (this.occupied[0]?.seat ?? 0);
    }
  }

  findByToken(token: string): RoomPlayer | null {
    return this.occupied.find((player) => player.token === token) ?? null;
  }

  findBySocket(ws: UniversalWebSocket): RoomPlayer | null {
    return this.occupied.find((player) => player.ws === ws) ?? null;
  }

  markOffline(player: RoomPlayer, now = Date.now()): void {
    player.ws = null;
    player.offlineAt = now;
  }

  reconnect(player: RoomPlayer, ws: UniversalWebSocket, now = Date.now()): string | null {
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
    return nextDealer(this.dealer, settlement.winnerSeat, settlement.liuju, settlement.drawReason);
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

  updatePlayerProfile(player: RoomPlayer, nickname: string, avatar?: string, title?: string, bio?: string): string | null {
    const name = sanitizeNickname(nickname, player.nickname);
    if (this.occupied.some((item) => item !== player && item.nickname === name)) {
      return '昵称已被使用';
    }
    player.nickname = name;
    player.avatar = sanitizeAvatar(avatar, player.avatar);
    player.title = sanitizeProfileTitle(title, player.title);
    if (typeof bio === 'string') {
      player.bio = sanitizeProfileBio(bio, player.bio);
    }
    return null;
  }

  heartbeat(player: RoomPlayer, now = Date.now()): void {
    player.lastSeen = now;
  }

  sweep(now = Date.now()): {
    heartbeatOffline: Array<{ player: RoomPlayer; ws: UniversalWebSocket | null }>;
    expired: boolean;
  } {
    const heartbeatOffline: Array<{ player: RoomPlayer; ws: UniversalWebSocket | null }> = [];
    for (const player of this.occupied) {
      if (player.isBot) continue;
      if (player.ws && now - player.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        const socket = player.ws;
        this.markOffline(player, now);
        heartbeatOffline.push({ player, ws: socket });
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
        avatar: item?.avatar ?? DEFAULT_AVATAR,
        title: item?.title ?? DEFAULT_TITLE,
        bio: item?.bio,
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
        pointRate: this.pointRate,
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
        avatar: metas[seat]!.avatar ?? DEFAULT_AVATAR,
        title: metas[seat]!.title ?? DEFAULT_TITLE,
        bio: metas[seat]!.bio,
        ready: metas[seat]!.ready,
        online: metas[seat]!.online,
        isHost: metas[seat]!.isHost,
        isDealer: seat === this.dealer,
        closed: false,
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
      pointRate: this.pointRate,
    };
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly store?: RoomPersistenceStore;

  constructor(store?: RoomPersistenceStore) {
    this.store = store;
  }

  async init(): Promise<void> {
    if (!this.store) return;
    const loaded = await this.store.loadAllRooms();
    for (const room of loaded) {
      this.rooms.set(room.code, room);
    }
  }

  persist(room: Room): Promise<void> | void {
    if (!this.store) return;
    try {
      const res = this.store.saveRoom(room);
      if (res && typeof (res as Promise<void>).catch === 'function') {
        return (res as Promise<void>).catch((err) => {
          console.error('[RoomManager] Failed to persist room:', err);
        });
      }
    } catch (err) {
      console.error('[RoomManager] Failed to persist room:', err);
    }
  }

  create(
    nickname: string,
    ws: UniversalWebSocket,
    solo = false,
    pointRate = 0.1,
    avatar = DEFAULT_AVATAR,
    title = DEFAULT_TITLE,
    bio?: string,
    botCount?: number,
  ): { room: Room; player: RoomPlayer } {
    const room = new Room(generateRoomCode((code) => this.rooms.has(code)));
    room.pointRate = typeof pointRate === 'number' && pointRate >= 0 ? pointRate : 0.1;
    const player = room.addPlayer(nickname, ws, avatar, title, bio);
    if (typeof player === 'string') throw new Error(player);
    if (solo) {
      room.solo = true;
      player.ready = true;
      room.fillSoloBots();
    } else if (typeof botCount === 'number' && botCount > 0) {
      room.addBots(Math.min(3, Math.max(0, botCount)));
    }
    this.rooms.set(room.code, room);
    this.persist(room);
    return { room, player };
  }

  join(
    roomCode: string,
    nickname: string,
    ws: UniversalWebSocket,
    avatar = DEFAULT_AVATAR,
    title = DEFAULT_TITLE,
    bio?: string,
  ): { room: Room; player: RoomPlayer } | string {
    const code = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(code)) return '房间号应为6位数字';
    const room = this.rooms.get(code);
    if (!room) return '房间不存在';
    if (room.phase === 'playing') return '对局已开始，请使用重连';
    if (room.occupied.length >= PLAYER_COUNT) return '房间已满';
    const player = room.addPlayer(nickname, ws, avatar, title, bio);
    if (typeof player === 'string') return player;
    this.persist(room);
    return { room, player };
  }

  leave(ws: UniversalWebSocket): { room: Room; player: RoomPlayer; removed: boolean } | null {
    const found = this.bySocket(ws);
    if (!found) return null;
    if (found.room.phase === 'lobby') {
      found.room.removePlayer(found.player);
      const leftover = found.room.occupied;
      if (leftover.length === 0 || leftover.every((item) => item.isBot)) {
        this.rooms.delete(found.room.code);
        if (this.store) {
          const res = this.store.deleteRoom(found.room.code);
          if (res && typeof (res as Promise<void>).catch === 'function') {
            (res as Promise<void>).catch(() => {});
          }
        }
      } else {
        this.persist(found.room);
      }
      return { ...found, removed: true };
    }
    found.room.markOffline(found.player);
    this.persist(found.room);
    return { ...found, removed: false };
  }

  reconnect(roomCode: string, token: string, ws: UniversalWebSocket): { room: Room; player: RoomPlayer } | string {
    const code = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(code)) return '房间号应为6位数字';
    const room = this.rooms.get(code);
    if (!room) return '房间不存在';
    const player = room.findByToken(token);
    if (!player) return '找不到原来的座位';
    const error = room.reconnect(player, ws);
    if (error) return error;
    this.persist(room);
    return { room, player };
  }

  bySocket(ws: UniversalWebSocket): { room: Room; player: RoomPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.findBySocket(ws);
      if (player) return { room, player };
    }
    return null;
  }

  dropSocket(ws: UniversalWebSocket): { room: Room; player: RoomPlayer } | null {
    const found = this.bySocket(ws);
    if (!found) return null;
    found.room.markOffline(found.player);
    this.persist(found.room);
    return found;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  all(): Room[] {
    return [...this.rooms.values()];
  }

  sweep(
    now = Date.now(),
    onHeartbeatOffline?: (info: { room: Room; player: RoomPlayer; ws: UniversalWebSocket | null }) => void,
  ): string[] {
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      const { heartbeatOffline, expired } = room.sweep(now);
      for (const item of heartbeatOffline) {
        onHeartbeatOffline?.({ room, player: item.player, ws: item.ws });
      }
      if (heartbeatOffline.length > 0) {
        this.persist(room);
      }
      if (expired) {
        this.rooms.delete(code);
        if (this.store) {
          const res = this.store.deleteRoom(code);
          if (res && typeof (res as Promise<void>).catch === 'function') {
            (res as Promise<void>).catch(() => {});
          }
        }
        removed.push(code);
      }
    }
    return removed;
  }

  sweepDetailed(now = Date.now()): {
    removed: string[];
    offline: Array<{ room: Room; player: RoomPlayer; ws: UniversalWebSocket | null }>;
  } {
    const offline: Array<{ room: Room; player: RoomPlayer; ws: UniversalWebSocket | null }> = [];
    const removed = this.sweep(now, (info) => offline.push(info));
    return { removed, offline };
  }
}

export function send(ws: UniversalWebSocket | null, message: S2CMessage): void {
  if (!ws || ws.readyState !== 1) return;
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

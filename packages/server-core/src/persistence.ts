import fs from 'node:fs';
import path from 'node:path';
import { PizhouGame } from '@pizhou/rules';
import type { RoomPhase } from '@pizhou/shared';
import { Room, type RoomPlayer } from './room.ts';

export type SerializedGameState = ReturnType<typeof PizhouGame.serialize>;

export interface SerializedRoomPlayer {
  seat: number;
  nickname: string;
  avatar: string;
  title: string;
  bio?: string;
  token: string;
  ready: boolean;
  lastSeen: number;
  offlineAt: number | null;
  score: number;
  isBot: boolean;
}

export interface SerializedRoom {
  code: string;
  createdAt: number;
  hostSeat: number;
  dealer: number;
  round: number;
  pointRate: number;
  solo: boolean;
  phase: RoomPhase;
  players: Array<SerializedRoomPlayer | null>;
  game: SerializedGameState | null;
}

export interface RoomPersistenceStore {
  saveRoom(room: Room): Promise<void> | void;
  loadAllRooms(): Promise<Room[]> | Room[];
  deleteRoom(code: string): Promise<void> | void;
}

export function serializeRoom(room: Room): SerializedRoom {
  return {
    code: room.code,
    createdAt: room.createdAt,
    hostSeat: room.hostSeat,
    dealer: room.dealer,
    round: room.round,
    pointRate: room.pointRate,
    solo: room.solo,
    phase: room.phase,
    players: room.players.map((player) => {
      if (!player) return null;
      return {
        seat: player.seat,
        nickname: player.nickname,
        avatar: player.avatar,
        title: player.title,
        bio: player.bio,
        token: player.token,
        ready: player.ready,
        lastSeen: player.lastSeen,
        offlineAt: player.offlineAt,
        score: player.score,
        isBot: player.isBot,
      };
    }),
    game: room.game ? PizhouGame.serialize(room.game) : null,
  };
}

export function deserializeRoom(data: SerializedRoom, now = Date.now()): Room {
  const room = new Room(data.code);
  (room as { createdAt: number }).createdAt = data.createdAt;
  room.hostSeat = data.hostSeat;
  room.dealer = data.dealer;
  room.round = data.round;
  room.pointRate = data.pointRate;
  room.solo = data.solo;
  room.phase = data.phase;

  for (let seat = 0; seat < 4; seat += 1) {
    const pData = data.players[seat];
    if (pData) {
      const player: RoomPlayer = {
        seat: pData.seat,
        nickname: pData.nickname,
        avatar: pData.avatar,
        title: pData.title,
        bio: pData.bio,
        token: pData.token,
        ready: pData.ready,
        ws: null,
        lastSeen: pData.lastSeen,
        offlineAt: pData.isBot ? null : (pData.offlineAt ?? now),
        score: pData.score,
        isBot: pData.isBot,
      };
      room.players[seat] = player;
    } else {
      room.players[seat] = null;
    }
  }

  if (data.game) {
    room.game = PizhouGame.deserialize(data.game);
  }

  return room;
}

export class DiskRoomStore implements RoomPersistenceStore {
  readonly dirPath: string;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(options?: { dirPath?: string }) {
    this.dirPath =
      options?.dirPath ??
      process.env.PIZHOU_STATE_DIR ??
      path.join(process.cwd(), '.pizhou-state', 'rooms');
  }

  async saveRoom(room: Room): Promise<void> {
    const queue = this.queues.get(room.code) ?? Promise.resolve();
    const task = queue.then(async () => {
      const data = serializeRoom(room);
      const json = JSON.stringify(data, null, 2);
      await fs.promises.mkdir(this.dirPath, { recursive: true });

      const targetFile = path.join(this.dirPath, `${room.code}.json`);
      const tempFile = path.join(
        this.dirPath,
        `.tmp-${room.code}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
      );

      await fs.promises.writeFile(tempFile, json, 'utf8');
      await fs.promises.rename(tempFile, targetFile);
    });

    this.queues.set(
      room.code,
      task.catch(() => {}),
    );
    await task;
  }

  async deleteRoom(code: string): Promise<void> {
    const targetFile = path.join(this.dirPath, `${code}.json`);
    try {
      await fs.promises.unlink(targetFile);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async loadAllRooms(): Promise<Room[]> {
    try {
      await fs.promises.mkdir(this.dirPath, { recursive: true });
      const entries = await fs.promises.readdir(this.dirPath, { withFileTypes: true });
      const rooms: Room[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.startsWith('.')) {
          continue;
        }
        const filePath = path.join(this.dirPath, entry.name);
        try {
          const raw = await fs.promises.readFile(filePath, 'utf8');
          const parsed = JSON.parse(raw) as SerializedRoom;
          if (parsed && typeof parsed.code === 'string') {
            const room = deserializeRoom(parsed);
            const { expired } = room.sweep();
            if (expired) {
              await this.deleteRoom(room.code);
            } else {
              rooms.push(room);
            }
          }
        } catch (err) {
          console.error(`[DiskRoomStore] Error loading room snapshot ${entry.name}:`, err);
        }
      }

      return rooms;
    } catch {
      return [];
    }
  }
}

export class MemoryRoomStore implements RoomPersistenceStore {
  private readonly rooms = new Map<string, SerializedRoom>();

  saveRoom(room: Room): void {
    this.rooms.set(room.code, serializeRoom(room));
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code);
  }

  loadAllRooms(): Room[] {
    const result: Room[] = [];
    for (const data of this.rooms.values()) {
      result.push(deserializeRoom(data));
    }
    return result;
  }
}

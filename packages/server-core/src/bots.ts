import type { GameAction } from '@pizhou/shared';
import { broadcastSettlement, broadcastState, handleAction, type Room } from './room.ts';

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleBots(room: Room): void {
  const prev = timers.get(room.code);
  if (prev) clearTimeout(prev);
  if (!room.solo) return;
  if (room.phase === 'settlement') {
    for (const player of room.occupied) {
      if (player.isBot) player.ready = true;
    }
    return;
  }
  if (room.phase !== 'playing' || !room.game) return;
  timers.set(
    room.code,
    setTimeout(() => {
      stepBots(room);
    }, 560),
  );
}

function chooseBotAction(room: Room, seat: number): GameAction | null {
  const game = room.game;
  if (!game) return null;
  const actions = game.availableFor(seat);
  if (actions.length === 0) return null;

  const hu = actions.find((item) => item.kind === 'hu');
  if (hu?.key === 'qidong-gang-hu') {
    return actions.some((item) => item.kind === 'pass') ? { kind: 'pass' } : { kind: 'hu', key: 'qidong-gang-hu' };
  }
  if (hu) return { kind: 'hu' };

  if (actions.some((item) => item.kind === 'discard')) {
    const runtime = game.seats[seat]!;
    const tile =
      runtime.hand.find((item) => item.id === runtime.lastDrawnId) ?? runtime.hand[runtime.hand.length - 1];
    if (tile) return { kind: 'discard', tileId: tile.id };
  }

  if (actions.some((item) => item.kind === 'pass')) return { kind: 'pass' };
  return null;
}

function stepBots(room: Room): void {
  if (!room.game || room.phase !== 'playing') return;
  for (const player of room.occupied) {
    if (!player.isBot) continue;
    const action = chooseBotAction(room, player.seat);
    if (!action) continue;
    const error = handleAction(room, player, room.game.sequence, `bot-${Date.now()}-${player.seat}`, action);
    if (error) continue;
    if (room.game.settlement) {
      for (const item of room.occupied) {
        if (item.isBot) item.ready = true;
      }
      broadcastSettlement(room, room.game.settlement);
      return;
    }
    broadcastState(room);
    scheduleBots(room);
    return;
  }
}

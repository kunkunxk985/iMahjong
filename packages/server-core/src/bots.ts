import { chooseCompanionAction, companionThinkMs } from '@pizhou/rules';
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
    }, botDelayMs(room)),
  );
}

function botDelayMs(room: Room): number {
  const game = room.game;
  if (!game) return 1600;
  const humanBusy = room.occupied.some((player) => !player.isBot && game.availableFor(player.seat).length > 0);
  return companionThinkMs(game.phase, humanBusy);
}

function stepBots(room: Room): void {
  if (!room.game || room.phase !== 'playing') return;
  for (const player of room.occupied) {
    if (!player.isBot) continue;
    const actions = room.game.availableFor(player.seat);
    const action = chooseCompanionAction(actions, room.game.seats[player.seat]!);
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

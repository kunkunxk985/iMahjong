import { chooseCompanionAction, companionThinkMs } from '@pizhou/rules';
import type { PublicPlayerView } from '@pizhou/shared';
import { broadcastSettlement, broadcastState, handleAction, type Room } from './room.ts';

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleBots(room: Room): void {
  const prev = timers.get(room.code);
  if (prev) clearTimeout(prev);
  timers.delete(room.code);
  if (!room.occupied.some((player) => player.isBot)) return;
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
      timers.delete(room.code);
      stepBots(room);
    }, botDelayMs(room)),
  );
}

export function cancelBots(roomCode: string): void {
  const timer = timers.get(roomCode);
  if (timer) clearTimeout(timer);
  timers.delete(roomCode);
}

export function cancelAllBots(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

/** 仅供生命周期测试和诊断使用。 */
export function hasScheduledBots(roomCode: string): boolean {
  return timers.has(roomCode);
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
    if (actions.length === 0) continue;

    // Collect public perspectives and table discards for companion tactical analysis
    const clientView = room.viewFor(player);
    const publicViews = clientView.players.filter((p) => p.seat !== player.seat) as PublicPlayerView[];
    const allDiscards = room.game.seats.flatMap((s) => s.discards);
    const humanBusy = room.occupied.some((p) => !p.isBot && room.game!.availableFor(p.seat).length > 0);

    const action = chooseCompanionAction(
      actions,
      room.game.seats[player.seat]!,
      Math.random,
      {
        publicViews,
        allDiscards,
        currentSeat: player.seat,
        humanBusy,
      },
    );
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

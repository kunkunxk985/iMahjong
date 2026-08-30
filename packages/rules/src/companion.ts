import { isYaoJiu, type AvailableAction, type GameAction, type Tile } from '@pizhou/shared';
import type { SeatRuntime } from './types.ts';

function countKeys(hand: Tile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of hand) counts.set(tile.key, (counts.get(tile.key) ?? 0) + 1);
  return counts;
}

function hasNeighbor(hand: Tile[], tile: Tile): boolean {
  if (tile.suit === 'dragon') return false;
  return hand.some(
    (item) =>
      item.id !== tile.id &&
      item.suit === tile.suit &&
      Math.abs(item.rank - tile.rank) <= 2,
  );
}

/** Lower score = better to discard. */
export function discardScore(tile: Tile, hand: Tile[]): number {
  const counts = countKeys(hand);
  const same = counts.get(tile.key) ?? 0;
  if (same >= 3) return 120;
  if (same === 2) return 70;
  if (hasNeighbor(hand, tile)) return 45;
  if (isYaoJiu(tile)) return 8;
  return 18;
}

export function pickDiscard(hand: Tile[], lastDrawnId?: string): Tile | null {
  if (hand.length === 0) return null;
  let best = hand[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const tile of hand) {
    let score = discardScore(tile, hand);
    if (tile.id === lastDrawnId) score -= 1;
    if (score < bestScore) {
      best = tile;
      bestScore = score;
    }
  }
  return best;
}

function keepPairForChi(hand: Tile[], used: Tile[]): boolean {
  const usedIds = new Set(used.map((tile) => tile.id));
  const leftover = hand.filter((tile) => !usedIds.has(tile.id));
  const counts = countKeys(leftover);
  return used.some((tile) => (counts.get(tile.key) ?? 0) >= 1);
}

/** Milliseconds a companion should wait before acting. */
export function companionThinkMs(
  phase: string,
  humanBusy: boolean,
  rng: () => number = Math.random,
): number {
  if (phase === 'self-turn') return 1500 + Math.floor(rng() * 1000);
  if (humanBusy) return 2200 + Math.floor(rng() * 900);
  return 800 + Math.floor(rng() * 700);
}

export function chooseCompanionAction(
  actions: AvailableAction[],
  seat: SeatRuntime,
  rng: () => number = Math.random,
): GameAction | null {
  if (actions.length === 0) return null;

  const hu = actions.find((item) => item.kind === 'hu');
  if (hu?.key === 'qidong-gang-hu') {
    if (actions.some((item) => item.kind === 'pass') && rng() < 0.72) return { kind: 'pass' };
    return { kind: 'hu', key: 'qidong-gang-hu' };
  }
  if (hu) return { kind: 'hu' };

  const kan = actions.find((item) => item.kind === 'kan');
  if (kan && rng() < 0.85) return { kind: 'kan', key: kan.key, tileIds: kan.tileIds };

  const anGang = actions.find((item) => item.kind === 'an-gang');
  if (anGang) return { kind: 'an-gang', key: anGang.key, tileIds: anGang.tileIds };

  const ziGang = actions.find((item) => item.kind === 'zi-gang');
  if (ziGang) return { kind: 'zi-gang', key: ziGang.key, tileId: ziGang.tileId };

  const mingGang = actions.find((item) => item.kind === 'ming-gang');
  if (mingGang && rng() < 0.85) {
    return { kind: 'ming-gang', key: mingGang.key, tileIds: mingGang.tileIds };
  }

  const peng = actions.find((item) => item.kind === 'peng');
  if (peng) {
    const key = peng.key;
    const sample = seat.hand.find((tile) => tile.key === key);
    const useful = !sample || isYaoJiu(sample) || rng() < 0.7;
    if (useful) return { kind: 'peng', key: peng.key, tileIds: peng.tileIds };
  }

  const chi = actions.find((item) => item.kind === 'chi');
  if (chi?.tiles && !keepPairForChi(seat.hand, chi.tiles.slice(0, 2)) && rng() < 0.55) {
    return { kind: 'chi', tileIds: chi.tileIds };
  }

  const closeGate = actions.find((item) => item.kind === 'close-gate');
  if (closeGate && rng() < 0.8) {
    return { kind: 'close-gate', tileId: closeGate.tileIds?.[0] };
  }

  if (actions.some((item) => item.kind === 'discard')) {
    const tile = pickDiscard(seat.hand, seat.lastDrawnId);
    if (tile) return { kind: 'discard', tileId: tile.id };
  }

  if (actions.some((item) => item.kind === 'pass')) return { kind: 'pass' };
  return null;
}

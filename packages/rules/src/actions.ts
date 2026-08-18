import {
  canFormChow,
  type AvailableAction,
  type GameAction,
  type Tile,
} from '@pizhou/shared';
import { canHuTiles } from './win.ts';
import type { SeatRuntime } from './types.ts';

export function tilesById(tiles: Tile[]): Map<string, Tile> {
  return new Map(tiles.map((tile) => [tile.id, tile]));
}

export function takeTiles(hand: Tile[], ids: string[]): { taken: Tile[]; rest: Tile[] } | null {
  const remaining = hand.slice();
  const taken: Tile[] = [];
  for (const id of ids) {
    const index = remaining.findIndex((tile) => tile.id === id);
    if (index < 0) return null;
    taken.push(remaining.splice(index, 1)[0]!);
  }
  return { taken, rest: remaining };
}

export function tilesOfKey(hand: Tile[], key: string): Tile[] {
  return hand.filter((tile) => tile.key === key);
}

export function findChiOptions(hand: Tile[], discard: Tile): AvailableAction[] {
  if (discard.suit === 'dragon') return [];
  const options: AvailableAction[] = [];
  const seen = new Set<string>();
  const combos: Array<[number, number]> = [
    [discard.rank - 2, discard.rank - 1],
    [discard.rank - 1, discard.rank + 1],
    [discard.rank + 1, discard.rank + 2],
  ];
  for (const [a, b] of combos) {
    if (a < 1 || b > 9) continue;
    const first = hand.find((tile) => tile.suit === discard.suit && tile.rank === a);
    const second = hand.find((tile) => tile.suit === discard.suit && tile.rank === b && tile.id !== first?.id);
    if (!first || !second) continue;
    if (!canFormChow(first, second, discard)) continue;
    const tileIds = [first.id, second.id].sort();
    const sig = tileIds.join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    options.push({
      kind: 'chi',
      tileIds,
      tiles: [first, second, discard],
    });
  }
  return options;
}

export function concealedAnGangActions(hand: Tile[]): AvailableAction[] {
  const groups = new Map<string, Tile[]>();
  for (const tile of hand) {
    const list = groups.get(tile.key) ?? [];
    list.push(tile);
    groups.set(tile.key, list);
  }
  const actions: AvailableAction[] = [];
  for (const [key, list] of groups) {
    if (list.length >= 4) {
      actions.push({
        kind: 'an-gang',
        key,
        tileIds: list.slice(0, 4).map((tile) => tile.id),
        tiles: list.slice(0, 4),
      });
    }
  }
  return actions;
}

export function buGangActions(seat: SeatRuntime): AvailableAction[] {
  const actions: AvailableAction[] = [];
  for (const meld of seat.melds) {
    if (meld.type !== 'peng' || !meld.tiles[0]) continue;
    const key = meld.tiles[0].key;
    const extra = seat.hand.find((tile) => tile.key === key);
    if (extra) {
      actions.push({
        kind: 'bu-gang',
        key,
        tileId: extra.id,
        tiles: [...meld.tiles, extra],
      });
    }
  }
  return actions;
}

export function selfTurnActions(seat: SeatRuntime): AvailableAction[] {
  const actions: AvailableAction[] = [{ kind: 'discard' }];
  if (canHuTiles(seat.hand, seat.melds.length)) {
    actions.push({ kind: 'hu' });
  }
  actions.push(...concealedAnGangActions(seat.hand));
  actions.push(...buGangActions(seat));
  return actions;
}

export function claimActions(input: {
  seat: SeatRuntime;
  discard: Tile;
  fromSeat: number;
  claimerSeat: number;
  reason: 'discard' | 'bu-gang';
}): AvailableAction[] {
  const actions: AvailableAction[] = [];
  const winningTiles = [...input.seat.hand, input.discard];
  if (canHuTiles(winningTiles, input.seat.melds.length)) {
    actions.push({ kind: 'hu' });
  }
  if (input.reason === 'bu-gang') {
    if (actions.length > 0) actions.push({ kind: 'pass' });
    return actions;
  }

  const copies = tilesOfKey(input.seat.hand, input.discard.key);
  if (copies.length >= 3) {
    actions.push({
      kind: 'ming-gang',
      key: input.discard.key,
      tileIds: copies.slice(0, 3).map((tile) => tile.id),
    });
  }
  if (copies.length >= 2) {
    actions.push({
      kind: 'peng',
      key: input.discard.key,
      tileIds: copies.slice(0, 2).map((tile) => tile.id),
    });
  }
  const isXiajia = input.claimerSeat === (input.fromSeat + 1) % 4;
  if (isXiajia) {
    actions.push(...findChiOptions(input.seat.hand, input.discard));
  }
  if (actions.length > 0) actions.push({ kind: 'pass' });
  return actions;
}

export const ACTION_RANK: Record<string, number> = {
  hu: 4,
  'ming-gang': 3,
  'an-gang': 3,
  'bu-gang': 3,
  peng: 2,
  chi: 1,
  discard: 0,
  pass: 0,
};

export function seatDistanceFromDiscarder(seat: number, discarder: number): number {
  return (seat - discarder + 4) % 4;
}

export function isBetterAction(
  a: { seat: number; action: GameAction },
  b: { seat: number; action: GameAction },
  discarder: number,
): boolean {
  const ra = ACTION_RANK[a.action.kind] ?? 0;
  const rb = ACTION_RANK[b.action.kind] ?? 0;
  if (ra !== rb) return ra > rb;
  return seatDistanceFromDiscarder(a.seat, discarder) < seatDistanceFromDiscarder(b.seat, discarder);
}

export function maxPossibleRank(actions: AvailableAction[]): number {
  return actions.reduce((max, action) => Math.max(max, ACTION_RANK[action.kind] ?? 0), 0);
}

export function actionMatchesAvailable(action: GameAction, available: AvailableAction[]): boolean {
  if (action.kind === 'pass') return available.some((item) => item.kind === 'pass');
  if (action.kind === 'discard') return available.some((item) => item.kind === 'discard');
  if (action.kind === 'hu') return available.some((item) => item.kind === 'hu');
  if (action.kind === 'peng' || action.kind === 'ming-gang') {
    return available.some((item) => item.kind === action.kind);
  }
  if (action.kind === 'an-gang') {
    return available.some((item) => item.kind === 'an-gang' && item.key === action.key);
  }
  if (action.kind === 'bu-gang') {
    return available.some((item) => item.kind === 'bu-gang' && (item.key === action.key || item.tileId === action.tileId));
  }
  if (action.kind === 'chi') {
    const want = (action.tileIds ?? []).slice().sort().join(',');
    return available.some((item) => item.kind === 'chi' && (item.tileIds ?? []).slice().sort().join(',') === want);
  }
  return false;
}

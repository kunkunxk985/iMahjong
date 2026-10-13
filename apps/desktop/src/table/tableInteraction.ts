import type { AvailableAction, GameAction } from '@pizhou/shared';

export function retainHandSelection(hand: readonly { id: string }[], selectedId: string | null): string | null {
  return selectedId && hand.some((tile) => tile.id === selectedId) ? selectedId : null;
}

export function resolveDiscard(hand: readonly { id: string }[], tileId: string | null, canDiscard: boolean): GameAction | null {
  if (!tileId || !canDiscard) return null;
  const tile = hand.find((item) => item.id === tileId);
  return tile ? { kind: 'discard', tileId: tile.id } : null;
}

export function resolveTableAction(action: AvailableAction | GameAction, selectedId: string | null): GameAction {
  let tileId = action.tileId;
  if (action.kind === 'close-gate' && !tileId) {
    tileId = selectedId && action.tileIds?.includes(selectedId) ? selectedId : action.tileIds?.[0];
  }
  return { kind: action.kind, tileId, tileIds: action.tileIds, key: action.key };
}

export interface TableKeyState {
  hand: readonly { id: string }[];
  selectedId: string | null;
  lastDrawnId?: string;
  canDiscard: boolean;
  actions: readonly AvailableAction[];
}

export type TableKeyDecision =
  | { kind: 'ignored' }
  | { kind: 'handled' }
  | { kind: 'select'; tileId: string | null }
  | { kind: 'discard'; tileId: string }
  | { kind: 'action'; action: AvailableAction };

// Decisions only: DOM cancellation and submissions belong to the hook.
export function resolveTableKey(key: string, state: TableKeyState): TableKeyDecision {
  const { hand, selectedId, lastDrawnId } = state;
  const cardIndex = key >= '1' && key <= '9' ? Number(key) - 1
    : key === '0' ? 9 : key === '-' ? 10 : key === '=' ? 11 : null;
  if (cardIndex !== null && cardIndex < hand.length) {
    return { kind: 'select', tileId: hand[cardIndex]!.id };
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (!hand.length) return { kind: 'handled' };
    if (!selectedId) {
      const tile = key === 'ArrowRight' ? hand[0]
        : lastDrawnId ? hand.find((item) => item.id === lastDrawnId) : hand[hand.length - 1];
      return tile ? { kind: 'select', tileId: tile.id } : { kind: 'handled' };
    }
    const index = hand.findIndex((tile) => tile.id === selectedId);
    const next = key === 'ArrowLeft' ? (index > 0 ? index - 1 : hand.length - 1)
      : (index >= 0 && index < hand.length - 1 ? index + 1 : 0);
    return { kind: 'select', tileId: hand[next]!.id };
  }
  if (key === 'Escape') {
    if (selectedId) return { kind: 'select', tileId: null };
    const pass = state.actions.find((action) => action.kind === 'pass');
    return pass ? { kind: 'action', action: pass } : { kind: 'handled' };
  }
  if (key === ' ' || key === 'Enter') {
    // Do not let a second confirm after discarding fall through to hu.
    if (state.canDiscard) {
      return state.selectedId ? { kind: 'discard', tileId: state.selectedId } : { kind: 'handled' };
    }
    const hu = state.actions.find((action) => action.kind === 'hu');
    if (hu) return { kind: 'action', action: hu };
    const claims = state.actions.filter((action) => action.kind !== 'pass' && action.kind !== 'discard');
    return claims.length === 1 ? { kind: 'action', action: claims[0]! } : { kind: 'handled' };
  }
  return { kind: 'ignored' };
}

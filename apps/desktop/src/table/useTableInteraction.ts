import { useCallback, useEffect, useState } from 'react';
import type { AvailableAction, GameAction, Tile } from '@pizhou/shared';
import { resolveDiscard, resolveTableAction, resolveTableKey, retainHandSelection } from './tableInteraction';

interface TableInteractionOptions {
  hand: Tile[];
  lastDrawnId?: string;
  canDiscard: boolean;
  sequence: number;
  actions: AvailableAction[];
  onAction: (action: GameAction) => void;
  noteDiscardSource: (tileId: string) => void;
}

export function useTableInteraction({ hand, lastDrawnId, canDiscard, sequence, actions, onAction, noteDiscardSource }: TableInteractionOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Preserve the existing drawn-tile selection timing (including sequence bumps).
  useEffect(() => {
    if (lastDrawnId && canDiscard) setSelectedId(lastDrawnId);
  }, [lastDrawnId, canDiscard, sequence]);

  useEffect(() => {
    if (selectedId && retainHandSelection(hand, selectedId) === null) setSelectedId(null);
  }, [hand, selectedId]);

  const discardTile = useCallback((tileId: string | null) => {
    const action = resolveDiscard(hand, tileId, canDiscard);
    if (!action) return;
    noteDiscardSource(action.tileId!);
    onAction(action);
    setSelectedId(null);
  }, [hand, canDiscard, noteDiscardSource, onAction]);
  const discard = useCallback(() => discardTile(selectedId), [discardTile, selectedId]);

  const handleAction = useCallback((action: AvailableAction | GameAction) => {
    if (action.kind === 'discard') {
      discard();
      return;
    }
    const resolved = resolveTableAction(action, selectedId);
    if (resolved.kind === 'close-gate' && resolved.tileId) noteDiscardSource(resolved.tileId);
    onAction(resolved);
  }, [discard, selectedId, noteDiscardSource, onAction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
        || event.ctrlKey || event.metaKey || event.altKey) return;
      const decision = resolveTableKey(event.key, { hand, selectedId, lastDrawnId, canDiscard, actions });
      if (decision.kind === 'ignored') return;
      event.preventDefault();
      if (decision.kind === 'select') setSelectedId(decision.tileId);
      else if (decision.kind === 'discard') discardTile(decision.tileId);
      else if (decision.kind === 'action') handleAction(decision.action);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hand, selectedId, lastDrawnId, canDiscard, actions, sequence, discardTile, handleAction]);

  return { selectedId, setSelectedId, discardTile, discard, handleAction };
}

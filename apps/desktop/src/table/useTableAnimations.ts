import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { isPrivatePlayerView, type ClientView, type Tile } from '@pizhou/shared';
import { faceSrc } from '../components/TileView';
import { relativeSeat } from './BoardSeats';
import type { DiscardFlight } from './DiscardFlight';

export function useTableAnimations(boardRef: RefObject<HTMLDivElement>, view: ClientView, myHand: Tile[], lastDrawnId?: string) {
  const pendingDiscardRef = useRef<{
    tileId: string;
    from: DOMRect;
    face: string;
    submittedSequence: number;
  } | null>(null);

  const [enteringId, setEnteringId] = useState<string | undefined>(undefined);
  const [discardFlight, setDiscardFlight] = useState<DiscardFlight | null>(null);
  const [flyingDiscardId, setFlyingDiscardId] = useState<string | null>(null);
  const flyingDiscardIdRef = useRef<string | null>(null);
  const seenDiscardIdRef = useRef<string | null>(null);
  const hasSeenDiscardRef = useRef(false);
  const noteDiscardSource = useCallback((tileId: string) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tile = myHand.find((item) => item.id === tileId);
    const sourceElement = Array.from(
      boardRef.current?.querySelectorAll<HTMLElement>('.board-own-hand .tile[data-tile-id]') ?? [],
    ).find((element) => element.dataset.tileId === tileId);
    const source = sourceElement?.getBoundingClientRect();
    if (!tile || !source) return;
    pendingDiscardRef.current = {
      tileId,
      from: source,
      face: faceSrc(tile),
      submittedSequence: view.sequence,
    };
    flyingDiscardIdRef.current = tileId;
  }, [myHand, view.sequence]);

  useLayoutEffect(() => {
    const pending = pendingDiscardRef.current;
    if (!pending || view.sequence <= pending.submittedSequence) return;
    const currentMe = view.players.find((player) => player.seat === view.mySeat);
    const myDiscardWasAccepted = Boolean(
      currentMe && isPrivatePlayerView(currentMe) && !currentMe.hand.some((tile) => tile.id === pending.tileId),
    );
    if (!myDiscardWasAccepted) {
      pendingDiscardRef.current = null;
      return;
    }
    const target = Array.from(
      boardRef.current?.querySelectorAll<HTMLElement>('[data-discard-tile-id]') ?? [],
    ).find((element) => element.dataset.discardTileId === pending.tileId);
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    const fallbackTarget = new DOMRect(
      boardRect.left + boardRect.width / 2 - 18,
      boardRect.top + boardRect.height * 0.65 - 26,
      36,
      52,
    );

    setFlyingDiscardId(target ? pending.tileId : null);
    flyingDiscardIdRef.current = target ? pending.tileId : null;
    setDiscardFlight({
      flightId: view.sequence,
      from: pending.from,
      to: target?.getBoundingClientRect() ?? fallbackTarget,
      face: pending.face,
    });
    pendingDiscardRef.current = null;
  }, [view.players, view.mySeat, view.sequence]);

  // Opponent discards do not have a local hand element we can measure before
  // the server update.  Once the authoritative discard lands in the view,
  // animate it from that seat's concealed rack into the matching river cell.
  // The first snapshot is intentionally ignored so reconnecting mid-hand does
  // not replay an old discard as if it were a new move.
  useLayoutEffect(() => {
    const discard = view.lastDiscard;
    const discardId = discard?.tile.id ?? null;

    if (!hasSeenDiscardRef.current) {
      hasSeenDiscardRef.current = true;
      seenDiscardIdRef.current = discardId;
      return;
    }

    if (!discardId) {
      seenDiscardIdRef.current = null;
      return;
    }
    if (!discard) return;
    if (discardId === seenDiscardIdRef.current) return;
    seenDiscardIdRef.current = discardId;

    // Manual discards already use the exact hand-tile origin captured by
    // noteDiscardSource().  Skip them here to avoid rendering two flights.
    if (discard.fromSeat === view.mySeat || view.settlement) return;

    const board = boardRef.current;
    if (!board) return;

    const relative = relativeSeat(discard.fromSeat, view.mySeat);
    const position = relative === 0
      ? 'bottom'
      : relative === 1
        ? 'right'
        : relative === 2
          ? 'top'
          : 'left';
    const sourceGroup = board.querySelector<HTMLElement>(`.board-concealed-${position}`);
    const sourceElement = sourceGroup?.querySelector<HTMLElement>('.board-concealed-tile') ?? sourceGroup;
    const source = sourceElement?.getBoundingClientRect();
    const target = Array.from(
      board.querySelectorAll<HTMLElement>('[data-discard-tile-id]'),
    ).find((element) => element.dataset.discardTileId === discardId);
    if (!source || !target) return;

    flyingDiscardIdRef.current = discardId;
    setFlyingDiscardId(discardId);
    setDiscardFlight({
      flightId: view.sequence,
      from: source,
      to: target.getBoundingClientRect(),
      face: faceSrc(discard.tile),
    });
  }, [view.lastDiscard?.tile.id, view.lastDiscard?.fromSeat, view.mySeat, view.sequence, view.settlement]);

  const finishDiscardFlight = useCallback(() => {
    setDiscardFlight(null);
    setFlyingDiscardId(null);
    flyingDiscardIdRef.current = null;
  }, []);

  // Track previous lastDrawnId to detect new draws for entering animation
  const prevDrawnRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Only react to an actual NEW drawn tile; never clear early on unrelated
    // view.sequence bumps, or the 0.48s arc gets cut off mid-flight.
    if (!lastDrawnId || lastDrawnId === prevDrawnRef.current) return;
    setEnteringId(lastDrawnId);
    prevDrawnRef.current = lastDrawnId;
    // Keep the class until draw-arc-in (0.2s) fully finishes
    const timer = setTimeout(() => setEnteringId(undefined), 220);
    return () => clearTimeout(timer);
  }, [lastDrawnId]);

  const myHandIds = myHand.map((t) => t.id).join(',');
  // ── Smooth hand re-sorting: FLIP-slide tiles whose position changed ──
  const handRectsRef = useRef<Map<string, DOMRect>>(new Map());
  useLayoutEffect(() => {
    const row = boardRef.current?.querySelector<HTMLElement>('.board-own-hand');
    if (!row) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(row.querySelectorAll<HTMLElement>('.tile[data-tile-id]'));
    const prev = handRectsRef.current;
    const next = new Map<string, DOMRect>();
    const animations: Array<{ el: HTMLElement; dx: number }> = [];

    // Read phase: measure all rects without layout thrashing
    for (const el of els) {
      const key = el.dataset.tileId!;
      const rect = el.getBoundingClientRect();
      next.set(key, rect);
      const old = prev.get(key);
      if (old && !el.classList.contains('entering')) {
        const dx = old.left - rect.left;
        if (dx !== 0 && Math.abs(dx) < 400) {
          animations.push({ el, dx });
        }
      }
    }
    handRectsRef.current = next;

    // Animate phase: batch start GPU-accelerated transforms
    for (const { el, dx } of animations) {
      el.animate(
        [
          { transform: `translate3d(${dx}px, 0, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        { duration: 160, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' },
      );
    }
  }, [myHandIds]);

  return { enteringId, noteDiscardSource, discardFlight, flyingDiscardId, flyingDiscardIdRef, finishDiscardFlight };
}

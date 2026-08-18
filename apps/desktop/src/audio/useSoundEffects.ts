import { useEffect, useRef } from 'react';
import type { ClientView } from '@pizhou/shared';
import {
  playChi,
  playDiscard,
  playDraw,
  playGang,
  playHu,
  playMyTurn,
  playPeng,
  playTick,
} from './sfx';

/**
 * Diff two consecutive ClientView frames and trigger appropriate sound effects.
 *
 * Runs as a side-effect on every view update. Uses refs to track the previous
 * frame so we can detect exactly what changed.
 */
export function useSoundEffects(view: ClientView): void {
  const prev = useRef<ClientView | null>(null);
  const lastTickTime = useRef(0);

  useEffect(() => {
    const old = prev.current;
    prev.current = view;

    // Skip the very first frame — nothing to diff against
    if (!old) return;

    // Same sequence means no game-state change
    if (old.sequence === view.sequence) return;

    // ── Discard sound ──
    if (
      view.lastDiscard &&
      (!old.lastDiscard || old.lastDiscard.tile.id !== view.lastDiscard.tile.id)
    ) {
      playDiscard();
    }

    // ── Draw sound (my turn, new drawn tile appeared) ──
    const me = view.players.find((p) => p.seat === view.mySeat);
    const oldMe = old.players.find((p) => p.seat === old.mySeat);
    const myLastDrawn = me && 'lastDrawnId' in me ? (me as { lastDrawnId?: string }).lastDrawnId : undefined;
    const oldLastDrawn = oldMe && 'lastDrawnId' in oldMe ? (oldMe as { lastDrawnId?: string }).lastDrawnId : undefined;
    if (myLastDrawn && myLastDrawn !== oldLastDrawn) {
      playDraw();
    }

    // ── Meld sounds (detect new melds across all players) ──
    for (const player of view.players) {
      const oldPlayer = old.players.find((p) => p.seat === player.seat);
      if (!oldPlayer) continue;
      if (player.melds.length > oldPlayer.melds.length) {
        const newMeld = player.melds[player.melds.length - 1];
        if (newMeld) {
          const t = newMeld.type;
          if (t === 'chi') playChi();
          else if (t === 'peng') playPeng();
          else if (t === 'ming-gang' || t === 'an-gang' || t === 'bu-gang') playGang();
        }
      }
    }

    // ── Hu sound ──
    if (
      view.settlement &&
      !old.settlement &&
      view.settlement.winnerSeat !== null
    ) {
      playHu();
    }

    // ── My turn chime ──
    if (
      view.currentSeat === view.mySeat &&
      view.gamePhase === 'self-turn' &&
      (old.currentSeat !== view.mySeat || old.gamePhase !== 'self-turn')
    ) {
      playMyTurn();
    }
  }, [view]);

  // ── Countdown tick (runs on a separate timer, not tied to view updates) ──
  useEffect(() => {
    if (!view.turnDeadline) return;
    if (view.currentSeat !== view.mySeat && view.gamePhase !== 'claim-window') return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((view.turnDeadline! - Date.now()) / 1000);
      if (remaining > 0 && remaining <= 5) {
        const now = Date.now();
        // Rate-limit to at most 1 tick per 800ms
        if (now - lastTickTime.current > 800) {
          lastTickTime.current = now;
          playTick();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [view.turnDeadline, view.currentSeat, view.mySeat, view.gamePhase]);
}

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
  playSettle,
  playHover,
} from './sfx';
import { speakAction, speakDiscardTile } from './voice';

function meldSignature(meld: ClientView['players'][number]['melds'][number]): string {
  return `${meld.type}:${meld.tiles.map((tile) => tile.id).join(',')}:${meld.claimedTileId ?? ''}`;
}

export function useSoundEffects(view: ClientView): void {
  const prev = useRef<ClientView | null>(null);
  const lastTickTime = useRef(0);

  useEffect(() => {
    const old = prev.current;
    prev.current = view;
    if (!old) return;
    if (old.sequence === view.sequence) return;

    // Discard sound + voice
    if (
      view.lastDiscard &&
      (!old.lastDiscard || old.lastDiscard.tile.id !== view.lastDiscard.tile.id)
    ) {
      playDiscard();
      speakDiscardTile(view.lastDiscard.tile.key);
    }

    // Draw sound
    const me = view.players.find((p) => p.seat === view.mySeat);
    const oldMe = old.players.find((p) => p.seat === old.mySeat);
    const myLastDrawn = me && 'lastDrawnId' in me ? (me as { lastDrawnId?: string }).lastDrawnId : undefined;
    const oldLastDrawn = oldMe && 'lastDrawnId' in oldMe ? (oldMe as { lastDrawnId?: string }).lastDrawnId : undefined;
    if (myLastDrawn && myLastDrawn !== oldLastDrawn) {
      playDraw();
    }

    // Meld sounds + voice
    for (const player of view.players) {
      const oldPlayer = old.players.find((p) => p.seat === player.seat);
      if (!oldPlayer) continue;
      const oldMelds = oldPlayer.melds.map(meldSignature);
      const nextMelds = player.melds.map(meldSignature);
      const changedIndex = nextMelds.findIndex((signature, index) => signature !== oldMelds[index]);
      if (player.melds.length > oldPlayer.melds.length || changedIndex >= 0) {
        const newMeld = player.melds[changedIndex >= 0 ? changedIndex : player.melds.length - 1];
        if (newMeld) {
          const t = newMeld.type;
          if (t === 'chi') {
            playChi();
            speakAction('chi');
          } else if (t === 'peng') {
            playPeng();
            speakAction('peng');
          } else if (t === 'kan') {
            playPeng();
            speakAction('kan');
          } else if (t === 'ming-gang' || t === 'an-gang' || t === 'zi-gang') {
            playGang();
            speakAction(t === 'an-gang' ? 'an-gang' : 'gang');
          }
        }
      }

      if (player.closed && !oldPlayer.closed) {
        speakAction('close-gate');
      }
    }

    // Hu sound + voice
    if (
      view.settlement &&
      !old.settlement &&
      view.settlement.winnerSeat !== null
    ) {
      playHu();
      if (view.settlement.baoZhuang) {
        speakAction('baozhuang');
      } else if (view.settlement.winType === 'qidong-gang-hu') {
        speakAction('qidong-gang-hu');
      } else {
        speakAction('hu');
      }
    }

    // Draw closure sound
    if (view.settlement?.liuju && !old.settlement?.liuju) {
      playSettle();
    }

    // My turn chime
    if (
      view.currentSeat === view.mySeat &&
      view.gamePhase === 'self-turn' &&
      (old.currentSeat !== view.mySeat || old.gamePhase !== 'self-turn')
    ) {
      playMyTurn();
    }

  }, [view]);

  // Countdown tick
  useEffect(() => {
    if (!view.turnDeadline) return;
    if (view.currentSeat !== view.mySeat && view.gamePhase !== 'claim-window') return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((view.turnDeadline! - Date.now()) / 1000);
      if (remaining > 0 && remaining <= 5) {
        const now = Date.now();
        if (now - lastTickTime.current > 800) {
          lastTickTime.current = now;
          playTick();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [view.turnDeadline, view.currentSeat, view.mySeat, view.gamePhase]);
}

export function useButtonHoverSound() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches('button, .btn-action, .tab-btn, .rate-chip, .room-code-banner')) {
        playHover();
      }
    };
    window.addEventListener('mouseover', handler, { passive: true });
    return () => window.removeEventListener('mouseover', handler);
  }, []);
}

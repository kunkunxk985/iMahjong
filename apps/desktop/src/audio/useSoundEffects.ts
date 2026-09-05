/**
 * React hook listening to ClientView updates and dispatching
 * natural physical audio effects and authentic voice announcements.
 */

import { useEffect, useRef } from 'react';
import type { ClientView } from '@pizhou/shared';
import {
  playChi,
  playDiscard,
  playDraw,
  playGang,
  playGuanmen,
  playHu,
  playKan,
  playMyTurn,
  playPeng,
  playQidongHu,
  playBaozhuang,
  playShuffle,
  playTick,
  playSettle,
  playHover,
} from './sfx';
import { speakAction, speakDiscardTile } from './voice';
import { soundManager } from './soundManager';

function meldSignature(meld: ClientView['players'][number]['melds'][number]): string {
  return `${meld.type}:${meld.tiles.map((tile) => tile.id).join(',')}:${meld.claimedTileId ?? ''}`;
}

export function useSoundEffects(view: ClientView): void {
  const prev = useRef<ClientView | null>(null);
  const lastTickTime = useRef(0);
  const warmedRef = useRef(false);

  // Warm core sound buffers once on initial mount
  useEffect(() => {
    if (!warmedRef.current) {
      warmedRef.current = true;
      soundManager.warmCoreSounds();
    }
  }, []);

  useEffect(() => {
    const old = prev.current;
    prev.current = view;
    if (!old) return;
    if (old.sequence === view.sequence) return;

    // 1. Shuffle sound on game / round initiation
    if (
      (old.phase !== 'playing' && view.phase === 'playing') ||
      (view.round !== undefined && old.round !== undefined && view.round !== old.round)
    ) {
      playShuffle();
    }

    // 2. Discard physical sound + voice announcement
    if (
      view.lastDiscard &&
      (!old.lastDiscard || old.lastDiscard.tile.id !== view.lastDiscard.tile.id)
    ) {
      playDiscard();
      speakDiscardTile(view.lastDiscard.tile.key);
    }

    // 3. Draw physical slide sound (when current player draws)
    const me = view.players.find((p) => p.seat === view.mySeat);
    const oldMe = old.players.find((p) => p.seat === old.mySeat);
    const myLastDrawn = me && 'lastDrawnId' in me ? (me as { lastDrawnId?: string }).lastDrawnId : undefined;
    const oldLastDrawn = oldMe && 'lastDrawnId' in oldMe ? (oldMe as { lastDrawnId?: string }).lastDrawnId : undefined;
    if (myLastDrawn && myLastDrawn !== oldLastDrawn) {
      playDraw();
    }

    // 4. Melds (Chi, Peng, Kan, Gang, An-Gang, Zi-Gang) & Guan-men (Close Gate)
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
            playKan();
            speakAction('kan');
          } else if (t === 'ming-gang') {
            playGang();
            speakAction('gang');
          } else if (t === 'an-gang') {
            playGang();
            speakAction('an-gang');
          } else if (t === 'zi-gang') {
            playGang();
            speakAction('gang');
          }
        }
      }

      // Guan-men (关门听牌): physical latch lock + voice roar
      if (player.closed && !oldPlayer.closed) {
        playGuanmen();
        speakAction('close-gate');
      }
    }

    // 5. Hu & Settlement (Ping Hu, Bao Zhuang, Qi Dong Gang Hu)
    if (
      view.settlement &&
      !old.settlement &&
      view.settlement.winnerSeat !== null
    ) {
      if (view.settlement.baoZhuang) {
        playBaozhuang();
        speakAction('baozhuang');
      } else if (view.settlement.winType === 'qidong-gang-hu') {
        playQidongHu();
        speakAction('qidong-gang-hu');
      } else {
        playHu();
        speakAction('hu');
      }
    }

    // 6. Draw closure (流局)
    if (view.settlement?.liuju && !old.settlement?.liuju) {
      playSettle();
    }

    // 7. My turn chime
    if (
      view.currentSeat === view.mySeat &&
      view.gamePhase === 'self-turn' &&
      (old.currentSeat !== view.mySeat || old.gamePhase !== 'self-turn')
    ) {
      playMyTurn();
    }
  }, [view]);

  // 8. Countdown tick warning (<= 5s)
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

export function useButtonHoverSound(): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.matches && target.matches('button, .btn-action, .tab-btn, .rate-chip, .room-code-banner, .board-icon-button')) {
        playHover();
      }
    };
    window.addEventListener('mouseover', handler, { passive: true });
    return () => window.removeEventListener('mouseover', handler);
  }, []);
}

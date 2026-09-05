import { useEffect, useRef, useState } from 'react';
import { SEAT_NAMES, type ClientView } from '@pizhou/shared';

interface ActionSplashProps {
  view: ClientView;
}

interface SeatSplashEvent {
  id: number;
  text: string;
  type: 'hu' | 'peng' | 'kan' | 'gang' | 'chi' | 'close-gate';
  seat: number;
  position: 'bottom' | 'top' | 'left' | 'right';
  quadrant: 'sw' | 'ne' | 'nw' | 'se';
  nickname: string;
}

function meldSignature(meld: ClientView['players'][number]['melds'][number]): string {
  return `${meld.type}:${meld.tiles.map((tile) => tile.id).join(',')}:${meld.claimedTileId ?? ''}`;
}

function getRelativePosition(seat: number, mySeat: number): 'bottom' | 'top' | 'left' | 'right' {
  const rel = (seat - mySeat + 4) % 4;
  if (rel === 0) return 'bottom';
  if (rel === 1) return 'right';
  if (rel === 2) return 'top';
  return 'left';
}

/**
 * Maps player relative table positions to the 4 Mid-Ground Diagonal Safe Quadrants
 * to guarantee 100% ZERO occlusion with hand tiles, discard drop points, and river tiles:
 * - bottom (self) -> Q_SW (20% left, 78% top)
 * - top (opposite) -> Q_NE (80% left, 22% top)
 * - left (left player) -> Q_NW (20% left, 22% top / mid-left safe band)
 * - right (right player) -> Q_SE (80% left, 78% top / mid-right safe band)
 */
function getSafeQuadrant(position: 'bottom' | 'top' | 'left' | 'right'): 'sw' | 'ne' | 'nw' | 'se' {
  switch (position) {
    case 'bottom':
      return 'sw';
    case 'top':
      return 'ne';
    case 'left':
      return 'nw';
    case 'right':
      return 'se';
  }
}

export function ActionSplash({ view }: ActionSplashProps) {
  const [splashes, setSplashes] = useState<SeatSplashEvent[]>([]);
  const prevMeldsRef = useRef<Map<number, string[]>>(
    new Map(view.players.map((player) => [player.seat, player.melds.map(meldSignature)])),
  );
  const prevClosedRef = useRef<Map<number, boolean>>(
    new Map(view.players.map((player) => [player.seat, Boolean(player.closed)])),
  );
  const prevSettlementRef = useRef<boolean>(Boolean(view.settlement));

  const triggerSeatSplash = (text: string, type: SeatSplashEvent['type'], seat: number) => {
    const splashId = Date.now() + Math.random();
    const position = getRelativePosition(seat, view.mySeat);
    const quadrant = getSafeQuadrant(position);
    const player = view.players.find((item) => item.seat === seat);
    const nickname = player?.nickname || `${SEAT_NAMES[seat]}位`;

    const newSplash: SeatSplashEvent = {
      id: splashId,
      text,
      type,
      seat,
      position,
      quadrant,
      nickname,
    };

    setSplashes((prev) => [...prev, newSplash]);

    setTimeout(() => {
      setSplashes((prev) => prev.filter((s) => s.id !== splashId));
    }, 1300);
  };

  useEffect(() => {
    // 1. Hu splash
    if (view.settlement && !prevSettlementRef.current) {
      prevSettlementRef.current = true;
      if (view.settlement.winnerSeat !== null && view.settlement.winnerSeat !== undefined) {
        const winnerSeat = view.settlement.winnerSeat;
        const isQiDong = view.settlement.winType === 'qidong-gang-hu';
        triggerSeatSplash(
          isQiDong ? '起手杠胡' : '胡 牌',
          'hu',
          winnerSeat,
        );
      }
    } else if (!view.settlement) {
      prevSettlementRef.current = false;
    }

    // 2. Melds & Closed splash
    view.players.forEach((player) => {
      const nextSignatures = player.melds.map(meldSignature);
      const previousSignatures = prevMeldsRef.current.get(player.seat) ?? [];
      const changedIndex = nextSignatures.findIndex((signature, index) => signature !== previousSignatures[index]);
      if (player.melds.length > previousSignatures.length || changedIndex >= 0) {
        const changedMeld = player.melds[changedIndex >= 0 ? changedIndex : player.melds.length - 1];
        if (changedMeld) {
          if (changedMeld.type === 'kan') {
            triggerSeatSplash('坎 上', 'kan', player.seat);
          } else if (changedMeld.type === 'an-gang' || changedMeld.type === 'zi-gang' || changedMeld.type === 'ming-gang') {
            triggerSeatSplash(changedMeld.type === 'an-gang' ? '暗 杠' : '杠', 'gang', player.seat);
          } else if (changedMeld.type === 'peng') {
            triggerSeatSplash('碰', 'peng', player.seat);
          } else if (changedMeld.type === 'chi') {
            triggerSeatSplash('吃', 'chi', player.seat);
          }
        }
      }
      prevMeldsRef.current.set(player.seat, nextSignatures);

      if (player.closed && !prevClosedRef.current.get(player.seat)) {
        triggerSeatSplash('关 门', 'close-gate', player.seat);
      }
      prevClosedRef.current.set(player.seat, Boolean(player.closed));
    });
  }, [view.sequence, view.settlement, view.players]);

  if (splashes.length === 0) return null;

  return (
    <div className="action-seat-container" aria-live="polite">
      {splashes.map((splash) => (
        <div
          key={splash.id}
          className={`action-seat-splash pos-${splash.position} quadrant-${splash.quadrant} is-${splash.type}`}
          data-seat={splash.seat}
        >
          <div className="action-shockwave-ring ring-1" />
          <div className="action-shockwave-ring ring-2" />
          <div className="action-burst-rays" />
          <div className="action-seat-aura" />
          <div className="action-seat-seal action-seat-pill">
            <div className="action-seal-inner-border" />
            <div className="action-shimmer-sweep" />
            {splash.position !== 'bottom' ? (
              <span className="action-seal-player">{splash.nickname}</span>
            ) : null}
            <span className="action-seat-text">{splash.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

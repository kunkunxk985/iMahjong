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
  nickname: string;
}

function getRelativePosition(seat: number, mySeat: number): 'bottom' | 'top' | 'left' | 'right' {
  const rel = (seat - mySeat + 4) % 4;
  if (rel === 0) return 'bottom';
  if (rel === 1) return 'right';
  if (rel === 2) return 'top';
  return 'left';
}

export function ActionSplash({ view }: ActionSplashProps) {
  const [splashes, setSplashes] = useState<SeatSplashEvent[]>([]);
  const prevMeldsCountsRef = useRef<number[]>([0, 0, 0, 0]);
  const prevClosedRef = useRef<boolean[]>([false, false, false, false]);
  const prevSettlementRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Hu splash
    if (view.settlement && !prevSettlementRef.current) {
      prevSettlementRef.current = true;
      if (view.settlement.winnerSeat !== null && view.settlement.winnerSeat !== undefined) {
        const winnerSeat = view.settlement.winnerSeat;
        const isQiDong = view.settlement.winType === 'qidong-gang-hu';
        triggerSeatSplash(
          isQiDong ? '⚡ 起手杠胡' : '🀄 胡 牌',
          'hu',
          winnerSeat,
        );
      }
    } else if (!view.settlement) {
      prevSettlementRef.current = false;
    }

    // 2. Melds & Closed splash
    view.players.forEach((player, seatIdx) => {
      const meldsCount = player.melds.length;
      const prevCount = prevMeldsCountsRef.current[seatIdx] || 0;
      if (meldsCount > prevCount) {
        const lastMeld = player.melds[meldsCount - 1];
        if (lastMeld) {
          if (lastMeld.type === 'kan') {
            triggerSeatSplash('坎 上', 'kan', seatIdx);
          } else if (lastMeld.type === 'an-gang' || lastMeld.type === 'zi-gang' || lastMeld.type === 'ming-gang') {
            triggerSeatSplash(lastMeld.type === 'an-gang' ? '暗 杠' : '杠', 'gang', seatIdx);
          } else if (lastMeld.type === 'peng') {
            triggerSeatSplash('碰', 'peng', seatIdx);
          } else if (lastMeld.type === 'chi') {
            triggerSeatSplash('吃', 'chi', seatIdx);
          }
        }
      }
      prevMeldsCountsRef.current[seatIdx] = meldsCount;

      if (player.closed && !prevClosedRef.current[seatIdx]) {
        triggerSeatSplash('🚪 关 门', 'close-gate', seatIdx);
      }
      prevClosedRef.current[seatIdx] = Boolean(player.closed);
    });
  }, [view.sequence, view.settlement, view.players]);

  const triggerSeatSplash = (text: string, type: SeatSplashEvent['type'], seat: number) => {
    const splashId = Date.now() + Math.random();
    const position = getRelativePosition(seat, view.mySeat);
    const player = view.players[seat];
    const nickname = player?.nickname || `${SEAT_NAMES[seat]}位`;

    const newSplash: SeatSplashEvent = {
      id: splashId,
      text,
      type,
      seat,
      position,
      nickname,
    };

    setSplashes((prev) => [...prev, newSplash]);

    setTimeout(() => {
      setSplashes((prev) => prev.filter((s) => s.id !== splashId));
    }, 1300);
  };

  if (splashes.length === 0) return null;

  return (
    <div className="action-seat-container" aria-live="polite">
      {splashes.map((splash) => (
        <div
          key={splash.id}
          className={`action-seat-splash pos-${splash.position} is-${splash.type}`}
        >
          <div className="action-seat-aura" />
          <div className="action-seat-pill">
            <span className="action-seat-text">{splash.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

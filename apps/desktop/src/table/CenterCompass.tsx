import { memo } from 'react';
import { SEAT_NAMES } from '@pizhou/shared';
import { useCountdown } from './clock';

interface CenterCompassProps {
  deadline: number | null;
  timeoutSeconds: number;
  mySeat: number;
  currentRel: number;
  myTurn: boolean;
  claiming: boolean;
  wallCount: number;
  round: number;
  phaseText: string;
}

export const CenterCompass = memo(function CenterCompass({
  deadline,
  timeoutSeconds,
  mySeat,
  currentRel,
  myTurn,
  claiming,
  wallCount,
  round,
  phaseText,
}: CenterCompassProps) {
  const left = useCountdown(deadline);
  const ring = Math.max(0, Math.min(100, (left / timeoutSeconds) * 100));
  const urgent = left > 0 && left <= 5 && (myTurn || claiming);

  return (
    <div className={`board-controller ${myTurn || claiming ? 'is-active' : ''} ${urgent ? 'is-urgent' : ''}`}>
      <div className="compass-meta-bar">
        <span className="meta-wall">剩余 <b>{wallCount}</b> 张</span>
        <span className="meta-dot">·</span>
        <span className="meta-round">第 <b>{round || 1}</b> 局</span>
      </div>

      <div
        className="board-compass-disc"
        style={{ background: `conic-gradient(#f3c34f ${ring}%, rgba(255, 255, 255, 0.08) 0)` }}
      >
        <div className="compass-disc-inner">
          <div className={`compass-wind-node wind-top ${currentRel === 2 ? 'is-turn' : ''}`}>
            <span className="wind-label">{SEAT_NAMES[(mySeat + 2) % 4]}</span>
            <i className="wind-pointer">▲</i>
          </div>
          <div className={`compass-wind-node wind-right ${currentRel === 1 ? 'is-turn' : ''}`}>
            <span className="wind-label">{SEAT_NAMES[(mySeat + 1) % 4]}</span>
            <i className="wind-pointer">▶</i>
          </div>
          <div className={`compass-wind-node wind-bottom ${currentRel === 0 ? 'is-turn' : ''}`}>
            <span className="wind-label">{SEAT_NAMES[mySeat]}</span>
            <i className="wind-pointer">▼</i>
          </div>
          <div className={`compass-wind-node wind-left ${currentRel === 3 ? 'is-turn' : ''}`}>
            <span className="wind-label">{SEAT_NAMES[(mySeat + 3) % 4]}</span>
            <i className="wind-pointer">◀</i>
          </div>

          <div className="compass-countdown">
            <strong className="countdown-number">{left > 0 ? left : '--'}</strong>
          </div>
        </div>
      </div>

      <div className="compass-phase-badge" aria-live="polite">{phaseText}</div>
    </div>
  );
});

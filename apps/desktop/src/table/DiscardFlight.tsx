import { useEffect, useRef, type CSSProperties } from 'react';

export interface DiscardFlight {
  flightId: number;
  from: DOMRect;
  to: DOMRect;
  face: string;
}

const FLIGHT_MS = 300;

export function DiscardFlightLayer({ flight, onDone }: { flight: DiscardFlight; onDone: () => void }) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      onDone();
      return;
    }

    const dx = flight.to.left + flight.to.width / 2 - (flight.from.left + flight.from.width / 2);
    const dy = flight.to.top + flight.to.height / 2 - (flight.from.top + flight.from.height / 2);
    const scale = Math.min(1.2, Math.max(0.72, flight.to.width / flight.from.width));
    const lift = Math.max(24, Math.min(52, Math.abs(dy) * 0.18));

    const anim = element.animate(
      [
        {
          transform: 'translate3d(0, 0, 0) scale(0.94) rotateZ(-3deg)',
          opacity: 0.12,
          filter: 'brightness(1.12) drop-shadow(0 12px 16px rgba(0, 0, 0, 0.55))',
        },
        {
          offset: 0.24,
          transform: `translate3d(${dx * 0.2}px, ${dy * 0.14 - lift}px, 0) scale(${Math.min(1.16, scale * 1.05)}) rotateZ(-5deg)`,
          opacity: 1,
          filter: 'brightness(1.2) drop-shadow(0 16px 18px rgba(0, 0, 0, 0.48))',
        },
        {
          offset: 0.7,
          transform: `translate3d(${dx * 0.72}px, ${dy * 0.68 - lift * 0.32}px, 0) scale(${scale * 1.02}) rotateZ(2deg)`,
          opacity: 1,
          filter: 'brightness(1.06) drop-shadow(0 12px 15px rgba(0, 0, 0, 0.5))',
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) rotateZ(0deg)`,
          opacity: 1,
          filter: 'brightness(1) drop-shadow(0 8px 12px rgba(0, 0, 0, 0.44))',
        },
      ],
      {
        duration: FLIGHT_MS,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      },
    );

    anim.onfinish = onDone;

    return () => {
      anim.onfinish = null;
      anim.cancel();
    };
  }, [flight, onDone]);

  const style: CSSProperties = {
    position: 'fixed',
    left: flight.from.left,
    top: flight.from.top,
    width: flight.from.width,
    height: flight.from.height,
    zIndex: 200,
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    contain: 'layout style paint',
  };

  return (
    <div ref={elementRef} className="discard-flight" style={style}>
      <div className="discard-flight-glow" aria-hidden="true" />
      <div className="discard-flight-card">
        <img className="tile-skin" src={flight.face} alt="" draggable={false} />
      </div>
    </div>
  );
}

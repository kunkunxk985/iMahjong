import { useEffect, useRef, type CSSProperties } from 'react';

export interface DiscardFlight {
  flightId: number;
  from: DOMRect;
  to: DOMRect;
  face: string;
}

const FLIGHT_MS = 220;

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
    const scale = Math.min(1.18, Math.max(0.75, flight.to.width / flight.from.width));
    const lift = Math.max(20, Math.min(48, Math.abs(dy) * 0.16));

    const anim = element.animate(
      [
        {
          transform: 'translate3d(0, 0, 0) scale(1) rotateZ(0deg)',
          opacity: 1,
        },
        {
          offset: 0.35,
          transform: `translate3d(${dx * 0.35}px, ${dy * 0.22 - lift}px, 0) scale(${Math.min(1.14, scale * 1.05)}) rotateZ(-3deg)`,
          opacity: 1,
        },
        {
          offset: 0.75,
          transform: `translate3d(${dx * 0.8}px, ${dy * 0.75 - lift * 0.2}px, 0) scale(${scale * 1.01}) rotateZ(1deg)`,
          opacity: 1,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) rotateZ(0deg)`,
          opacity: 1,
        },
      ],
      {
        duration: FLIGHT_MS,
        easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)',
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
    willChange: 'transform',
    transform: 'translateZ(0)',
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

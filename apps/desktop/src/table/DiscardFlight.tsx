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
    const scale = Math.max(0.6, flight.to.width / flight.from.width);

    const anim = element.animate(
      [
        {
          transform: 'translate3d(0, 0, 0) scale(1.05) rotateZ(0deg)',
          opacity: 1,
        },
        {
          offset: 0.52,
          transform: `translate3d(${dx * 0.52}px, ${dy * 0.48 - 36}px, 0) scale(${(1 + scale) * 0.56}) rotateZ(-2.5deg)`,
          opacity: 1,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) rotateZ(0deg)`,
          opacity: 1,
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
      <div className="discard-flight-card">
        <img className="tile-skin" src={flight.face} alt="" draggable={false} />
      </div>
    </div>
  );
}

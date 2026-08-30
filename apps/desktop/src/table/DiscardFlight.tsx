import { useEffect, useRef, type CSSProperties } from 'react';

export interface DiscardFlight {
  flightId: number;
  from: DOMRect;
  to: DOMRect;
  face: string;
}

const FLIGHT_MS = 240;

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
          transform: 'translate3d(0, 0, 0) scale(1) rotateX(0deg)',
          opacity: 1,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) rotateX(28deg)`,
          opacity: 0.96,
        },
      ],
      {
        duration: FLIGHT_MS,
        easing: 'cubic-bezier(0.2, 0.88, 0.25, 1)',
        fill: 'forwards',
      },
    );

    anim.onfinish = onDone;
    anim.oncancel = onDone;

    return () => {
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
      <img
        src={flight.face}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 4,
          boxShadow: '0 8px 18px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
}

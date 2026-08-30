import { useEffect, useState } from 'react';

function countdownSeconds(deadline: number | null): number {
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

export function useCountdown(deadline: number | null): number {
  const [left, setLeft] = useState(() => countdownSeconds(deadline));

  useEffect(() => {
    const tick = () => {
      const next = countdownSeconds(deadline);
      setLeft((previous) => (previous === next ? previous : next));
    };

    tick();
    if (!deadline) return undefined;
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return left;
}

function currentClockText(): string {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function GameClock(): JSX.Element {
  const [text, setText] = useState(currentClockText);

  useEffect(() => {
    const tick = () => {
      const next = currentClockText();
      setText((previous) => (previous === next ? previous : next));
    };

    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className="board-clock">{text}</span>;
}

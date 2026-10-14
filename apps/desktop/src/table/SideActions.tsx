import type { Dispatch, SetStateAction } from 'react';
import { toggleMute } from '../audio/sfx';

interface SideActionsProps {
  muted: boolean;
  onSettings?: () => void;
  setShowQuickChat: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setMuted: Dispatch<SetStateAction<boolean>>;
}

type SideIconName = 'chat' | 'settings' | 'sound' | 'muted';

function SideIcon({ name }: { name: SideIconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'chat') {
    return (
      <svg {...common}>
        <path d="M5.2 17.7 3 21l.6-4.8A8.2 8.2 0 1 1 7 19" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.2 13.4v-2.8l-2-.7a7 7 0 0 0-.7-1.6l.9-1.9-2-2-1.9.9a7 7 0 0 0-1.6-.7l-.7-2H8.4l-.7 2a7 7 0 0 0-1.6.7l-1.9-.9-2 2 .9 1.9a7 7 0 0 0-.7 1.6l-2 .7v2.8l2 .7a7 7 0 0 0 .7 1.6l-.9 1.9 2 2 1.9-.9a7 7 0 0 0 1.6.7l.7 2h2.8l.7-2a7 7 0 0 0 1.6-.7l1.9.9 2-2-.9-1.9a7 7 0 0 0 .7-1.6z" />
      </svg>
    );
  }
  if (name === 'sound') {
    return (
      <svg {...common}>
        <path d="M5 10v4h3l4 3V7l-4 3H5z" />
        <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 10v4h3l4 3V7l-4 3H5zM16 10l5 5M21 10l-5 5" />
    </svg>
  );
}

/**
 * A Tencent-style vertical column of round glass buttons on the table's right
 * edge. These mirror controls that also live in the top bar, surfaced here as a
 * thumb-reachable stack for the common mid-hand actions.
 */
export function SideActions({ muted, onSettings, setShowQuickChat, setShowSettings, setMuted }: SideActionsProps) {
  return (
    <div className="board-side-actions" aria-label="牌桌工具">
      <button
        type="button"
        className="board-side-btn"
        onClick={() => setShowQuickChat((prev) => !prev)}
        title="快捷互动与表情"
        aria-label="快捷互动与表情"
      >
        <SideIcon name="chat" />
      </button>
      <button
        type="button"
        className="board-side-btn"
        onClick={() => {
          if (onSettings) onSettings();
          else setShowSettings(true);
        }}
        title="游戏与声音设置"
        aria-label="游戏与声音设置"
      >
        <SideIcon name="settings" />
      </button>
      <button
        type="button"
        className="board-side-btn"
        onClick={() => setMuted(toggleMute())}
        title={muted ? '取消静音' : '静音'}
        aria-label={muted ? '取消静音' : '静音'}
      >
        <SideIcon name={muted ? 'muted' : 'sound'} />
      </button>
    </div>
  );
}

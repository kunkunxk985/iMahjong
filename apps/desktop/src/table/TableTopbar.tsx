import type { ClientView } from '@pizhou/shared';
import type { Dispatch, SetStateAction } from 'react';
import { AvatarView } from '../components/AvatarView';
import { GameClock } from './clock';
import { toggleMute } from '../audio/sfx';

interface TableTopbarProps {
  view: ClientView;
  me: ClientView['players'][number] | undefined;
  practice: boolean;
  is3DMode: boolean;
  muted: boolean;
  onRules?: () => void;
  onSettings?: () => void;
  onLeave?: () => void;
  onOpenProfile?: () => void;
  toggleRenderMode: () => void;
  setShowQuickChat: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setMuted: Dispatch<SetStateAction<boolean>>;
}

type BoardIconName = 'rules' | 'settings' | 'chat' | 'sound' | 'muted' | 'leave';

function BoardIcon({ name }: { name: BoardIconName }) {
  const common = {
    className: 'board-tool-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.2 13.4v-2.8l-2-.7a7 7 0 0 0-.7-1.6l.9-1.9-2-2-1.9.9a7 7 0 0 0-1.6-.7l-.7-2H8.4l-.7 2a7 7 0 0 0-1.6.7l-1.9-.9-2 2 .9 1.9a7 7 0 0 0-.7 1.6l-2 .7v2.8l2 .7a7 7 0 0 0 .7 1.6l-.9 1.9 2 2 1.9-.9a7 7 0 0 0 1.6.7l.7 2h2.8l.7-2a7 7 0 0 0 1.6-.7l1.9.9 2-2-.9-1.9a7 7 0 0 0 .7-1.6z" />
      </svg>
    );
  }
  if (name === 'rules') {
    return (
      <svg {...common}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    );
  }
  if (name === 'chat') {
    return (
      <svg {...common}>
        <path d="M5.2 17.7 3 21l.6-4.8A8.2 8.2 0 1 1 7 19" />
        <path d="M8 10h8M8 14h5" />
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
  if (name === 'muted') {
    return (
      <svg {...common}>
        <path d="M5 10v4h3l4 3V7l-4 3H5zM16 10l5 5M21 10l-5 5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  );
}

export function TableTopbar({ view, me, practice, is3DMode, muted, onRules, onSettings, onLeave, onOpenProfile, toggleRenderMode, setShowQuickChat, setShowSettings, setMuted }: TableTopbarProps) {
  return (
    <header className="board-topbar">
        <div className="board-room-info">
          {onRules ? (
            <button type="button" className="board-icon-button" onClick={onRules} aria-label="打开规则">
              <BoardIcon name="rules" />
            </button>
          ) : null}
          <span className="board-room-label">牌局</span>
          <strong>{practice ? '单机练习' : view.roomCode}</strong>
          {(view.pointRate ?? 0) > 0 ? (
            <span className="board-rate-pill" title={`本局底分单价：¥${view.pointRate}/分`}>
              💰 ¥{view.pointRate}/分
            </span>
          ) : null}
        </div>
        <div className="board-top-tools">
          <button
            type="button"
            className={`board-icon-button board-3d-btn ${is3DMode ? 'active' : ''}`}
            onClick={() => {
              toggleRenderMode();
            }}
            title={is3DMode ? '当前：真 3D 物理视角 (点击切换 2D)' : '当前：经典 2D 视角 (点击切换 3D)'}
            aria-label="切换 3D/2D 渲染模式"
          >
            <span style={{ fontSize: '11px', fontWeight: 800, color: is3DMode ? 'var(--table-brass-bright, #e2c27c)' : '#94a3b8' }}>
              {is3DMode ? '3D' : '2D'}
            </span>
          </button>
          <GameClock />
          {onOpenProfile ? (
            <button
              type="button"
              className="board-profile-button"
              onClick={onOpenProfile}
              title="打开我的账号资料"
              aria-label="打开我的账号资料"
            >
              <AvatarView
                avatar={me?.isBot ? '陪' : me?.avatar}
                className="board-profile-avatar"
                alt="我的头像"
              />
              <span className="board-profile-label">{me?.nickname ?? '我的资料'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="board-icon-button"
            onClick={() => setShowQuickChat((prev) => !prev)}
            title="快捷互动与表情"
            aria-label="快捷互动与表情"
          >
            <BoardIcon name="chat" />
          </button>
          <button
            type="button"
            className="board-icon-button"
            onClick={() => {
              if (onSettings) onSettings();
              else setShowSettings(true);
            }}
            title="游戏与声音设置"
            aria-label="游戏与声音设置"
          >
            <BoardIcon name="settings" />
          </button>
          <button
            type="button"
            className="board-icon-button"
            onClick={() => {
              const next = toggleMute();
              setMuted(next);
            }}
            title={muted ? '取消静音' : '静音'}
            aria-label={muted ? '取消静音' : '静音'}
          >
            <BoardIcon name={muted ? 'muted' : 'sound'} />
          </button>
          {onLeave ? (
            <button type="button" className="board-exit-button" onClick={onLeave} aria-label="回大厅">
              <BoardIcon name="leave" />
            </button>
          ) : null}
        </div>
      </header>
  );
}

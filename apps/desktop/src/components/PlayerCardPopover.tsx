import React, { useEffect, useRef } from 'react';
import { calculateRank } from '@pizhou/shared';
import { AvatarView } from './AvatarView';

export interface PlayerCardPopoverData {
  userId?: string;
  nickname: string;
  avatar: string;
  title?: string;
  bio?: string;
  seat?: number;
  isDealer?: boolean;
  isHost?: boolean;
  isBot?: boolean;
  ready?: boolean;
  score?: number;
  totalMatches?: number;
  winRate?: number;
  rp?: number;
}

export interface PlayerCardPopoverProps {
  player: PlayerCardPopoverData;
  anchorRect?: DOMRect | null;
  position?: { x: number; y: number } | null;
  onClose: () => void;
}

export const PlayerCardPopover: React.FC<PlayerCardPopoverProps> = ({
  player,
  anchorRect,
  position,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Derived rank details
  const effectiveRP = player.rp ?? (player.isBot ? 1200 : 850);
  const rankInfo = calculateRank(effectiveRP);
  const tier = rankInfo.currentTier;

  // Derived stats
  const totalMatches = player.totalMatches ?? (player.isBot ? 88 : 12);
  const winRate = player.winRate !== undefined ? player.winRate : (player.isBot ? 52 : 45);
  const bio = player.bio?.trim() || (player.isBot ? '专注出牌，精准防守。' : '不碰坎不上，单钓不换张！');
  const title = player.title || (player.isBot ? '邳州陪练' : '初学雀友');

  // Compute popover placement
  let style: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 9999,
  };

  if (anchorRect) {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const popoverHeight = 320;
    const popoverWidth = 280;

    let top = anchorRect.bottom + 10;
    if (spaceBelow < popoverHeight && anchorRect.top > popoverHeight) {
      top = anchorRect.top - popoverHeight - 10;
    }

    let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
    left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));

    style = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      zIndex: 9999,
    };
  } else if (position) {
    style = {
      position: 'fixed',
      top: `${Math.round(position.y)}px`,
      left: `${Math.round(position.x)}px`,
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
    };
  }

  return (
    <div className="player-card-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
      <div
        ref={popoverRef}
        className="player-card-popover"
        style={{
          ...style,
          width: '280px',
          background: 'linear-gradient(165deg, rgba(20, 52, 38, 0.98) 0%, rgba(8, 24, 18, 0.99) 100%)',
          border: '1.5px solid rgba(250, 204, 21, 0.55)',
          borderRadius: '16px',
          boxShadow: '0 16px 36px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
          color: '#fff',
          padding: '18px 16px 16px',
          fontFamily: 'inherit',
          animation: 'popoverFadeIn 0.18s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon with Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#fef08a', background: 'rgba(250, 204, 21, 0.15)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
              {player.isBot ? '🤖 智能陪练' : '🀄 雀士手账'}
            </span>
            {player.isDealer && (
              <span style={{ fontSize: '11px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 'bold' }}>
                庄家
              </span>
            )}
            {player.isHost && (
              <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 6px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                房主
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              lineHeight: 1,
            }}
            title="关闭名片"
          >
            ✕
          </button>
        </div>

        {/* Avatar & Hero Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '12px' }}>
          <div
            style={{
              position: 'relative',
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'radial-gradient(circle, rgba(250, 204, 21, 0.25) 0%, transparent 70%)',
              padding: '4px',
              marginBottom: '8px',
            }}
          >
            <AvatarView avatar={player.avatar} size={60} />
            <span
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                fontSize: '13px',
                background: '#064e3b',
                border: '1px solid #facc15',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'grid',
                placeItems: 'center',
              }}
              title={tier.name}
            >
              {tier.badgeIcon}
            </span>
          </div>

          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: '#fffbeb', letterSpacing: '0.5px' }}>
            {player.nickname}
          </h3>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#d7c98f', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>
              {title}
            </span>
            <span style={{ fontSize: '11px', color: tier.colorTheme, fontWeight: 'bold', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '8px' }}>
              {tier.name}
            </span>
          </div>
        </div>

        {/* Bio Motto Quote */}
        <blockquote
          style={{
            margin: '0 0 14px',
            padding: '8px 10px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderLeft: '2.5px solid #facc15',
            borderRadius: '0 6px 6px 0',
            fontSize: '11px',
            lineHeight: 1.45,
            color: '#cbd5e1',
            fontStyle: 'italic',
            wordBreak: 'break-word',
          }}
        >
          “{bio}”
        </blockquote>

        {/* Match Statistics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            background: 'rgba(6, 20, 15, 0.65)',
            padding: '10px 8px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>对局</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f1f5f9' }}>{totalMatches}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>胜率</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#facc15' }}>{Math.round(winRate)}%</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{player.score !== undefined ? '当前点数' : '天梯RP'}</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#34d399' }}>
              {player.score !== undefined ? player.score : effectiveRP}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

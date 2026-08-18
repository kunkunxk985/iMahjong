import { useState } from 'react';
import { SEAT_NAMES, type ClientView } from '@pizhou/shared';

interface WaitingRoomProps {
  view: ClientView;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onRules: () => void;
}

function isOccupied(view: ClientView['players'][number], seat: number): boolean {
  return view.nickname !== `空位${seat + 1}`;
}

export function WaitingRoom({ view, onReady, onStart, onLeave, onRules }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const me = view.players[view.mySeat];
  const occupied = view.players.filter((player, seat) => isOccupied(player, seat));
  const readyCount = occupied.filter((player) => player.ready).length;
  const full = occupied.length === 4;
  const isHost = view.mySeat === view.hostSeat;
  const canStart = isHost && full && readyCount === 4;

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(view.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permissions are optional; the room number remains visible.
    }
  };

  return (
    <div className="hall">
      <div className="hall-vignette" />
      <div className="hall-card waiting-card">
        <div className="gold-line" />
        <p className="eyebrow">四 人 · 老 家 桌</p>
        <h1>等朋友入座</h1>
        <p className="sub">把房间号发到群里，人齐后房主开局</p>

        <button type="button" className="room-code-banner" onClick={copyRoomCode} title="点击复制房间号">
          <span className="room-code-label">房间号</span>
          <strong className="room-code-num">{view.roomCode}</strong>
          <span className="btn-action ghost copy-btn">{copied ? '已复制' : '复制房号'}</span>
        </button>

        <ul className="seat-grid">
          {view.players.map((player, seat) => {
            const present = isOccupied(player, seat);
            return (
              <li key={player.seat} className={`seat-card ${present ? '' : 'empty'} ${seat === view.mySeat ? 'me' : ''}`}>
                <span className="seat-wind">{SEAT_NAMES[seat]}</span>
                {present ? (
                  <div className="seat-info">
                    <div className="seat-name">
                      <span>{player.nickname}</span>
                      {seat === view.mySeat ? <span className="tag me-tag">你</span> : null}
                      {player.isHost ? <span className="tag host-tag">房主</span> : null}
                    </div>
                    <div className="seat-status">
                      <span className={`status-pill ${player.ready ? 'ready' : 'waiting'}`}>
                        {player.ready ? '已准备' : '等待准备'}
                      </span>
                      <span className={`status-net ${player.online ? '' : 'offline'}`}>
                        {player.online ? '在线' : '离线'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="empty-hint">等待朋友加入</span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="hint ok">已入座 {occupied.length}/4 · 已准备 {readyCount}/4</p>

        <div className="waiting-actions">
          {me ? (
            <button
              type="button"
              className={`btn-action ${me.ready ? 'ghost' : 'primary'}`}
              onClick={() => onReady(!me.ready)}
            >
              {me.ready ? '取消准备' : '准备好了'}
            </button>
          ) : null}
          {isHost ? (
            <button type="button" className="btn-action hero" disabled={!canStart} onClick={onStart}>
              {canStart ? '开始游戏' : full ? `等待全员准备（${readyCount}/4）` : `还差 ${4 - occupied.length} 人`}
              <small>房主操作</small>
            </button>
          ) : (
            <p className="hint">等房主开始游戏</p>
          )}
        </div>

        <div className="split slim">
          <button type="button" className="btn-action ghost" onClick={onRules}>规则说明</button>
          <button type="button" className="btn-action ghost" onClick={onLeave}>离开房间</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { SEAT_NAMES, type ClientView } from '@pizhou/shared';
import { AvatarView } from '../components/AvatarView';

interface WaitingRoomProps {
  view: ClientView;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onRules: () => void;
  onSetRate?: (rate: number) => void;
  onInviteFriends?: () => void;
  onOpenProfile?: () => void;
}

function isOccupied(view: ClientView['players'][number], seat: number): boolean {
  return view.nickname !== `空位${seat + 1}`;
}

export function WaitingRoom({
  view,
  onReady,
  onStart,
  onLeave,
  onRules,
  onSetRate,
  onInviteFriends,
  onOpenProfile,
}: WaitingRoomProps) {
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
    <div className="hall waiting-hall">
      <div className="hall-vignette" />
      <div className="hall-card waiting-card">
        <div className="gold-line" />
        <div className="waiting-heading-row">
          <div className="waiting-heading-copy">
            <p className="eyebrow">四 人 · 老 家 桌</p>
            <h1>等朋友入座</h1>
            <p className="sub">把房间号发到群里，人齐后房主开局</p>
          </div>
          {onOpenProfile && me ? (
            <button
              type="button"
              className="waiting-profile-button"
              onClick={onOpenProfile}
              title="打开我的账号资料"
            >
              <AvatarView avatar={me.isBot ? '陪' : me.avatar} className="waiting-profile-avatar" alt="我的头像" />
              <span>
                <strong>{me.nickname}</strong>
                <small>账号资料</small>
              </span>
            </button>
          ) : null}
        </div>

        <button type="button" className="room-code-banner" onClick={copyRoomCode} title="点击复制房间号">
          <span className="room-code-label">房间号</span>
          <strong className="room-code-num">{view.roomCode}</strong>
          <span className="btn-action ghost copy-btn">{copied ? '已复制' : '复制房号'}</span>
        </button>

        <div className="waiting-body-grid">
          <section className="waiting-seats-section" aria-label="牌桌座位">
            <div className="waiting-section-heading">
              <div>
                <span className="waiting-section-kicker">牌 桌 座 位</span>
                <strong>四方入座</strong>
              </div>
              <span className={`waiting-readiness ${full ? 'complete' : ''}`}>
                {full ? '已满桌' : `还差 ${4 - occupied.length} 人`}
              </span>
            </div>

            <ul className="seat-grid">
              {view.players.map((player, seat) => {
                const present = isOccupied(player, seat);
                return (
                  <li key={player.seat} className={`seat-card ${present ? '' : 'empty'} ${seat === view.mySeat ? 'me' : ''}`}>
                    <span className="seat-wind">{SEAT_NAMES[seat]}</span>
                    {present ? (
                      <>
                        <div className="waiting-seat-avatar">
                          <AvatarView
                            avatar={player.isBot ? '陪' : player.avatar}
                            alt={`${player.nickname}头像`}
                          />
                        </div>
                        <div className="seat-info">
                          <div className="seat-name">
                            <span>{player.nickname}</span>
                            {seat === view.mySeat ? <span className="tag me-tag">你</span> : null}
                            {player.isHost ? <span className="tag host-tag">房主</span> : null}
                          </div>
                          {player.title ? <small className="seat-title">{player.title}</small> : null}
                          <div className="seat-status">
                            <span className={`status-pill ${player.ready ? 'ready' : 'waiting'}`}>
                              {player.ready ? '已准备' : '等待准备'}
                            </span>
                            <span className={`status-net ${player.online ? '' : 'offline'}`}>
                              {player.online ? '在线' : '离线'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="empty-hint">等待朋友加入</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="waiting-control-panel">
            <div className="waiting-rate-panel">
              <div className="waiting-rate-header">
                <span className="waiting-rate-title">
                  💰 本局结算底分单价
                </span>
                <span className="waiting-rate-hint">
                  {isHost ? '房主可调整' : `房主已设定：${(view.pointRate ?? 0.1) > 0 ? `¥${view.pointRate ?? 0.1}/分` : '纯积分'}`}
                </span>
              </div>
              <div className="waiting-rate-chips">
                {[
                  { val: 0.1, label: '¥0.1 / 分' },
                  { val: 0.2, label: '¥0.2 / 分' },
                  { val: 0.5, label: '¥0.5 / 分' },
                  { val: 1.0, label: '¥1.0 / 分' },
                  { val: 0, label: '仅看积分' },
                ].map((option) => {
                  const active = (view.pointRate ?? 0.1) === option.val;
                  return (
                    <button
                      key={option.val}
                      type="button"
                      className={`waiting-rate-chip ${active ? 'active' : ''}`}
                      disabled={!isHost}
                      onClick={() => onSetRate?.(option.val)}
                      title={isHost ? `切换为 ${option.label}` : undefined}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="waiting-progress-card">
              <div className="waiting-progress-head">
                <span>开局准备度</span>
                <strong>{readyCount}/4 已准备</strong>
              </div>
              <div className="waiting-progress-track" aria-label={`已准备 ${readyCount} 人`}>
                <span style={{ width: `${readyCount * 25}%` }} />
              </div>
              <p className="waiting-progress-note">
                {full ? (readyCount === 4 ? '人齐了，房主可以开始游戏' : '人已到齐，等大家准备') : '先把房间号发给你的牌友'}
              </p>
            </div>

            <div className="waiting-actions">
              <div className="waiting-primary-actions">
                {me ? (
                  <button
                    type="button"
                    className={`btn-action ${me.ready ? 'ghost' : 'primary'}`}
                    onClick={() => onReady(!me.ready)}
                  >
                    {me.ready ? '取消准备' : '准备好了'}
                  </button>
                ) : null}

                {onInviteFriends && !full && (
                  <button
                    type="button"
                    className="btn-action ghost invite-friends-btn"
                    onClick={onInviteFriends}
                  >
                    👥 邀请好友
                  </button>
                )}
              </div>

              {isHost ? (
                <button type="button" className="btn-action hero" disabled={!canStart} onClick={onStart}>
                  {canStart ? '开始游戏' : full ? `等待全员准备（${readyCount}/4）` : `还差 ${4 - occupied.length} 人`}
                  <small>房主操作</small>
                </button>
              ) : (
                <p className="hint waiting-host-hint">等房主开始游戏</p>
              )}
            </div>
          </aside>
        </div>

        <div className="waiting-footer">
          <p className="waiting-footer-hint">
            <span className="waiting-footer-dot" />
            已入座 {occupied.length}/4 · 已准备 {readyCount}/4
          </p>
          <div className="waiting-footer-actions">
            <button type="button" className="btn-action ghost" onClick={onRules}>规则说明</button>
            <button type="button" className="btn-action ghost" onClick={onLeave}>离开房间</button>
          </div>
        </div>
      </div>
    </div>
  );
}

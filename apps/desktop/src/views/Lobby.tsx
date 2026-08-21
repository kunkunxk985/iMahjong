import { useState } from 'react';
import { TileShowcase } from '../components/TileView';

export type NetworkStatus = 'connecting' | 'open' | 'closed';

interface LobbyProps {
  nickname: string;
  setNickname: (value: string) => void;
  error: string;
  networkStatus: NetworkStatus;
  serverUrl: string;
  soloBusy?: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onStartLocal: () => void;
  onRules: () => void;
  onSettings: () => void;
}

const STATUS_TEXT: Record<NetworkStatus, string> = {
  connecting: '正在连接牌桌服务器…',
  open: '服务器已连接，可以创建或加入房间',
  closed: '服务器未连接，请检查本机服务或服务器地址',
};

export function Lobby({
  nickname,
  setNickname,
  error,
  networkStatus,
  serverUrl,
  soloBusy = false,
  onCreateRoom,
  onJoinRoom,
  onStartLocal,
  onRules,
  onSettings,
}: LobbyProps) {
  const [tab, setTab] = useState<'online' | 'local'>('online');
  const [roomCode, setRoomCode] = useState('');
  const onlineReady = networkStatus === 'open' && nickname.trim().length > 0;

  const join = () => {
    const normalized = roomCode.trim();
    if (normalized.length !== 6) return;
    onJoinRoom(normalized);
  };

  return (
    <div className="hall">
      <div className="hall-vignette" aria-hidden="true">
        <span className="hall-corner bl" />
        <span className="hall-corner br" />
      </div>
      <div className="hall-card">
        <div className="gold-line" />
        <p className="eyebrow">查 胡 · 老 家 桌</p>
        <h1>邳州麻将</h1>
        <p className="sub">四个人 · 一个房间号 · 晚上直接开打</p>
        <TileShowcase />

        <label>
          昵称
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={12}
            placeholder="进桌时显示的名字"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && tab === 'online' && onlineReady) onCreateRoom();
            }}
          />
        </label>

        <div className="tab-bar" role="tablist" aria-label="游戏模式">
          <button type="button" className={`tab-btn ${tab === 'online' ? 'active' : ''}`} onClick={() => setTab('online')}>
            和朋友联机
          </button>
          <button type="button" className={`tab-btn ${tab === 'local' ? 'active' : ''}`} onClick={() => setTab('local')}>
            单机陪练
          </button>
        </div>

        {tab === 'online' ? (
          <div role="tabpanel">
            <button type="button" className="btn-action hero" disabled={!onlineReady} onClick={onCreateRoom}>
              创建房间
              <small>{networkStatus === 'open' ? '创建后把房间号发给朋友' : '等待服务器连接'}</small>
            </button>

            <div className="join-row">
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && onlineReady) join();
                }}
                placeholder="输入 6 位房间号"
                maxLength={6}
                aria-label="房间号"
              />
              <button type="button" className="btn-action" disabled={!onlineReady || roomCode.length !== 6} onClick={join}>
                加入房间
              </button>
            </div>

            <div className="server-status-row">
              <span className={`net-dot ${networkStatus}`} />
              <span className="net-text" title={serverUrl}>{STATUS_TEXT[networkStatus]}</span>
              <button type="button" className="btn-link" onClick={onSettings}>服务器设置</button>
            </div>
          </div>
        ) : (
          <div role="tabpanel">
            <button
              type="button"
              className="btn-action hero"
              disabled={!nickname.trim() || soloBusy}
              onClick={onStartLocal}
            >
              开始单机对局
              <small>{soloBusy ? '正在启动本机牌桌…' : '和三位陪练熟悉手感，不必先填服务器'}</small>
            </button>
            <p className="hint">单机走本机内置服务。局域网联机才需要在设置里填朋友那台电脑的地址。</p>
          </div>
        )}

        <button type="button" className="btn-action ghost wide" onClick={onRules}>规则说明</button>
        <p className="hint">牌桌支持双击出牌；联机时由服务器统一判断操作和结算。</p>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}

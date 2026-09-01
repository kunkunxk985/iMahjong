import { useState } from 'react';
import type { UserProfile } from '@pizhou/shared';
import { MatchHistoryModal } from '../components/MatchHistoryModal';

export type NetworkStatus = 'connecting' | 'open' | 'closed';

interface LobbyProps {
  nickname: string;
  setNickname: (value: string) => void;
  error: string;
  networkStatus: NetworkStatus;
  serverUrl: string;
  token: string | null;
  user: UserProfile | null;
  soloBusy?: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onStartLocal: () => void;
  onRules: () => void;
  onSettings: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}

export function Lobby({
  nickname,
  setNickname,
  error,
  networkStatus,
  serverUrl,
  token,
  user,
  soloBusy = false,
  onCreateRoom,
  onJoinRoom,
  onStartLocal,
  onRules,
  onSettings,
  onOpenProfile,
  onOpenAuth,
}: LobbyProps) {
  const [tab, setTab] = useState<'online' | 'local'>('online');
  const [roomCode, setRoomCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const onlineReady = networkStatus === 'open' && nickname.trim().length > 0;

  const join = () => {
    const normalized = roomCode.trim();
    if (normalized.length !== 6) return;
    onJoinRoom(normalized);
  };

  return (
    <div className="hall">
      <div className="hall-card">
        {/* User Card Header */}
        <div
          className="hall-user-header"
          onClick={user ? onOpenProfile : onOpenAuth}
          title="点击查看/修改雀士个人档案"
        >
          <div className="hall-user-left">
            <div className="hall-user-avatar">{user?.avatar || '🀄'}</div>
            <div className="hall-user-meta">
              <div className="hall-user-name-row">
                <span className="hall-user-name">{user?.nickname || nickname}</span>
                <span className="hall-user-title">{user?.title || '初学雀友'}</span>
              </div>
              <span className="hall-user-sub">
                {user ? (user.isGuest ? '⚡ 游客模式 · 点击绑定' : `ID: ${user.userId}`) : '未登录 · 点击登录'}
              </span>
            </div>
          </div>
          <div className="hall-user-right">
            <span>{user ? '个人档案 ›' : '登录/注册 ›'}</span>
          </div>
        </div>

        {/* Title Header */}
        <div className="hall-header">
          <h1 className="hall-title">邳 州 麻 将</h1>
          <span className="hall-badge">经典查胡 · 地道苏北规则</span>
        </div>

        {/* Player Profile Input */}
        <div className="hall-profile">
          <span className="profile-label">玩家昵称</span>
          <input
            className="profile-input"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={12}
            placeholder="请输入您的昵称"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && tab === 'online' && onlineReady) onCreateRoom();
            }}
          />
        </div>

        {/* Mode Tabs */}
        <div className="hall-tabs" role="tablist">
          <button
            type="button"
            className={`hall-tab ${tab === 'online' ? 'active' : ''}`}
            onClick={() => setTab('online')}
          >
            👥 好友联机
          </button>
          <button
            type="button"
            className={`hall-tab ${tab === 'local' ? 'active' : ''}`}
            onClick={() => setTab('local')}
          >
            🤖 单机陪练
          </button>
        </div>

        {/* Mode Content */}
        {tab === 'online' ? (
          <div className="hall-mode-panel" role="tabpanel">
            <button
              type="button"
              className="btn-action hall-primary-btn"
              disabled={!onlineReady}
              onClick={onCreateRoom}
            >
              创建房间
            </button>

            <div className="hall-join-row">
              <input
                className="join-input"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && onlineReady) join();
                }}
                placeholder="输入 6 位房间号"
                maxLength={6}
              />
              <button
                type="button"
                className="btn-action hall-join-btn"
                disabled={!onlineReady || roomCode.length !== 6}
                onClick={join}
              >
                加入房间
              </button>
            </div>
          </div>
        ) : (
          <div className="hall-mode-panel" role="tabpanel">
            <button
              type="button"
              className="btn-action hall-primary-btn"
              disabled={!nickname.trim() || soloBusy}
              onClick={onStartLocal}
            >
              {soloBusy ? '正在启动…' : '开始单机对局'}
            </button>
          </div>
        )}

        {/* Footer Utilities */}
        <div className="hall-footer">
          <div className="hall-net-status">
            <span className={`net-dot ${networkStatus}`} />
            <span className="net-text">
              {networkStatus === 'open' ? '已连接' : networkStatus === 'connecting' ? '连接中…' : '未连接'}
            </span>
            <button type="button" className="btn-link" onClick={onSettings} title={serverUrl}>
              设置
            </button>
          </div>

          <div className="hall-footer-actions">
            <button type="button" className="hall-rules-btn" onClick={() => setShowHistory(true)}>
              📜 战绩
            </button>
            <button type="button" className="hall-rules-btn" onClick={onRules}>
              📖 规则
            </button>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>

      {showHistory ? (
        <MatchHistoryModal
          serverUrl={serverUrl}
          token={token}
          currentUser={user}
          onClose={() => setShowHistory(false)}
        />
      ) : null}
    </div>
  );
}

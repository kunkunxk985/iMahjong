import { useState } from 'react';
import type { UserProfile } from '@pizhou/shared';
import { MatchHistoryModal } from '../components/MatchHistoryModal';
import { AvatarView } from '../components/AvatarView';

export type NetworkStatus = 'connecting' | 'open' | 'closed';

interface LobbyProps {
  nickname: string;
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
  onOpenFriends?: () => void;
  onLogout: () => void;
}

export function Lobby({
  nickname,
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
  onOpenFriends,
  onLogout,
}: LobbyProps) {
  const [selectedMode, setSelectedMode] = useState<'menu' | 'online'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const onlineReady = networkStatus === 'open';

  const join = () => {
    const normalized = roomCode.trim();
    if (normalized.length !== 6) return;
    onJoinRoom(normalized);
  };

  return (
    <div className="hall lobby-hall">
      {/* Top Header Bar */}
      <header className="hall-nav-bar">
        <div className="hall-logo-title">
          <span className="logo-icon">🀄</span>
          <span className="logo-text">邳州麻将</span>
        </div>

        <div className="hall-user-pill-wrap">
          {onOpenFriends && (
            <button
              type="button"
              className="hall-friends-btn"
              onClick={onOpenFriends}
              title="查看好友列表与在线状态"
            >
              👥 好友
            </button>
          )}

          <button
            type="button"
            className="hall-user-pill"
            onClick={onOpenProfile}
            title="点击修改头像与头衔"
          >
            <span className="pill-avatar">
              <AvatarView avatar={user?.avatar} alt="我的头像" />
            </span>
            <span className="pill-name">{user?.nickname || user?.username || nickname}</span>
            <span className="pill-title">{user?.title || '初学雀友'}</span>
            <span className="pill-arrow">›</span>
          </button>

          <button
            type="button"
            className="hall-logout-btn"
            onClick={onLogout}
            title="退出当前账号，返回登录页"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main Mode Selection Card */}
      <div className="hall-card tier-card">
        {selectedMode === 'menu' ? (
          /* Step 1: Mode Selection Menu */
          <div className="mode-select-panel">
            <div className="mode-select-intro">
              <span className="lobby-kicker">今晚开局 · 邳州老家牌桌</span>
              <h2>请选择游戏玩法</h2>
              <p>经典邳州查胡两两结 · 正宗地道玩法</p>
            </div>

            <div className="mode-cards-grid">
              {/* Online Mode Card */}
              <button
                type="button"
                className={`mode-big-card online-tile ${!onlineReady ? 'disabled' : ''}`}
                disabled={!onlineReady}
                onClick={() => setSelectedMode('online')}
              >
                <div className="mode-card-topline">
                  <span className="mode-card-badge">好友桌</span>
                  <span className="mode-card-meta">{onlineReady ? '4 人联机' : '连接中…'}</span>
                </div>
                <div className="mode-card-icon" aria-hidden="true">👥</div>
                <div className="mode-card-info">
                  <h3>好友四人联机</h3>
                  <p>房主开房 · 输入6位房号即可对局 · 真实两两对账</p>
                </div>
                <div className="mode-card-footer">
                  <span className="mode-card-enter">进入联机</span>
                  <span className="mode-card-arrow" aria-hidden="true">↗</span>
                </div>
              </button>

              {/* Single-Player Mode Card */}
              <button
                type="button"
                className="mode-big-card local-tile"
                disabled={soloBusy}
                onClick={onStartLocal}
              >
                <div className="mode-card-topline">
                  <span className="mode-card-badge">随时开局</span>
                  <span className="mode-card-meta">3 AI 陪练</span>
                </div>
                <div className="mode-card-icon" aria-hidden="true">🤖</div>
                <div className="mode-card-info">
                  <h3>单机人机陪练</h3>
                  <p>无需等待 · 3名智能AI陪练 · 演练坎上与关门</p>
                </div>
                <div className="mode-card-footer">
                  <span className="mode-card-enter">
                    {soloBusy ? '正在启动…' : '开始对局'}
                  </span>
                  <span className="mode-card-arrow" aria-hidden="true">↗</span>
                </div>
              </button>
            </div>

            <div className="lobby-trust-row" aria-label="游戏服务特点">
              <span><i aria-hidden="true">✓</i> 房号实时同步</span>
              <span><i aria-hidden="true">✓</i> 头像网名随牌桌</span>
              <span><i aria-hidden="true">✓</i> 牌局自动记战绩</span>
            </div>
          </div>
        ) : (
          /* Step 2: Online Room Operations */
          <div className="online-room-panel">
            <div className="online-panel-header">
              <button
                type="button"
                className="btn-action ghost sm back-btn"
                onClick={() => setSelectedMode('menu')}
              >
                ‹ 返回模式选择
              </button>
              <h2>👥 好友四人联机</h2>
            </div>

            <div className="online-actions-wrap">
              <button
                type="button"
                className="btn-action primary online-create-btn"
                disabled={!onlineReady}
                onClick={onCreateRoom}
              >
                🀄 创建新房间 (获取6位房号)
              </button>

              <div className="online-or-divider">
                <span>或者加入好友房间</span>
              </div>

              <div className="hall-join-row">
                <input
                  className="join-input"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && onlineReady && roomCode.length === 6) join();
                  }}
                  placeholder="输入好友的 6 位房间号"
                  maxLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn-action hall-join-btn"
                  disabled={!onlineReady || roomCode.length !== 6}
                  onClick={join}
                >
                  加入对局
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Utilities */}
        <div className="hall-footer">
          <div className="hall-net-status" role="status" aria-live="polite">
            <span className={`net-dot ${networkStatus}`} aria-hidden="true" />
            <span className="net-text">
              {networkStatus === 'open' ? '云端服务已连接' : networkStatus === 'connecting' ? '连接中…' : '离线中'}
            </span>
            <button type="button" className="btn-link" onClick={onSettings} title={serverUrl}>
              设置
            </button>
          </div>

          <div className="hall-footer-actions">
            <button type="button" className="hall-rules-btn" onClick={() => setShowHistory(true)}>
              📜 战绩中心
            </button>
            <button type="button" className="hall-rules-btn" onClick={onRules}>
              📖 玩法规则
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

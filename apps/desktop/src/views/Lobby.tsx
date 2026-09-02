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
    <div className="hall lobby-grand-stage">
      <img className="lobby-bg-artwork" src="./assets/lobby-bg.jpg" alt="" draggable={false} />
      <div className="lobby-vignette-overlay" aria-hidden="true" />

      {/* Edge-to-Edge Minimal Top Bar */}
      <header className="hall-nav-bar">
        <div className="hall-brand-mark">
          <span className="brand-icon" aria-hidden="true">🀄</span>
          <span className="brand-name">邳州麻将</span>
          <span className="brand-dot" aria-hidden="true" />
          <span className="brand-ping">{networkStatus === 'open' ? '在线' : '连接中'}</span>
        </div>

        <div className="hall-user-pill-wrap">
          {onOpenFriends && (
            <button
              type="button"
              className="hall-minimal-btn"
              onClick={onOpenFriends}
              title="好友列表"
            >
              👥 好友
            </button>
          )}

          <button
            type="button"
            className="hall-user-capsule"
            onClick={onOpenProfile}
            title="查看雀士名片"
          >
            <span className="capsule-avatar">
              <AvatarView avatar={user?.avatar} alt="我的头像" />
            </span>
            <span className="capsule-name">{user?.nickname || user?.username || nickname}</span>
            <span className="capsule-arrow" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            className="hall-minimal-btn logout"
            onClick={onLogout}
            title="退出登录"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main Stage: Minimalist, Balanced, Elegant */}
      <main className="lobby-main-layout">
        {/* Left Side: Confident Pure Title Branding */}
        <aside className="lobby-brand-hero">
          <div className="hero-seal-tag">
            <span className="seal-char">邳</span>
            <span className="seal-text">江苏 · 传统雀戏</span>
          </div>
          <h1 className="lobby-hero-title">
            邳州<span>麻将</span>
          </h1>
        </aside>

        {/* Right Side: Sleek Mode Slabs */}
        <section className="lobby-modes-console">
          {selectedMode === 'menu' ? (
            <div className="lobby-mode-cards-stack">
              {/* Online Mode */}
              <button
                type="button"
                className={`mode-slab online-slab ${!onlineReady ? 'disabled' : ''}`}
                disabled={!onlineReady}
                onClick={() => setSelectedMode('online')}
              >
                <div className="slab-content">
                  <div className="slab-kicker">
                    <span className="slab-en">ONLINE MATCH</span>
                    <span className="slab-badge">4人联机</span>
                  </div>
                  <h2 className="slab-title">友人对战</h2>
                </div>
                <div className="slab-arrow-circle" aria-hidden="true">→</div>
              </button>

              {/* Solo AI Mode */}
              <button
                type="button"
                className="mode-slab local-slab"
                disabled={soloBusy}
                onClick={onStartLocal}
              >
                <div className="slab-content">
                  <div className="slab-kicker">
                    <span className="slab-en">PRACTICE ARENA</span>
                    <span className="slab-badge">3 AI 陪练</span>
                  </div>
                  <h2 className="slab-title">{soloBusy ? '进入中…' : '单机演练'}</h2>
                </div>
                <div className="slab-arrow-circle" aria-hidden="true">→</div>
              </button>
            </div>
          ) : (
            /* Online Room Operations */
            <div className="lobby-online-operation-card">
              <div className="operation-card-header">
                <button
                  type="button"
                  className="btn-action ghost sm back-btn"
                  onClick={() => setSelectedMode('menu')}
                >
                  ‹ 返回
                </button>
                <h2>友人对战</h2>
              </div>

              <div className="operation-actions-wrap">
                <button
                  type="button"
                  className="btn-action primary online-create-btn"
                  disabled={!onlineReady}
                  onClick={onCreateRoom}
                >
                  创建房间 (获取 6 位房号)
                </button>

                <div className="online-or-divider">
                  <span>或输入房号加入</span>
                </div>

                <div className="hall-join-row">
                  <input
                    className="join-input"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && onlineReady && roomCode.length === 6) join();
                    }}
                    placeholder="6 位房间号"
                    maxLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-action hall-join-btn"
                    disabled={!onlineReady || roomCode.length !== 6}
                    onClick={join}
                  >
                    加入
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Edge-to-Edge Minimal Bottom Dock */}
      <footer className="hall-footer-dock">
        <div className="dock-left">
          <button type="button" className="dock-link-btn" onClick={onSettings} title={serverUrl}>
            网络设置
          </button>
        </div>

        <div className="dock-right">
          <button type="button" className="dock-link-btn" onClick={() => setShowHistory(true)}>
            战绩牌谱
          </button>
          <span className="dock-sep">/</span>
          <button type="button" className="dock-link-btn" onClick={onRules}>
            规则说明
          </button>
        </div>
      </footer>

      {error ? <div className="lobby-error-toast">{error}</div> : null}

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


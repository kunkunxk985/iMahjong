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

      {/* Edge-to-Edge Top Navigation Bar */}
      <header className="hall-nav-bar">
        <div className="hall-logo-title">
          <span className="logo-icon" aria-hidden="true">🀄</span>
          <div className="logo-brand-block">
            <span className="logo-text">邳州麻将</span>
            <span className="logo-subtext">苏北雀圣 · 家乡牌馆</span>
          </div>
          <span className="hall-city-stamp">江苏 · 邳州</span>
          <div className="hall-latency-pill" role="status">
            <span className={`net-dot ${networkStatus}`} aria-hidden="true" />
            <span className="net-ms">{networkStatus === 'open' ? '18ms' : networkStatus === 'connecting' ? '连接中' : '离线'}</span>
          </div>
        </div>

        <div className="hall-user-pill-wrap">
          {onOpenFriends && (
            <button
              type="button"
              className="hall-friends-btn"
              onClick={onOpenFriends}
              title="查看好友列表与在线状态"
            >
              👥 在线好友
            </button>
          )}

          <button
            type="button"
            className="hall-user-pill"
            onClick={onOpenProfile}
            title="点击打开我的雀士手账名片"
          >
            <span className="pill-avatar">
              <AvatarView avatar={user?.avatar} alt="我的头像" />
            </span>
            <div className="pill-meta">
              <span className="pill-name">{user?.nickname || user?.username || nickname}</span>
              <span className="pill-title">{user?.title || '初学雀友'}</span>
            </div>
            <span className="pill-arrow" aria-hidden="true">›</span>
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

      {/* Main Full-Bleed Center Area */}
      <main className="lobby-main-layout">
        {/* Left Side: Grand Title & Cultural Showcase */}
        <aside className="lobby-hero-showcase">
          <div className="hero-emblem-badge">
            <span className="emblem-star" aria-hidden="true">★</span>
            <span>PIZHOU MAHJONG · 地道家乡雀馆</span>
          </div>
          <h1 className="lobby-hero-title">
            邳州<span className="title-accent">麻将</span>
          </h1>
          <p className="lobby-hero-motto">正宗苏北传统规则 · 查胡两两结 · 雀圣争锋</p>

          <div className="lobby-feature-ribbon">
            <div className="ribbon-item">
              <strong>两对关门</strong>
              <small>听牌关门免包香</small>
            </div>
            <div className="ribbon-divider" />
            <div className="ribbon-item">
              <strong>坎上自杠</strong>
              <small>独创暗杠升级机制</small>
            </div>
            <div className="ribbon-divider" />
            <div className="ribbon-item">
              <strong>两两对账</strong>
              <small>四家算胡胜负分明</small>
            </div>
          </div>
        </aside>

        {/* Right Side: Game Modes Console */}
        <section className="lobby-modes-console">
          {selectedMode === 'menu' ? (
            <div className="lobby-mode-cards-stack">
              {/* Online Mode Hero Card */}
              <button
                type="button"
                className={`mode-hero-card online-hero ${!onlineReady ? 'disabled' : ''}`}
                disabled={!onlineReady}
                onClick={() => setSelectedMode('online')}
              >
                <div className="hero-card-glow" />
                <div className="hero-card-content">
                  <div className="hero-card-tag">👥 好友四人桌</div>
                  <h3>好友四人联机</h3>
                  <p>房号一键直达 · 实时低延迟联机对战 · 自动两两算胡</p>
                  <div className="hero-card-action">
                    <span>进入联机对局</span>
                    <i aria-hidden="true">→</i>
                  </div>
                </div>
                <div className="hero-card-art-icon" aria-hidden="true">🀄</div>
              </button>

              {/* Local AI Mode Hero Card */}
              <button
                type="button"
                className="mode-hero-card local-hero"
                disabled={soloBusy}
                onClick={onStartLocal}
              >
                <div className="hero-card-glow" />
                <div className="hero-card-content">
                  <div className="hero-card-tag">🤖 单机练习场</div>
                  <h3>单机人机陪练</h3>
                  <p>3名智能AI陪练 · 无需等待秒开局 · 演练关门与坎上</p>
                  <div className="hero-card-action">
                    <span>{soloBusy ? '正在进入…' : '立即单机开局'}</span>
                    <i aria-hidden="true">→</i>
                  </div>
                </div>
                <div className="hero-card-art-icon" aria-hidden="true">🤖</div>
              </button>
            </div>
          ) : (
            /* Online Room Operations Panel */
            <div className="lobby-online-operation-card">
              <div className="operation-card-header">
                <button
                  type="button"
                  className="btn-action ghost sm back-btn"
                  onClick={() => setSelectedMode('menu')}
                >
                  ‹ 返回模式选择
                </button>
                <h2>👥 好友四人联机</h2>
              </div>

              <div className="operation-actions-wrap">
                <button
                  type="button"
                  className="btn-action primary online-create-btn"
                  disabled={!onlineReady}
                  onClick={onCreateRoom}
                >
                  🀄 一键创建新房间 (获取 6 位房号)
                </button>

                <div className="online-or-divider">
                  <span>或者输入好友房号快速入座</span>
                </div>

                <div className="hall-join-row">
                  <input
                    className="join-input"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && onlineReady && roomCode.length === 6) join();
                    }}
                    placeholder="输入 6 位房间号"
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
        </section>
      </main>

      {/* Edge-to-Edge Bottom Dock */}
      <footer className="hall-footer-dock">
        <div className="dock-left">
          <span className="dock-status-dot" aria-hidden="true" />
          <span>CF 云端边缘极速网络 · 实时对局同步</span>
          <button type="button" className="btn-link" onClick={onSettings} title={serverUrl}>
            服务器配置
          </button>
        </div>

        <div className="dock-right">
          <button type="button" className="dock-action-btn" onClick={() => setShowHistory(true)}>
            📜 战绩牌谱
          </button>
          <button type="button" className="dock-action-btn" onClick={onRules}>
            📖 规则总览
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

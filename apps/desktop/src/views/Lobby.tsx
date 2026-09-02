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
        <div className="hall-brand-mark">
          <div className="brand-seal-icon" aria-hidden="true">邳</div>
          <div className="brand-text-col">
            <span className="brand-name">邳州麻将</span>
            <span className="brand-sub">PIZHOU MAHJONG</span>
          </div>
          <div className="brand-ping-pill" title="网络延迟">
            <span className={`net-dot ${networkStatus}`} aria-hidden="true" />
            <span>{networkStatus === 'open' ? '18ms · 极速' : networkStatus === 'connecting' ? '连接中' : '离线'}</span>
          </div>
        </div>

        <div className="hall-user-pill-wrap">
          {/* Points / Coins Display */}
          <div className="hall-currency-pill" title="我的雀庄筹码">
            <span className="currency-icon">💰</span>
            <span className="currency-val">{user ? '8,880' : '1,000'}</span>
          </div>

          {onOpenFriends && (
            <button
              type="button"
              className="hall-tool-btn friends-btn"
              onClick={onOpenFriends}
              title="好友列表与在线状态"
            >
              <span className="btn-icon">👥</span>
              <span>好友</span>
            </button>
          )}

          {/* Luxury Player Dossier Capsule */}
          <button
            type="button"
            className="hall-dossier-capsule"
            onClick={onOpenProfile}
            title="打开雀士名片与成就"
          >
            <span className="dossier-avatar-ring">
              <AvatarView avatar={user?.avatar} alt="我的头像" />
              <span className="avatar-level-badge">1</span>
            </span>
            <div className="dossier-info">
              <span className="dossier-name">{user?.nickname || user?.username || nickname}</span>
              <span className="dossier-rank">{user?.title || '初心雀士'}</span>
            </div>
            <span className="dossier-arrow" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            className="hall-tool-btn logout-btn"
            onClick={onLogout}
            title="退出登录"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main Stage: Asymmetric Oriental Anime Game Hub */}
      <main className="lobby-main-layout">
        {/* Left Side: Majestic Cultural Title & Philosophy */}
        <aside className="lobby-brand-hero">
          <div className="hero-origin-ribbon">
            <span className="ribbon-spark">✦</span>
            <span>江淮雀道 · 地道家乡牌馆</span>
            <span className="ribbon-spark">✦</span>
          </div>

          <h1 className="lobby-hero-title">
            邳州<span className="title-gold">麻将</span>
          </h1>

          <div className="hero-charms-row">
            <span className="charm-item">两对关门</span>
            <span className="charm-dot">·</span>
            <span className="charm-item">坎上自杠</span>
            <span className="charm-dot">·</span>
            <span className="charm-item">两两对账</span>
          </div>
        </aside>

        {/* Right Side: Luxurious Game Mode Console */}
        <section className="lobby-modes-console">
          {selectedMode === 'menu' ? (
            <div className="lobby-mode-cards-stack">
              {/* Online Mode Hero Card */}
              <div
                role="button"
                tabIndex={0}
                className={`mode-luxury-card online-card ${!onlineReady ? 'disabled' : ''}`}
                onClick={() => onlineReady && setSelectedMode('online')}
                onKeyDown={(e) => e.key === 'Enter' && onlineReady && setSelectedMode('online')}
              >
                <div className="card-ambient-light" />
                <div className="card-border-glow" />
                <div className="card-body">
                  <div className="card-header-row">
                    <span className="card-badge sapphire">4人联机 · 房号直连</span>
                    <span className="card-en">ONLINE ARENA</span>
                  </div>
                  <h2 className="card-title">友人对战</h2>
                  <p className="card-desc">创建专属房间，与好友实时对弈，两两对账自动结算</p>
                  <div className="card-action-bar">
                    <span className="action-text">进入联机大厅</span>
                    <span className="action-circle">→</span>
                  </div>
                </div>
                <div className="card-watermark" aria-hidden="true">🀄</div>
              </div>

              {/* Solo Practice Hero Card */}
              <div
                role="button"
                tabIndex={0}
                className={`mode-luxury-card solo-card ${soloBusy ? 'disabled' : ''}`}
                onClick={() => !soloBusy && onStartLocal()}
                onKeyDown={(e) => e.key === 'Enter' && !soloBusy && onStartLocal()}
              >
                <div className="card-ambient-light" />
                <div className="card-border-glow" />
                <div className="card-body">
                  <div className="card-header-row">
                    <span className="card-badge emerald">单机练习 · 秒进对局</span>
                    <span className="card-en">SOLO PRACTICE</span>
                  </div>
                  <h2 className="card-title">{soloBusy ? '正在开局…' : '单机演练'}</h2>
                  <p className="card-desc">3 名智能 AI 雀友陪练，零等待秒开局，磨砺关门与自杠牌技</p>
                  <div className="card-action-bar">
                    <span className="action-text">{soloBusy ? '开局中…' : '立即单机开局'}</span>
                    <span className="action-circle">→</span>
                  </div>
                </div>
                <div className="card-watermark" aria-hidden="true">🤖</div>
              </div>
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
                  ‹ 返回选择
                </button>
                <h2>友人对战 · 房间管理</h2>
              </div>

              <div className="operation-actions-wrap">
                <button
                  type="button"
                  className="btn-action primary online-create-btn"
                  disabled={!onlineReady}
                  onClick={onCreateRoom}
                >
                  一键创建新房间 (生成 6 位房号)
                </button>

                <div className="online-or-divider">
                  <span>或输入好友 6 位房号</span>
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
          <button type="button" className="dock-link-btn" onClick={onSettings} title={serverUrl}>
            ⚙️ 网络设置
          </button>
        </div>

        <div className="dock-right">
          <button type="button" className="dock-link-btn" onClick={() => setShowHistory(true)}>
            📜 战绩牌谱
          </button>
          <span className="dock-sep">/</span>
          <button type="button" className="dock-link-btn" onClick={onRules}>
            📖 规则详解
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



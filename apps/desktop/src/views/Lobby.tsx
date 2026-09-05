import { useState, useRef, useEffect } from 'react';
import type { UserProfile } from '@pizhou/shared';
import { MatchHistoryModal } from '../components/MatchHistoryModal';
import { AvatarView } from '../components/AvatarView';
import '../styles/lobby.css';

export type NetworkStatus = 'connecting' | 'open' | 'closed';

interface LobbyProps {
  nickname: string;
  error: string;
  networkStatus: NetworkStatus;
  serverUrl: string;
  token: string | null;
  user: UserProfile | null;
  soloBusy?: boolean;
  onCreateRoom: (options?: { botCount?: number; pointRate?: number }) => void;
  onJoinRoom: (roomCode: string) => void;
  onStartLocal: () => void;
  onRules: () => void;
  onSettings: () => void;
  onOpenProfile: () => void;
  onOpenLeaderboard?: () => void;
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
  onOpenLeaderboard,
  onOpenFriends,
  onLogout,
}: LobbyProps) {
  const [activePanel, setActivePanel] = useState<'cards' | 'join'>('cards');
  const [pin, setPin] = useState<string[]>(['', '', '', '', '', '']);
  const [showHistory, setShowHistory] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createBotCount, setCreateBotCount] = useState<number>(0);
  const [createPointRate, setCreatePointRate] = useState<number>(0.1);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const onlineReady = networkStatus === 'open';
  const fullPin = pin.join('');
  const isPinComplete = fullPin.length === 6 && /^\d{6}$/.test(fullPin);

  // Auto-focus first PIN box when switching to 'join'
  useEffect(() => {
    if (activePanel === 'join') {
      setTimeout(() => {
        pinInputRefs.current[0]?.focus();
      }, 60);
    }
  }, [activePanel]);

  const handlePinChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    // Auto-advance
    if (digit && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (pin[index]) {
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
      } else if (index > 0) {
        const newPin = [...pin];
        newPin[index - 1] = '';
        setPin(newPin);
        pinInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && isPinComplete && onlineReady) {
      onJoinRoom(fullPin);
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newPin = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newPin[i] = pasted[i]!;
    }
    setPin(newPin);

    const focusIndex = Math.min(5, pasted.length);
    pinInputRefs.current[focusIndex]?.focus();
  };

  const handleClearPin = () => {
    setPin(['', '', '', '', '', '']);
    pinInputRefs.current[0]?.focus();
  };

  const submitJoin = () => {
    if (!isPinComplete || !onlineReady) return;
    onJoinRoom(fullPin);
  };

  return (
    <div className="hall lobby-grand-stage">
      <img className="lobby-bg-artwork" src="./assets/lobby-bg.jpg" alt="" draggable={false} />
      <div className="lobby-vignette-overlay" aria-hidden="true" />

      {/* Edge-to-Edge Frosted Jade Lacquer Header Bar */}
      <header className="guofeng-nav-bar">
        <div className="guofeng-brand">
          <div className="guofeng-seal" aria-hidden="true">邳</div>
          <div className="guofeng-brand-text">
            <span className="guofeng-title">邳州麻将</span>
            <span className="guofeng-subtitle">PIZHOU MAHJONG</span>
          </div>
          <div className="guofeng-ping-pill" title="服务器网络质量">
            <span className={`guofeng-ping-dot ${networkStatus}`} aria-hidden="true" />
            <span>{networkStatus === 'open' ? '18ms · 极速' : networkStatus === 'connecting' ? '连接中' : '离线'}</span>
          </div>
        </div>

        <div className="guofeng-header-actions">
          {/* Gold Currency Pill */}
          <div className="guofeng-currency-pill" title="雀庄筹码积分">
            <span className="currency-gold-coin" aria-hidden="true">💰</span>
            <span className="currency-amount">{user ? '8,880' : '1,000'}</span>
            <span className="currency-unit">雀币</span>
          </div>

          {onOpenFriends && (
            <button
              type="button"
              className="guofeng-tool-btn"
              onClick={onOpenFriends}
              title="好友列表与在线牌友"
            >
              <span aria-hidden="true">👥</span>
              <span>好友</span>
            </button>
          )}

          {/* Guofeng Player Mini Profile Preview Capsule */}
          <button
            type="button"
            className="guofeng-dossier-capsule"
            onClick={onOpenProfile}
            title="查看与编辑雀士名片及成就"
          >
            <span className="guofeng-avatar-ring">
              <AvatarView avatar={user?.avatar} alt="雀士头像" />
            </span>
            <div className="guofeng-dossier-info">
              <span className="guofeng-dossier-name">{user?.nickname || user?.username || nickname}</span>
              <span className="guofeng-dossier-rank">{user?.title || '初学雀友'}</span>
            </div>
            <span className="guofeng-capsule-arrow" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            className="guofeng-tool-btn logout"
            onClick={onLogout}
            title="退出登录"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main Stage: Asymmetric Oriental Guofeng Game Hub */}
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
          {activePanel === 'cards' ? (
            <div className="guofeng-mode-grid">
              {/* Card 1: 单机练习 */}
              <div
                role="button"
                tabIndex={0}
                className={`guofeng-mode-card card-solo ${soloBusy ? 'disabled' : ''}`}
                onClick={() => !soloBusy && onStartLocal()}
                onKeyDown={(e) => e.key === 'Enter' && !soloBusy && onStartLocal()}
              >
                <div>
                  <div className="card-header-row">
                    <span className="card-badge-pill emerald">单机练习 · 秒进对局</span>
                    <span className="card-en-sub">SOLO PRACTICE</span>
                  </div>
                  <h2 className="gold-emboss-title">{soloBusy ? '正在开局…' : '单机演练'}</h2>
                  <p className="card-desc-text">3 名智能 AI 雀友陪练，零等待秒开局，磨砺关门与自杠牌技</p>
                </div>
                <div className="card-cta-bar">
                  <span className="card-cta-text">{soloBusy ? '开局中…' : '立即单机开局'}</span>
                  <span className="card-cta-circle">→</span>
                </div>
                <div className="card-bg-watermark" aria-hidden="true">🤖</div>
              </div>

              {/* Card 2: 创建好友房 */}
              <div
                role="button"
                tabIndex={0}
                className={`guofeng-mode-card card-create ${!onlineReady ? 'disabled' : ''}`}
                onClick={() => onlineReady && setShowCreateModal(true)}
                onKeyDown={(e) => e.key === 'Enter' && onlineReady && setShowCreateModal(true)}
              >
                <div>
                  <div className="card-header-row">
                    <span className="card-badge-pill amber">专属私密 · 房号直连</span>
                    <span className="card-en-sub">CREATE ROOM</span>
                  </div>
                  <h2 className="gold-emboss-title">创建房间</h2>
                  <p className="card-desc-text">一键生成专属 6 位数字房号，邀请牌友线上两两对账对决</p>
                </div>
                <div className="card-cta-bar">
                  <span className="card-cta-text">创建 6 位好友房</span>
                  <span className="card-cta-circle">→</span>
                </div>
                <div className="card-bg-watermark" aria-hidden="true">🀄</div>
              </div>

              {/* Card 3: 加入房间 */}
              <div
                role="button"
                tabIndex={0}
                className={`guofeng-mode-card card-join ${!onlineReady ? 'disabled' : ''}`}
                onClick={() => onlineReady && setActivePanel('join')}
                onKeyDown={(e) => e.key === 'Enter' && onlineReady && setActivePanel('join')}
              >
                <div>
                  <div className="card-header-row">
                    <span className="card-badge-pill sapphire">输入房号 · 快速入座</span>
                    <span className="card-en-sub">JOIN ROOM</span>
                  </div>
                  <h2 className="gold-emboss-title">加入房间</h2>
                  <p className="card-desc-text">输入好友分享的 6 位方格朱砂印鉴房号，即刻入席对战</p>
                </div>
                <div className="card-cta-bar">
                  <span className="card-cta-text">输入 6 位房号</span>
                  <span className="card-cta-circle">→</span>
                </div>
                <div className="card-bg-watermark" aria-hidden="true">🚪</div>
              </div>

              {/* Card 4: 雀友风云榜 */}
              <div
                role="button"
                tabIndex={0}
                className="guofeng-mode-card card-match"
                onClick={() => (onOpenLeaderboard ? onOpenLeaderboard() : onOpenProfile())}
                onKeyDown={(e) => e.key === 'Enter' && (onOpenLeaderboard ? onOpenLeaderboard() : onOpenProfile())}
              >
                <div>
                  <div className="card-header-row">
                    <span className="card-badge-pill purple">熟人雀庄 · 全员风云榜</span>
                    <span className="card-en-sub">LEADERBOARD</span>
                  </div>
                  <h2 className="gold-emboss-title">雀友风云榜</h2>
                  <p className="card-desc-text">汇集所有现存牌友战绩，实时查看净胜积分、胜率及活跃局数排名</p>
                </div>
                <div className="card-cta-bar">
                  <span className="card-cta-text">查看雀友排名</span>
                  <span className="card-cta-circle">→</span>
                </div>
                <div className="card-bg-watermark" aria-hidden="true">🏆</div>
              </div>
            </div>
          ) : (
            /* Refined 6-Digit Segmented PIN Room Join Panel */
            <div className="guofeng-join-panel">
              <div className="join-panel-header">
                <div>
                  <h2 className="join-panel-title">方格朱砂印鉴 · 房号入席</h2>
                  <span className="join-panel-hint">请输入房主分享的 6 位数字房号，支持直接粘贴</span>
                </div>
                <button
                  type="button"
                  className="btn-guofeng-clear"
                  onClick={() => setActivePanel('cards')}
                >
                  ‹ 返回选择
                </button>
              </div>

              {/* 6 Segmented PIN Boxes */}
              <div className="segmented-pin-wrap" onPaste={handlePinPaste}>
                {pin.map((digit, idx) => (
                  <div
                    key={idx}
                    className={`pin-digit-box ${digit ? 'is-filled' : ''} ${
                      pinInputRefs.current[idx] === document.activeElement ? 'is-active' : ''
                    }`}
                    onClick={() => pinInputRefs.current[idx]?.focus()}
                  >
                    <input
                      ref={(el) => {
                        pinInputRefs.current[idx] = el;
                      }}
                      className="pin-digit-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    />
                  </div>
                ))}
              </div>

              <div className="pin-actions-row">
                <button
                  type="button"
                  className="btn-guofeng-join"
                  disabled={!isPinComplete || !onlineReady}
                  onClick={submitJoin}
                >
                  {isPinComplete ? `立即加入房间 [${fullPin}]` : '请输入 6 位完整房号'}
                </button>
                <button
                  type="button"
                  className="btn-guofeng-clear"
                  onClick={handleClearPin}
                >
                  清空
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Edge-to-Edge Bottom Dock */}
      <footer className="hall-footer-dock">
        <div className="dock-left">
          <button type="button" className="dock-link-btn" onClick={onSettings} title={serverUrl}>
            ⚙️ 游戏设置
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

      {/* Custom Bot & Rate Room Creation Modal */}
      {showCreateModal ? (
        <div className="guofeng-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="guofeng-modal-card create-room-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="gold-line" />
            <div className="create-room-modal-header">
              <span className="eyebrow">专属好友对局 · 房号直连</span>
              <h2>创建对局房间</h2>
              <p className="sub">支持自定义陪练人机数量，哪怕只有两个人也能与朋友痛快开打！</p>
            </div>

            <div className="create-room-section">
              <label className="create-section-label">
                <span>🤖 补齐陪练人机</span>
                <small>缺人时自动替补，进入大厅后仍可随时增删</small>
              </label>
              <div className="create-bot-options-grid">
                {[
                  { count: 0, tag: '全真人', title: '无人机 (0人)', desc: '纯真人对局，等待3位朋友加入' },
                  { count: 1, tag: '3缺1', title: '1 位人机', desc: '等2位朋友，补1个人机即可开局' },
                  { count: 2, tag: '2人开黑', title: '2 位人机', desc: '我和1位朋友，补2个人机痛快对决' },
                  { count: 3, tag: '单人开房', title: '3 位人机', desc: '单人开房，亦可随时把房号发给朋友' },
                ].map((item) => {
                  const active = createBotCount === item.count;
                  return (
                    <button
                      key={item.count}
                      type="button"
                      className={`create-bot-card ${active ? 'active' : ''}`}
                      onClick={() => setCreateBotCount(item.count)}
                    >
                      <div className="create-bot-card-top">
                        <span className="create-bot-title">{item.title}</span>
                        <span className="create-bot-tag">{item.tag}</span>
                      </div>
                      <p className="create-bot-desc">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="create-room-section">
              <label className="create-section-label">
                <span>💰 结算底分单价</span>
                <small>开局后固定，终局将按此底分对账</small>
              </label>
              <div className="create-rate-chips">
                {[
                  { val: 0.1, label: '¥0.1 / 分' },
                  { val: 0.2, label: '¥0.2 / 分' },
                  { val: 0.5, label: '¥0.5 / 分' },
                  { val: 1.0, label: '¥1.0 / 分' },
                  { val: 0, label: '仅看积分' },
                ].map((opt) => {
                  const active = createPointRate === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={`create-rate-chip ${active ? 'active' : ''}`}
                      onClick={() => setCreatePointRate(opt.val)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="create-room-hint-box">
              <span className="hint-icon">💡</span>
              <p>房主入座大厅后，点击空位或右侧面板可随时为朋友腾座或增添人机。</p>
            </div>

            <div className="create-room-modal-actions">
              <button
                type="button"
                className="btn-create-confirm hero"
                onClick={() => {
                  onCreateRoom({ botCount: createBotCount, pointRate: createPointRate });
                  setShowCreateModal(false);
                }}
              >
                🀄 立即创建专属房间
              </button>
              <button
                type="button"
                className="btn-create-cancel ghost"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

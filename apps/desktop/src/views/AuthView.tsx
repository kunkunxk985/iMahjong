import { useRef, useState } from 'react';
import { NICKNAME_MAX, PASSWORD_MIN, USERNAME_MAX, type UserProfile } from '@pizhou/shared';
import { apiGuestLogin, apiLogin, apiRegister } from '../api/auth';

interface AuthViewProps {
  serverUrl: string;
  onSuccess: (user: UserProfile, token?: string) => void;
  onRules?: () => void;
  onSettings?: () => void;
}

export function AuthView({ serverUrl, onSuccess, onRules, onSettings }: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [registrationNickname, setRegistrationNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authStageRef = useRef<HTMLDivElement | null>(null);

  const switchTab = (nextTab: 'login' | 'register') => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setTab(nextTab);
    setError('');
    window.requestAnimationFrame(() => authStageRef.current?.scrollTo({ top: 0, behavior: 'auto' }));
  };

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGuestLogin(serverUrl);
      onSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || '游客进入失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiLogin(serverUrl, username, password);
      onSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || '登录失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('请输入账号和密码');
      return;
    }
    if (cleanUser.length < 2) {
      setError('账号至少需 2 个字符');
      return;
    }
    if (cleanUser.length > USERNAME_MAX) {
      setError(`账号不能超过 ${USERNAME_MAX} 个字符`);
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setError(`密码至少需 ${PASSWORD_MIN} 位`);
      return;
    }
    if (password !== passwordConfirmation) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiRegister(
        serverUrl,
        cleanUser,
        password,
        registrationNickname.trim() || cleanUser,
      );
      onSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={authStageRef} className="auth-stage">
      <aside className="auth-hero-panel" aria-label="邳州麻将游戏介绍">
        <div className="auth-hero-seal-row">
          <div className="auth-hero-mark" aria-hidden="true">🀄</div>
          <span className="auth-city-badge">江苏 · 邳州</span>
        </div>
        <p className="auth-hero-eyebrow">PIZHOU MAHJONG · 地道家乡雀馆</p>
        <h2>
          今晚，和老朋友
          <br />
          <em>摸一圈</em>
        </h2>
        <p className="auth-hero-copy">
          原汁原味的邳州经典麻将。两对关门、坎上自杠，头像、网名与每局胡账云端留存。
        </p>

        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <span className="auth-feature-icon" aria-hidden="true">四</span>
            <span>
              <strong>四人好友联机</strong>
              <small>6位房号一发，马上入桌开局</small>
            </span>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon" aria-hidden="true">名</span>
            <span>
              <strong>雀士身份名片</strong>
              <small>自定义头像、头衔与牌桌宣言</small>
            </span>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon" aria-hidden="true">记</span>
            <span>
              <strong>战绩物理隔离</strong>
              <small>联机实战与单机演练清晰独立</small>
            </span>
          </div>
        </div>

        <div className="auth-hero-status">
          <span className="auth-status-dot" aria-hidden="true" />
          云端雀士服务就绪 · 实时低延迟
        </div>
      </aside>

      <div className="auth-card">
        <div className="gold-line" />
        <div className="auth-card-header">
          <span className="auth-card-kicker">雀士入口</span>
          <h1 className="auth-title">进入邳州麻将</h1>
          <p className="auth-subtitle">账号漫游 · 头像网名全端同步</p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            🔑 账号登录
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            ✨ 快速注册
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={tab === 'login' ? handleLogin : handleRegister}>
          <div className="form-group">
            <label className="sr-only" htmlFor="auth-username">雀士账号</label>
            <input
              id="auth-username"
              type="text"
              className="input-field"
              placeholder={tab === 'login' ? '请输入您的雀士账号' : '设置新账号（自动作为昵称）'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={tab === 'register' ? USERNAME_MAX : undefined}
              autoComplete={tab === 'login' ? 'username' : 'username'}
              autoFocus
            />
          </div>

          {tab === 'register' ? (
            <div className="form-group">
              <label className="sr-only" htmlFor="auth-nickname">游戏昵称</label>
              <input
                id="auth-nickname"
                type="text"
                className="input-field"
                placeholder="设置游戏昵称（可稍后在档案中修改）"
                value={registrationNickname}
                onChange={(e) => setRegistrationNickname(e.target.value)}
                maxLength={NICKNAME_MAX}
              />
            </div>
          ) : null}

          <div className="form-group">
            <label className="sr-only" htmlFor="auth-password">账号密码</label>
            <input
              id="auth-password"
              type="password"
              className="input-field"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'register' ? (
            <div className="form-group">
              <label className="sr-only" htmlFor="auth-password-confirmation">确认密码</label>
              <input
                id="auth-password-confirmation"
                type="password"
                className="input-field"
                placeholder={`再次输入密码（至少 ${PASSWORD_MIN} 位）`}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          ) : null}

          <button type="submit" className="btn-action primary auth-submit-btn" disabled={loading}>
            {loading ? '正在进入...' : tab === 'login' ? '登 录 进 入' : '注 册 并 进 入'}
          </button>
        </form>

        <div className="auth-divider">
          <span>或</span>
        </div>

        {/* Guest Action */}
        <button
          type="button"
          className="btn-action ghost auth-guest-btn"
          disabled={loading}
          onClick={handleGuest}
        >
          ⚡ 免密游客快速进入
        </button>

        {/* Bottom Utility Links */}
        <div className="auth-bottom-links">
          {onRules && (
            <button type="button" className="btn-link" onClick={onRules}>
              📖 规则介绍
            </button>
          )}
          {onSettings && (
            <button type="button" className="btn-link" onClick={onSettings}>
              ⚙️ 游戏设置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

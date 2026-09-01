import { useState } from 'react';
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
    <div className="auth-stage">
      <div className="auth-card">
        {/* Game Title */}
        <div className="auth-card-header">
          <h1 className="auth-title">🀄 邳 州 麻 将</h1>
          <p className="auth-subtitle">地道苏北规则 · 四人联机对战</p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError('');
            }}
          >
            🔑 账号登录
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setError('');
            }}
          >
            ✨ 快速注册
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={tab === 'login' ? handleLogin : handleRegister}>
          <div className="form-group">
            <input
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
              <input
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
            <input
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
              <input
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
              ⚙️ 网络设置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

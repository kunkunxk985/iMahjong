import { useState } from 'react';
import { NICKNAME_MAX, PASSWORD_MIN, USERNAME_MAX, type UserProfile } from '@pizhou/shared';
import { apiGuestLogin, apiLogin, apiRegister } from '../api/auth';

interface AuthModalProps {
  serverUrl: string;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSuccess: (user: UserProfile, token?: string) => void;
}

export function AuthModal({ serverUrl, currentUser, onClose, onSuccess }: AuthModalProps) {
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
      const res = await apiGuestLogin(serverUrl, currentUser?.nickname);
      onSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setError(err.message || '游客登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请填写账号和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiLogin(serverUrl, username, password);
      onSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('请填写账号和密码');
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
      onClose();
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        <div className="auth-header">
          <h2>🀄 雀士登录 / 注册</h2>
          <p className="sub">登录后换任何电脑都能自动同步战绩与称号</p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

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

        <form className="auth-form" onSubmit={tab === 'login' ? handleLogin : handleRegister}>
          <div className="form-group">
            <label>雀士账号</label>
            <input
              type="text"
              className="input-field"
              placeholder={tab === 'login' ? '请输入您的账号' : '设置账号名（自动作为昵称）'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={tab === 'register' ? USERNAME_MAX : undefined}
              autoComplete="username"
              autoFocus
            />
          </div>

          {tab === 'register' ? (
            <div className="form-group">
              <label>游戏昵称</label>
              <input
                type="text"
                className="input-field"
                placeholder="可稍后在档案中修改"
                value={registrationNickname}
                onChange={(e) => setRegistrationNickname(e.target.value)}
                maxLength={NICKNAME_MAX}
              />
            </div>
          ) : null}

          <div className="form-group">
            <label>登录密码</label>
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
              <label>确认密码</label>
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
            {loading ? '处理中...' : tab === 'login' ? '立即登录' : '立即注册并登录'}
          </button>
        </form>

        <div className="auth-divider">
          <span>或者</span>
        </div>

        <div className="auth-guest-section">
          <button
            type="button"
            className="btn-action ghost guest-btn"
            disabled={loading}
            onClick={handleGuest}
          >
            ⚡ 免密游客快速进入
          </button>
        </div>

        <div className="row" style={{ marginTop: '14px', justifyContent: 'center' }}>
          <button type="button" className="btn-action text" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

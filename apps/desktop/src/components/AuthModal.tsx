import { useState } from 'react';
import type { UserProfile } from '@pizhou/shared';
import { apiGuestLogin, apiLogin, apiRegister } from '../api/auth';

interface AuthModalProps {
  serverUrl: string;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({ serverUrl, currentUser, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState(currentUser?.nickname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGuestLogin(serverUrl, nickname || undefined);
      onSuccess(res.user);
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
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请填写账号和密码');
      return;
    }
    if (username.trim().length < 3) {
      setError('账号至少需 3 个字符');
      return;
    }
    if (password.length < 4) {
      setError('密码至少需 4 位');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiRegister(serverUrl, username, password, nickname || undefined);
      onSuccess(res.user);
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
          <h2>🀄 雀士账号中心</h2>
          <p className="sub">登录云端账号，多设备同步对战战绩与专属荣誉</p>
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

        {tab === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>雀士账号</label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入用户名/账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>登录密码</label>
              <input
                type="password"
                className="input-field"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-action primary auth-submit-btn" disabled={loading}>
              {loading ? '正在登录...' : '立即登录'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label>雀士账号 (至少3位)</label>
              <input
                type="text"
                className="input-field"
                placeholder="设置登录账号名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>登录密码 (至少4位)</label>
              <input
                type="password"
                className="input-field"
                placeholder="设置登录密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>游戏内昵称 (选填)</label>
              <input
                type="text"
                className="input-field"
                placeholder="起一个响亮的麻将昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
              />
            </div>

            <button type="submit" className="btn-action primary auth-submit-btn" disabled={loading}>
              {loading ? '正在注册...' : '注册并登录'}
            </button>
          </form>
        )}

        <div className="auth-divider">
          <span>或</span>
        </div>

        <div className="auth-guest-section">
          <button
            type="button"
            className="btn-action ghost guest-btn"
            disabled={loading}
            onClick={handleGuest}
          >
            ⚡ 一键免密游客体验 (本机保存)
          </button>
        </div>

        <div className="row" style={{ marginTop: '16px', justifyContent: 'center' }}>
          <button type="button" className="btn-action text" onClick={onClose}>
            暂不登录，直接返回
          </button>
        </div>
      </div>
    </div>
  );
}

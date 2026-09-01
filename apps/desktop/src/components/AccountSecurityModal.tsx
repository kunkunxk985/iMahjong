import { useState } from 'react';
import {
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  type UserProfile,
} from '@pizhou/shared';
import { apiChangePassword, apiUpgradeGuest } from '../api/auth';

interface AccountSecurityModalProps {
  serverUrl: string;
  token: string | null;
  user: UserProfile;
  onClose: () => void;
  onUpdated: (user: UserProfile, token?: string) => void;
}

export function AccountSecurityModal({
  serverUrl,
  token,
  user,
  onClose,
  onUpdated,
}: AccountSecurityModalProps) {
  const isGuest = user.isGuest;
  const [username, setUsername] = useState(isGuest ? '' : user.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError('当前登录凭证不可用，请重新登录');
      return;
    }

    const cleanUsername = username.trim();
    if (isGuest && cleanUsername.length < USERNAME_MIN) {
      setError(`账号至少需 ${USERNAME_MIN} 个字符`);
      return;
    }
    if (isGuest && cleanUsername.length > USERNAME_MAX) {
      setError(`账号不能超过 ${USERNAME_MAX} 个字符`);
      return;
    }
    if (!isGuest && !currentPassword) {
      setError('请输入当前密码');
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`新密码至少需 ${PASSWORD_MIN} 位`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = isGuest
        ? await apiUpgradeGuest(serverUrl, token, cleanUsername, newPassword, user.nickname)
        : await apiChangePassword(serverUrl, token, currentPassword, newPassword);
      onUpdated(result.user, result.token);
      setSuccess(isGuest ? '正式账号已创建，资料和战绩都已保留' : '密码已修改，登录凭证已更新');
      window.setTimeout(onClose, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="overlay security-overlay"
      onClick={(event) => {
        event.stopPropagation();
        if (!loading && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal security-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gold-line" />
        <div className="security-header">
          <div>
            <h2>{isGuest ? '🔐 保存游客账号' : '🔐 账号安全'}</h2>
            <p>{isGuest ? '升级后头像、网名、好友和战绩都会继续保留' : '修改密码后，其他设备上的旧登录会失效'}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={loading} aria-label="关闭">
            ×
          </button>
        </div>

        {error ? <div className="security-error">{error}</div> : null}
        {success ? <div className="security-success">{success}</div> : null}

        <form className="security-form" onSubmit={handleSubmit}>
          {isGuest ? (
            <>
              <div className="security-note">
                当前是游客账号。设置账号和密码后，就能在其他电脑登录并找回当前资料。
              </div>
              <label className="security-field">
                <span>正式账号</span>
                <input
                  className="input-field"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={USERNAME_MAX}
                  autoComplete="username"
                  placeholder="2-24 个字符"
                  disabled={loading}
                  autoFocus
                />
              </label>
            </>
          ) : (
            <label className="security-field">
              <span>当前密码</span>
              <input
                className="input-field"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="请输入当前密码"
                disabled={loading}
                autoFocus
              />
            </label>
          )}

          <label className="security-field">
            <span>{isGuest ? '设置密码' : '新密码'}</span>
            <input
              className="input-field"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete={isGuest ? 'new-password' : 'new-password'}
              placeholder={`至少 ${PASSWORD_MIN} 位`}
              disabled={loading}
            />
          </label>

          <label className="security-field">
            <span>确认密码</span>
            <input
              className="input-field"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="再输入一次密码"
              disabled={loading}
            />
          </label>

          <label className="security-show-password">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(event) => setShowPasswords(event.target.checked)}
              disabled={loading}
            />
            <span>显示密码</span>
          </label>

          <div className="split security-actions">
            <button type="submit" className="btn-action primary" disabled={loading || Boolean(success)}>
              {loading ? '处理中…' : isGuest ? '保存并升级账号' : '确认修改密码'}
            </button>
            <button type="button" className="btn-action ghost" onClick={onClose} disabled={loading}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { PRESET_AVATARS, PRESET_TITLES, type UserProfile } from '@pizhou/shared';
import { apiUpdateProfile, saveStoredAuth } from '../api/auth';

interface ProfileModalProps {
  serverUrl: string;
  token: string | null;
  user: UserProfile;
  onClose: () => void;
  onUpdate: (user: UserProfile) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function ProfileModal({
  serverUrl,
  token,
  user,
  onClose,
  onUpdate,
  onOpenAuth,
  onLogout,
}: ProfileModalProps) {
  const [avatar, setAvatar] = useState(user.avatar || '🀄');
  const [nickname, setNickname] = useState(user.nickname);
  const [title, setTitle] = useState(user.title || '初学雀友');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSave = async () => {
    const cleanNick = nickname.trim() || user.username || '雀友';
    setSaving(true);
    setNotice(null);

    const updatedUser: UserProfile = {
      ...user,
      avatar,
      nickname: cleanNick,
      title,
      updatedAt: Date.now(),
    };

    if (token) {
      try {
        const saved = await apiUpdateProfile(serverUrl, token, {
          avatar,
          nickname: cleanNick,
          title,
        });
        onUpdate(saved);
        setNotice('资料已保存！');
        setTimeout(() => onClose(), 600);
        return;
      } catch (err: any) {
        console.warn('Sync profile failed, updating locally:', err);
      }
    }

    saveStoredAuth(token, updatedUser);
    onUpdate(updatedUser);
    setNotice('资料已保存！');
    setTimeout(() => onClose(), 600);
    setSaving(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        <div className="profile-header">
          <h2>🪪 雀士档案设置</h2>
          <span className="profile-user-tag">{user.isGuest ? '⚡ 游客模式' : `👑 ${user.username}`}</span>
        </div>

        {notice && <div className="profile-toast">{notice}</div>}

        <div className="profile-content">
          {/* Avatar Selector */}
          <div className="avatar-section">
            <label className="section-label">头像形象</label>
            <div className="avatar-preview-row">
              <div className="current-avatar-circle">{avatar}</div>
              <div className="avatar-picker-grid">
                {PRESET_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`avatar-option-btn ${avatar === emoji ? 'active' : ''}`}
                    onClick={() => setAvatar(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nickname & Title */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>雀士昵称</label>
            <input
              type="text"
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              placeholder="请输入昵称"
            />
          </div>

          <div className="form-group">
            <label>荣誉头衔</label>
            <div className="title-select-grid">
              {PRESET_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`title-chip ${title === t ? 'active' : ''}`}
                  onClick={() => setTitle(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Account Actions */}
          <div className="account-info-box">
            <div className="info-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <button type="button" className="btn-action ghost sm" onClick={onOpenAuth}>
                {user.isGuest ? '🔑 注册/绑定正式账号' : '🔄 切换其他账号'}
              </button>
              <button type="button" className="btn-action ghost sm danger" onClick={onLogout}>
                退出登录
              </button>
            </div>
          </div>
        </div>

        <div className="split" style={{ marginTop: '18px' }}>
          <button type="button" className="btn-action primary" disabled={saving} onClick={handleSave}>
            {saving ? '保存中...' : '保存修改'}
          </button>
          <button type="button" className="btn-action ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

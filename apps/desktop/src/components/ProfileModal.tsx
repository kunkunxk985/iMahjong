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
  const [bio, setBio] = useState(user.bio || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = async () => {
    const cleanNick = nickname.trim() || user.username || '雀友';
    setSaving(true);
    setNotice(null);

    const updatedUser: UserProfile = {
      ...user,
      avatar,
      nickname: cleanNick,
      title,
      bio,
      updatedAt: Date.now(),
    };

    if (token) {
      try {
        const saved = await apiUpdateProfile(serverUrl, token, {
          avatar,
          nickname: cleanNick,
          title,
          bio,
        });
        onUpdate(saved);
        setNotice('资料已同步至云端！');
        setTimeout(() => onClose(), 800);
        return;
      } catch (err: any) {
        console.warn('Sync profile to cloud failed, updating locally:', err);
      }
    }

    // Local update fallback
    saveStoredAuth(token, updatedUser);
    onUpdate(updatedUser);
    setNotice('资料已在本地保存！');
    setTimeout(() => onClose(), 800);
    setSaving(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        <div className="profile-header">
          <h2>🪪 雀士个人档案</h2>
          <div className="user-id-badge" onClick={handleCopyId} title="点击复制雀友卡号">
            <span>ID: {user.userId}</span>
            <small>{copied ? '已复制✓' : '📋'}</small>
          </div>
        </div>

        {notice && <div className="profile-toast">{notice}</div>}

        <div className="profile-content">
          {/* Avatar Selector */}
          <div className="avatar-section">
            <label className="section-label">雀士形象</label>
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
            <label>玩家昵称</label>
            <input
              type="text"
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              placeholder="请输入您的昵称"
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

          {/* Bio */}
          <div className="form-group">
            <label>个性签名</label>
            <input
              type="text"
              className="input-field"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={40}
              placeholder="写一句打牌宣言（如：单钓不换张，胡牌按飘荤）"
            />
          </div>

          {/* Account Status Info */}
          <div className="account-info-box">
            <div className="info-row">
              <span>账号类型:</span>
              <b>{user.isGuest ? '⚡ 游客体验模式' : `👑 注册雀士 (${user.username})`}</b>
            </div>
            <div className="info-actions">
              {user.isGuest ? (
                <button type="button" className="btn-action ghost sm" onClick={onOpenAuth}>
                  绑定正式账号
                </button>
              ) : (
                <button type="button" className="btn-action ghost sm" onClick={onOpenAuth}>
                  切换账号
                </button>
              )}
              <button type="button" className="btn-action ghost sm danger" onClick={onLogout}>
                退出登录
              </button>
            </div>
          </div>
        </div>

        <div className="split" style={{ marginTop: '20px' }}>
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

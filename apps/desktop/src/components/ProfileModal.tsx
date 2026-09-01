import { useState } from 'react';
import {
  AVATAR_DATA_URL_MAX_LENGTH,
  BIO_MAX,
  DEFAULT_AVATAR,
  isImageAvatar,
  NICKNAME_MAX,
  PRESET_AVATARS,
  PRESET_TITLES,
  sanitizeAvatar,
  type UserProfile,
} from '@pizhou/shared';
import { apiUpdateProfile, saveStoredAuth } from '../api/auth';
import { AccountSecurityModal } from './AccountSecurityModal';
import { AvatarView } from './AvatarView';

const AVATAR_IMAGE_SIZE = 96;
const MAX_SOURCE_AVATAR_BYTES = 8 * 1024 * 1024;

async function encodeAvatarFile(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('头像仅支持 JPG、PNG 或 WebP 图片');
  }
  if (file.size > MAX_SOURCE_AVATAR_BYTES) {
    throw new Error('图片不能超过 8MB');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('图片读取失败，请换一张试试'));
      element.src = objectUrl;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('图片尺寸无效，请换一张试试');

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_IMAGE_SIZE;
    canvas.height = AVATAR_IMAGE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前环境不支持头像处理');

    const scale = Math.max(AVATAR_IMAGE_SIZE / width, AVATAR_IMAGE_SIZE / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    context.clearRect(0, 0, AVATAR_IMAGE_SIZE, AVATAR_IMAGE_SIZE);
    context.drawImage(
      image,
      (AVATAR_IMAGE_SIZE - drawWidth) / 2,
      (AVATAR_IMAGE_SIZE - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    const webpProbe = canvas.toDataURL('image/webp', 0.82);
    const mime = webpProbe.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const encoded = canvas.toDataURL(mime, quality);
      if (isImageAvatar(encoded) && encoded.length <= AVATAR_DATA_URL_MAX_LENGTH) return encoded;
    }
    throw new Error('头像压缩后仍然过大，请换一张图片');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface ProfileModalProps {
  serverUrl: string;
  token: string | null;
  user: UserProfile;
  onClose: () => void;
  onUpdate: (user: UserProfile, token?: string) => void;
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
  const [avatar, setAvatar] = useState(sanitizeAvatar(user.avatar, DEFAULT_AVATAR));
  const [nickname, setNickname] = useState(user.nickname || user.username);
  const [title, setTitle] = useState(user.title || '初学雀友');
  const [bio, setBio] = useState(user.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      setAvatar(await encodeAvatarFile(file));
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : '头像处理失败，请重试');
    } finally {
      setUploadingAvatar(false);
    }
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

    try {
      if (token) {
        const saved = await apiUpdateProfile(serverUrl, token, {
          avatar,
          nickname: cleanNick,
          title,
          bio,
        });
        onUpdate(saved);
        setNotice('资料已同步到云端');
        setTimeout(() => onClose(), 600);
        return;
      }

      saveStoredAuth(token, updatedUser);
      onUpdate(updatedUser);
      setNotice('资料已保存到本机');
      setTimeout(() => onClose(), 600);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : '云端保存失败，请重试');
    } finally {
      setSaving(false);
    }
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
              <div className="current-avatar-circle">
                <AvatarView avatar={avatar} alt="当前头像" />
              </div>
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
                <label
                  className={`avatar-upload-btn ${isImageAvatar(avatar) ? 'active' : ''} ${uploadingAvatar ? 'is-loading' : ''}`}
                  title="上传自定义头像"
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFile}
                    disabled={uploadingAvatar}
                  />
                  <span>{uploadingAvatar ? '…' : '＋'}</span>
                  <small>上传</small>
                </label>
              </div>
            </div>
            <p className="avatar-help">支持 JPG、PNG、WebP；图片会自动裁成方形并压缩后同步到云端</p>
            {avatarError && <p className="avatar-error">{avatarError}</p>}
          </div>

          {/* Nickname & Title */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>雀士昵称</label>
            <input
              type="text"
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_MAX}
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

          <div className="form-group">
            <label>个性签名</label>
            <textarea
              className="input-field profile-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={2}
              placeholder="写一句你的牌桌宣言"
            />
          </div>

          {/* Account Actions */}
          <div className="account-info-box">
            <div className="info-row">
              <span>账号状态</span>
              <b>{user.isGuest ? '游客资料' : '云端正式账号'}</b>
            </div>
            <div className="info-row">
              <span>账号 ID</span>
              <b title={user.userId}>{user.userId}</b>
            </div>
            <div className="info-actions">
              <button type="button" className="btn-action ghost sm" onClick={() => setSecurityOpen(true)}>
                {user.isGuest ? '🔐 保存为正式账号' : '🔐 修改密码'}
              </button>
              {!user.isGuest ? (
                <button type="button" className="btn-action ghost sm" onClick={onOpenAuth}>
                  🔄 切换账号
                </button>
              ) : null}
              <button type="button" className="btn-action ghost sm danger" onClick={onLogout}>
                退出登录
              </button>
            </div>
          </div>
        </div>

        <div className="split" style={{ marginTop: '18px' }}>
          <button
            type="button"
            className="btn-action primary"
            disabled={saving || uploadingAvatar || Boolean(avatarError)}
            onClick={handleSave}
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
          <button type="button" className="btn-action ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
      {securityOpen ? (
        <AccountSecurityModal
          serverUrl={serverUrl}
          token={token}
          user={user}
          onClose={() => setSecurityOpen(false)}
          onUpdated={onUpdate}
        />
      ) : null}
    </div>
  );
}

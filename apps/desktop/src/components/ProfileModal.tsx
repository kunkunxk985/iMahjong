import { useEffect, useState } from 'react';
import {
  AVATAR_DATA_URL_MAX_LENGTH,
  BIO_MAX,
  DEFAULT_AVATAR,
  isImageAvatar,
  NICKNAME_MAX,
  PRESET_AVATARS,
  PRESET_TITLES,
  sanitizeAvatar,
  type ModeStats,
  type UserProfile,
} from '@pizhou/shared';
import { apiGetMatches, apiUpdateProfile, saveStoredAuth } from '../api/auth';
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
  const [tab, setTab] = useState<'look' | 'stats' | 'security'>('look');
  const [avatar, setAvatar] = useState(sanitizeAvatar(user.avatar, DEFAULT_AVATAR));
  const [nickname, setNickname] = useState(user.nickname || user.username);
  const [title, setTitle] = useState(user.title || '初学雀友');
  const [bio, setBio] = useState(user.bio || '不碰坎不上，单钓不换张！');
  const [copiedId, setCopiedId] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Stats state
  const [stats, setStats] = useState<{ online?: ModeStats; local?: ModeStats; loading: boolean }>({
    loading: true,
  });

  useEffect(() => {
    if (!token) {
      setStats({ loading: false });
      return;
    }
    let active = true;
    Promise.all([
      apiGetMatches(serverUrl, token, 'online').catch(() => null),
      apiGetMatches(serverUrl, token, 'local').catch(() => null),
    ]).then(([onlineRes, localRes]) => {
      if (!active) return;
      setStats({
        online: onlineRes?.stats,
        local: localRes?.stats,
        loading: false,
      });
    });
    return () => {
      active = false;
    };
  }, [serverUrl, token]);

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

  const handleCopyId = () => {
    navigator.clipboard?.writeText(user.userId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
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

    try {
      if (token) {
        const saved = await apiUpdateProfile(serverUrl, token, {
          avatar,
          nickname: cleanNick,
          title,
          bio,
        });
        onUpdate(saved);
        setNotice('雀士名片已同步至云端');
        setTimeout(() => onClose(), 650);
        return;
      }

      saveStoredAuth(token, updatedUser);
      onUpdate(updatedUser);
      setNotice('雀士资料已保存在本机');
      setTimeout(() => onClose(), 650);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : '云端保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // Safe display ID
  const displayCardNo = user.userId.slice(-6).toUpperCase();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal profile-modal luxury-dossier" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        {/* Dossier Header */}
        <div className="dossier-header">
          <div className="dossier-title-wrap">
            <span className="dossier-icon">🪪</span>
            <div>
              <h2 className="dossier-title">邳州雀士 · 身份手账名片</h2>
              <p className="dossier-subtitle">PIZHOU MAHJONG PASSPORT & IDENTITY DOSSIER</p>
            </div>
          </div>
          <button type="button" className="dossier-close-btn" onClick={onClose} title="关闭名片">
            ✕
          </button>
        </div>

        {notice && <div className="profile-toast">{notice}</div>}

        {/* Asymmetric Dual-Pane Body */}
        <div className="dossier-layout">
          {/* Left Pane: 3D Prestige Identity Card */}
          <aside className="dossier-id-card">
            <div className="card-top-seal">
              <span className="seal-origin">江苏 · 邳州</span>
              <span className={`status-stamp ${user.isGuest ? 'guest' : 'verified'}`}>
                {user.isGuest ? '⚡ 游客' : '👑 正式雀士'}
              </span>
            </div>

            <div className="card-avatar-pod">
              <div className="avatar-gold-halo">
                <AvatarView avatar={avatar} alt="雀士形象" />
              </div>
              <span className="dossier-title-badge">{title}</span>
            </div>

            <div className="card-identity-meta">
              <h3 className="card-nickname" title={nickname}>{nickname || user.username}</h3>
              <div className="card-no-row">
                <span className="card-no-label">雀士卡号</span>
                <span className="card-no-code">#{displayCardNo}</span>
                <button
                  type="button"
                  className="card-copy-btn"
                  onClick={handleCopyId}
                  title="点击复制完整 ID"
                >
                  {copiedId ? '✓ 已复制' : '复制'}
                </button>
              </div>
            </div>

            <blockquote className="card-quote">
              “{bio || '不碰坎不上，单钓不换张！'}”
            </blockquote>

            {/* Quick Stat Ribbon */}
            <div className="card-stat-ribbon">
              <div className="ribbon-item">
                <span className="ribbon-label">联机场次</span>
                <strong className="ribbon-value">{stats.online?.totalMatches ?? 0}</strong>
              </div>
              <div className="ribbon-item">
                <span className="ribbon-label">胜率</span>
                <strong className="ribbon-value highlight">
                  {stats.online?.winRate ? `${Math.round(stats.online.winRate)}%` : '0%'}
                </strong>
              </div>
              <div className="ribbon-item">
                <span className="ribbon-label">最高胡数</span>
                <strong className="ribbon-value">{stats.online?.maxHu ?? 0}胡</strong>
              </div>
            </div>
          </aside>

          {/* Right Pane: Multi-Tab Operation Deck */}
          <section className="dossier-deck">
            <nav className="dossier-deck-tabs">
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'look' ? 'active' : ''}`}
                onClick={() => setTab('look')}
              >
                🎨 形象与个性
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'stats' ? 'active' : ''}`}
                onClick={() => setTab('stats')}
              >
                📊 生涯战绩
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'security' ? 'active' : ''}`}
                onClick={() => setTab('security')}
              >
                🔐 账号安全
              </button>
            </nav>

            <div className="deck-scroll-content">
              {/* Tab 1: Appearance & Personality */}
              {tab === 'look' && (
                <div className="deck-pane look-pane">
                  {/* Avatar Picker */}
                  <div className="form-section">
                    <label className="deck-field-label">雀士形象挑选</label>
                    <div className="dossier-avatar-picker">
                      {PRESET_AVATARS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`dossier-avatar-chip ${avatar === emoji ? 'active' : ''}`}
                          onClick={() => setAvatar(emoji)}
                          title={`选用 ${emoji} 头像`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <label
                        className={`dossier-avatar-upload ${isImageAvatar(avatar) ? 'active' : ''} ${uploadingAvatar ? 'is-loading' : ''}`}
                        title="上传本地自定义头像"
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleAvatarFile}
                          disabled={uploadingAvatar}
                        />
                        <span>{uploadingAvatar ? '…' : '📷'}</span>
                        <small>自定义</small>
                      </label>
                    </div>
                    {avatarError && <p className="avatar-error">{avatarError}</p>}
                  </div>

                  {/* Nickname Input */}
                  <div className="form-section">
                    <label className="deck-field-label">对外称呼 / 昵称</label>
                    <input
                      type="text"
                      className="input-field dossier-input"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={NICKNAME_MAX}
                      placeholder="输入你在牌桌上展现的昵称"
                    />
                  </div>

                  {/* Title Chips */}
                  <div className="form-section">
                    <label className="deck-field-label">段位头衔勋章</label>
                    <div className="dossier-title-grid">
                      {PRESET_TITLES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`dossier-title-chip ${title === t ? 'active' : ''}`}
                          onClick={() => setTitle(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Personal Bio */}
                  <div className="form-section">
                    <label className="deck-field-label">雀士牌桌宣言</label>
                    <textarea
                      className="input-field dossier-input dossier-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={BIO_MAX}
                      rows={2}
                      placeholder="写下一句专属你的出牌座右铭"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Career Stats (Isolated Online vs Local) */}
              {tab === 'stats' && (
                <div className="deck-pane stats-pane">
                  {/* Online Stats Card */}
                  <div className="dossier-stat-group online-group">
                    <div className="stat-group-header">
                      <span className="stat-group-title">🌐 4人联机实战记录</span>
                      <span className="stat-group-badge">真实胡账</span>
                    </div>
                    <div className="stat-metrics-grid">
                      <div className="stat-metric-box">
                        <span className="metric-num">{stats.online?.totalMatches ?? 0}</span>
                        <span className="metric-desc">对局场次</span>
                      </div>
                      <div className="stat-metric-box">
                        <span className="metric-num highlight">
                          {stats.online?.winRate ? `${Math.round(stats.online.winRate)}%` : '0%'}
                        </span>
                        <span className="metric-desc">综合胜率</span>
                      </div>
                      <div className="stat-metric-box">
                        <span className={`metric-num ${(stats.online?.totalScore ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                          {(stats.online?.totalScore ?? 0) > 0 ? `+${stats.online?.totalScore}` : stats.online?.totalScore ?? 0}
                        </span>
                        <span className="metric-desc">累计净差分</span>
                      </div>
                      <div className="stat-metric-box">
                        <span className="metric-num">{stats.online?.maxHu ?? 0}</span>
                        <span className="metric-desc">单局最高胡</span>
                      </div>
                    </div>
                  </div>

                  {/* Solo Practice Stats Card */}
                  <div className="dossier-stat-group local-group">
                    <div className="stat-group-header">
                      <span className="stat-group-title">🤖 单机人机演练</span>
                      <span className="stat-group-badge gray">练习模式</span>
                    </div>
                    <div className="stat-metrics-grid">
                      <div className="stat-metric-box">
                        <span className="metric-num">{stats.local?.totalMatches ?? 0}</span>
                        <span className="metric-desc">练习盘数</span>
                      </div>
                      <div className="stat-metric-box">
                        <span className="metric-num">
                          {stats.local?.winRate ? `${Math.round(stats.local.winRate)}%` : '0%'}
                        </span>
                        <span className="metric-desc">人机胜率</span>
                      </div>
                      <div className="stat-metric-box">
                        <span className="metric-num">{stats.local?.maxHu ?? 0}</span>
                        <span className="metric-desc">练习最高胡</span>
                      </div>
                      <div className="stat-metric-box">
                        <span className="metric-num">100%</span>
                        <span className="metric-desc">规则熟悉度</span>
                      </div>
                    </div>
                  </div>

                  <p className="dossier-stats-disclaimer">
                    ℹ️ 联机战绩与人机演练严格物理隔离，练习盘数绝不混入真实联机胜率。
                  </p>
                </div>
              )}

              {/* Tab 3: Security & Lifecycle */}
              {tab === 'security' && (
                <div className="deck-pane security-pane">
                  {user.isGuest ? (
                    <div className="dossier-guest-banner">
                      <div className="guest-banner-icon">⚡</div>
                      <div className="guest-banner-text">
                        <h4>当前为免密游客账号</h4>
                        <p>换设备或清理缓存后数据可能会丢失，建议立即升级为正式账号永久绑定战绩。</p>
                      </div>
                      <button
                        type="button"
                        className="btn-action primary sm"
                        onClick={() => setSecurityOpen(true)}
                      >
                        一键升级转正
                      </button>
                    </div>
                  ) : null}

                  <div className="dossier-security-list">
                    <div className="security-row">
                      <div className="security-meta">
                        <span className="sec-label">登录账号</span>
                        <strong className="sec-val">{user.username}</strong>
                      </div>
                      <span className="sec-status-tag ok">正常使用中</span>
                    </div>

                    <div className="security-row">
                      <div className="security-meta">
                        <span className="sec-label">账号认证级别</span>
                        <strong className="sec-val">{user.isGuest ? '游客模式' : '云端正式雀士'}</strong>
                      </div>
                      {!user.isGuest ? (
                        <button
                          type="button"
                          className="btn-action ghost sm"
                          onClick={() => setSecurityOpen(true)}
                        >
                          修改密码
                        </button>
                      ) : null}
                    </div>

                    <div className="security-row">
                      <div className="security-meta">
                        <span className="sec-label">多设备漫游凭据</span>
                        <small className="sec-sub">支持换电脑输入卡号与密码无缝同步</small>
                      </div>
                      <button
                        type="button"
                        className="btn-action ghost sm"
                        onClick={onOpenAuth}
                      >
                        切换账号
                      </button>
                    </div>

                    <div className="security-row logout-row">
                      <div className="security-meta">
                        <span className="sec-label">退出登录</span>
                        <small className="sec-sub">清除本机当前会话凭证，返回登录页面</small>
                      </div>
                      <button
                        type="button"
                        className="btn-action ghost sm danger"
                        onClick={onLogout}
                      >
                        退出当前登录
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="dossier-footer">
          <button
            type="button"
            className="btn-action primary dossier-save-btn"
            disabled={saving || uploadingAvatar || Boolean(avatarError)}
            onClick={handleSave}
          >
            {saving ? '正在同步云端...' : '✨ 保存名片并同步云端'}
          </button>
          <button type="button" className="btn-action ghost dossier-cancel-btn" onClick={onClose}>
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

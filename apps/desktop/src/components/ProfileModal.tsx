import React, { useEffect, useState } from 'react';
import {
  AVATAR_DATA_URL_MAX_LENGTH,
  BIO_MAX,
  isImageAvatar,
  NICKNAME_MAX,
  PRESET_AVATARS,
  PRESET_TITLES,
  GUOFENG_AVATAR_PRESETS,
  ACHIEVEMENT_CATEGORIES,
  evaluateAchievements,
  calculateCareerStats,
  type UserProfile,
  type MatchRecord,
  type EnrichedMatchRecord,
  type AchievementCategory,
  type LeaderboardEntry,
} from '@pizhou/shared';
import { apiGetLeaderboard, apiGetMatches, apiUpdateProfile, saveStoredAuth } from '../api/auth';
import { getMatchHistory } from '../storage/history';
import { AccountSecurityModal } from './AccountSecurityModal';
import { AvatarView } from './AvatarView';
import { GuofengAvatar } from './GuofengAvatar';

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
  serverUrl?: string;
  token?: string | null;
  user?: UserProfile | null;
  initialTab?: 'look' | 'stats' | 'leaderboard' | 'achievements' | 'security';
  onClose: () => void;
  onUpdate?: (user: UserProfile, token?: string) => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

const MOTTO_PRESETS = [
  '不碰坎不上，单钓不换张！',
  '运河起巨浪，飘荤定乾坤！',
  '两对关门，断人退路！',
  '起手四张，杠上开花！',
  '算无遗策，落子生风！',
];

export function ProfileModal({
  serverUrl = '',
  token = null,
  user,
  initialTab = 'look',
  onClose,
  onUpdate = () => {},
  onOpenAuth = () => {},
  onLogout = () => {},
}: ProfileModalProps) {
  // Guest Resilience: always guarantee a valid user profile even if unauthenticated
  const effectiveUser: UserProfile = user ?? {
    userId: 'guest_local_' + Math.random().toString(36).slice(2, 8),
    username: 'guest',
    nickname: '邳州雀客',
    avatar: 'guofeng_yushi',
    title: '初学雀友',
    bio: '不碰坎不上，单钓不换张！',
    isGuest: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 5 Tabs: look (形象与个性), stats (生涯战绩), leaderboard (雀友风云榜), achievements (成就阶梯), security (账号安全)
  const [tab, setTab] = useState<'look' | 'stats' | 'leaderboard' | 'achievements' | 'security'>(initialTab);
  const [statsMode, setStatsMode] = useState<'online' | 'local'>('online');
  const [achievementFilter, setAchievementFilter] = useState<'all' | AchievementCategory>('all');
  const [avatarTab, setAvatarTab] = useState<'guofeng' | 'custom'>('guofeng');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<'score' | 'winRate' | 'matches' | 'maxWin'>('score');

  // Editing state
  const [avatar, setAvatar] = useState(effectiveUser.avatar || 'guofeng_yushi');
  const [nickname, setNickname] = useState(effectiveUser.nickname || effectiveUser.username || '雀友');
  const [title, setTitle] = useState(effectiveUser.title || '初学雀友');
  const [bio, setBio] = useState(effectiveUser.bio || '不碰坎不上，单钓不换张！');
  const [copiedId, setCopiedId] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Match History state (Online, Local, Combined)
  const [matchHistory, setMatchHistory] = useState<{
    online: MatchRecord[];
    local: MatchRecord[];
    loading: boolean;
  }>({
    online: [],
    local: [],
    loading: true,
  });

  // Load matches from API and Local Storage fallback
  useEffect(() => {
    let active = true;
    const localStoredOnline = getMatchHistory('online', effectiveUser.userId);
    const localStoredLocal = getMatchHistory('local', effectiveUser.userId);

    if (!token || !serverUrl) {
      setMatchHistory({
        online: localStoredOnline,
        local: localStoredLocal,
        loading: false,
      });
      return;
    }

    Promise.all([
      apiGetMatches(serverUrl, token, 'online').catch(() => null),
      apiGetMatches(serverUrl, token, 'local').catch(() => null),
    ]).then(([onlineRes, localRes]) => {
      if (!active) return;
      const onlineMatches = (onlineRes?.matches?.length ? onlineRes.matches : localStoredOnline) as MatchRecord[];
      const localMatches = (localRes?.matches?.length ? localRes.matches : localStoredLocal) as MatchRecord[];
      setMatchHistory({
        online: onlineMatches,
        local: localMatches,
        loading: false,
      });
    });

    return () => {
      active = false;
    };
  }, [serverUrl, token, effectiveUser.userId]);

  // Derived Career Stats
  const onlineStats = calculateCareerStats(matchHistory.online as EnrichedMatchRecord[]);
  const localStats = calculateCareerStats(matchHistory.local as EnrichedMatchRecord[]);
  const activeStats = statsMode === 'online' ? onlineStats : localStats;
  const combinedMatches = [...matchHistory.online, ...matchHistory.local];

  // Fetch leaderboard of all existing players on this server
  useEffect(() => {
    let active = true;
    if (!serverUrl) return;
    apiGetLeaderboard(serverUrl)
      .then((list) => {
        if (!active) return;
        if (list && list.length > 0) {
          setLeaderboard(list);
        } else {
          setLeaderboard([
            {
              rank: 1,
              userId: effectiveUser.userId,
              username: effectiveUser.username,
              nickname: effectiveUser.nickname || nickname,
              avatar: effectiveUser.avatar || avatar,
              title: effectiveUser.title || title,
              bio: effectiveUser.bio || bio,
              isGuest: effectiveUser.isGuest,
              totalMatches: onlineStats.totalMatches + localStats.totalMatches,
              wins: onlineStats.wins + localStats.wins,
              losses: onlineStats.losses + localStats.losses,
              winRate: onlineStats.totalMatches > 0 ? onlineStats.winRate : (localStats.winRate || 0),
              totalScore: onlineStats.totalScore + localStats.totalScore,
              maxWinScore: Math.max(onlineStats.maxWinScore || 0, localStats.maxWinScore || 0),
              maxHu: Math.max(onlineStats.maxHu || 0, localStats.maxHu || 0),
            },
          ]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [serverUrl, effectiveUser.userId, onlineStats.totalMatches, localStats.totalMatches]);

  const sortedLeaderboard = React.useMemo(() => {
    const list = [...leaderboard];
    if (leaderboardSort === 'score') {
      list.sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins);
    } else if (leaderboardSort === 'winRate') {
      list.sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches);
    } else if (leaderboardSort === 'matches') {
      list.sort((a, b) => b.totalMatches - a.totalMatches || b.wins - a.wins);
    } else if (leaderboardSort === 'maxWin') {
      list.sort((a, b) => b.maxWinScore - a.maxWinScore || b.totalScore - a.totalScore);
    }
    return list;
  }, [leaderboard, leaderboardSort]);

  const myRank = React.useMemo(() => {
    const idx = sortedLeaderboard.findIndex((e) => e.userId === effectiveUser.userId);
    return idx >= 0 ? idx + 1 : 1;
  }, [sortedLeaderboard, effectiveUser.userId]);

  const myTotalScore = onlineStats.totalScore + localStats.totalScore;

  // Derived Achievements
  const achievements = evaluateAchievements(combinedMatches as EnrichedMatchRecord[], {
    avatar,
    bio,
    nickname,
  });
  const unlockedAchievementsCount = achievements.filter((a) => a.unlocked).length;

  // Filtered Achievements
  const filteredAchievements = achievementFilter === 'all'
    ? achievements
    : achievements.filter((a) => a.achievement.category === achievementFilter);

  // Collect unlocked reward titles to let players equip them
  const unlockedTitles = Array.from(
    new Set([
      ...PRESET_TITLES,
      ...achievements.filter((a) => a.unlocked).map((a) => a.achievement.rewardTitle),
    ]),
  );

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
    navigator.clipboard?.writeText(effectiveUser.userId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    });
  };

  const handleSave = async () => {
    const cleanNick = nickname.trim() || effectiveUser.username || '雀友';
    setSaving(true);
    setNotice(null);

    const updatedUser: UserProfile = {
      ...effectiveUser,
      avatar,
      nickname: cleanNick,
      title,
      bio,
      updatedAt: Date.now(),
    };

    try {
      if (token && serverUrl) {
        const saved = await apiUpdateProfile(serverUrl, token, {
          avatar,
          nickname: cleanNick,
          title,
          bio,
        });
        onUpdate(saved, token);
        setNotice('雀士名片已同步至云端');
        setTimeout(() => onClose(), 600);
        return;
      }

      saveStoredAuth(token, updatedUser);
      onUpdate(updatedUser);
      setNotice('雀士资料已保存在本机');
      setTimeout(() => onClose(), 600);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // Safe display ID
  const displayCardNo = effectiveUser.userId.slice(-6).toUpperCase();

  // Circular gauge calculations
  const winRate = activeStats.winRate || 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, winRate)) / 100) * circumference;

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
              <span className={`status-stamp ${effectiveUser.isGuest ? 'guest' : 'verified'}`}>
                {effectiveUser.isGuest ? '⚡ 游客' : '👑 正式雀士'}
              </span>
            </div>

            <div className="card-avatar-pod">
              <div className="avatar-gold-halo">
                <AvatarView avatar={avatar} alt="雀士形象" size={72} />
              </div>
              <span className="dossier-title-badge" title={`段位称号：${title}`}>
                {title}
              </span>
            </div>

            <div className="card-identity-meta">
              <h3 className="card-nickname" title={nickname}>
                {nickname || effectiveUser.username}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '4px 0 8px' }}>
                <span style={{ fontSize: '11px', color: '#fef08a', fontWeight: 'bold', background: 'rgba(202, 138, 4, 0.25)', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '2px 8px', borderRadius: '10px' }}>
                  🏆 雀庄第 {myRank} 位
                </span>
                <span style={{ fontSize: '11px', color: myTotalScore >= 0 ? '#4ade80' : '#f87171', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                  净胜 {myTotalScore > 0 ? `+${myTotalScore}` : myTotalScore} 分
                </span>
              </div>
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
                <strong className="ribbon-value">{matchHistory.online.length}</strong>
              </div>
              <div className="ribbon-item">
                <span className="ribbon-label">综合胜率</span>
                <strong className="ribbon-value highlight">
                  {onlineStats.winRate ? `${Math.round(onlineStats.winRate)}%` : '0%'}
                </strong>
              </div>
              <div className="ribbon-item">
                <span className="ribbon-label">成就达成</span>
                <strong className="ribbon-value" style={{ color: '#38bdf8' }}>
                  {unlockedAchievementsCount}/15
                </strong>
              </div>
            </div>
          </aside>

          {/* Right Pane: 5-Tab Operation Deck */}
          <section className="dossier-deck">
            <nav className="dossier-deck-tabs">
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'look' ? 'active' : ''}`}
                onClick={() => setTab('look')}
              >
                🎨 形象
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'stats' ? 'active' : ''}`}
                onClick={() => setTab('stats')}
              >
                📊 战绩
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setTab('leaderboard')}
              >
                🏆 雀友榜
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'achievements' ? 'active' : ''}`}
                onClick={() => setTab('achievements')}
              >
                🎖️ 成就
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'security' ? 'active' : ''}`}
                onClick={() => setTab('security')}
              >
                🔐 账号
              </button>
            </nav>

            <div className="deck-scroll-content">
              {/* TAB 1: 形象与个性 */}
              {tab === 'look' && (
                <div className="deck-pane look-pane">
                  {/* Avatar Picker Header & Mode Toggle */}
                  <div className="form-section">
                    <div className="section-head-row">
                      <label className="deck-field-label" style={{ margin: 0 }}>雀士专属形象</label>
                      <div className="sub-pill-toggle">
                        <button
                          type="button"
                          className={avatarTab === 'guofeng' ? 'active' : ''}
                          onClick={() => setAvatarTab('guofeng')}
                        >
                          🎋 12款国风
                        </button>
                        <button
                          type="button"
                          className={avatarTab === 'custom' ? 'active' : ''}
                          onClick={() => setAvatarTab('custom')}
                        >
                          📷 本地上传
                        </button>
                      </div>
                    </div>

                    {avatarTab === 'guofeng' ? (
                      /* 12 Curated Guofeng Avatars Grid: 6 columns x 2 rows, NO SCROLLBAR */
                      <div className="guofeng-avatar-matrix">
                        {GUOFENG_AVATAR_PRESETS.map((preset) => {
                          const isSelected = avatar === preset.id;
                          return (
                            <div
                              key={preset.id}
                              className={`guofeng-card ${isSelected ? 'active' : ''}`}
                              onClick={() => setAvatar(preset.id)}
                              title={`${preset.name} · ${preset.desc}`}
                            >
                              <div className="guofeng-avatar-wrap">
                                <GuofengAvatar id={preset.id} size={42} />
                                {isSelected && <span className="guofeng-check">✓</span>}
                              </div>
                              <span className="guofeng-title">{preset.name.slice(0, 2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Custom Upload & Legacy Emoji Picker */
                      <div style={{ padding: '8px 0' }}>
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
                            <small>上传</small>
                          </label>
                        </div>
                        {avatarError && <p className="avatar-error" style={{ color: '#ef4444', fontSize: '11px', marginTop: '6px' }}>{avatarError}</p>}
                      </div>
                    )}
                  </div>

                  {/* 2-Column Row: Nickname & Title */}
                  <div className="dossier-two-col">
                    <div className="form-section">
                      <div className="field-label-row">
                        <label className="deck-field-label">牌桌昵称</label>
                        <span className="field-count">{nickname.length}/{NICKNAME_MAX}</span>
                      </div>
                      <input
                        type="text"
                        className="input-field dossier-input"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={NICKNAME_MAX}
                        placeholder="输入你的牌桌昵称"
                      />
                    </div>

                    <div className="form-section">
                      <div className="field-label-row">
                        <label className="deck-field-label">佩戴称号</label>
                        <span className="field-count" style={{ color: '#fef08a' }}>{title}</span>
                      </div>
                      <div className="dossier-title-scroll-row">
                        {unlockedTitles.map((t) => (
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
                  </div>

                  {/* Personal Bio / Motto */}
                  <div className="form-section">
                    <div className="field-label-row">
                      <label className="deck-field-label">牌桌座右铭</label>
                      <span className="field-count">{bio.length}/{BIO_MAX}</span>
                    </div>
                    <textarea
                      className="input-field dossier-input dossier-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={BIO_MAX}
                      rows={2}
                      placeholder="写下一句专属你的出牌座右铭"
                    />
                    <div className="motto-quick-row">
                      <span className="motto-hint">快捷座右铭：</span>
                      {MOTTO_PRESETS.slice(0, 3).map((motto) => (
                        <button
                          key={motto}
                          type="button"
                          className="motto-pill"
                          onClick={() => setBio(motto)}
                        >
                          {motto}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 生涯战绩 */}
              {tab === 'stats' && (
                <div className="deck-pane stats-pane">
                  {/* Mode Selector Pill */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '20px', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
                      <button
                        type="button"
                        onClick={() => setStatsMode('online')}
                        style={{
                          padding: '4px 18px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: statsMode === 'online' ? 'bold' : 'normal',
                          background: statsMode === 'online' ? 'linear-gradient(180deg, #ca8a04 0%, #854d0e 100%)' : 'transparent',
                          color: statsMode === 'online' ? '#fff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        🌐 4人联机实战
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatsMode('local')}
                        style={{
                          padding: '4px 18px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: statsMode === 'local' ? 'bold' : 'normal',
                          background: statsMode === 'local' ? 'linear-gradient(180deg, #059669 0%, #064e3b 100%)' : 'transparent',
                          color: statsMode === 'local' ? '#fff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        🤖 单机人机演练
                      </button>
                    </div>
                  </div>

                  {/* Highlights Row with Circular Win-Rate Gauge */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 1fr',
                      gap: '14px',
                      background: 'rgba(8, 28, 20, 0.75)',
                      border: '1px solid rgba(250, 204, 21, 0.3)',
                      borderRadius: '12px',
                      padding: '12px',
                      marginBottom: '14px',
                      alignItems: 'center',
                    }}
                  >
                    {/* SVG Circular Win Rate Gauge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '84px', height: '84px' }}>
                        <svg viewBox="0 0 100 100" width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth="8"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke="#facc15"
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                          />
                        </svg>
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#fef08a' }}>
                            {Math.round(winRate)}%
                          </span>
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>胜率</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '4px' }}>
                        {activeStats.wins}胜 {activeStats.losses}负 {activeStats.draws}平
                      </span>
                    </div>

                    {/* Quick Metric Tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div className="stat-metric-box" style={{ padding: '6px' }}>
                        <span className="metric-num">{activeStats.totalMatches}</span>
                        <span className="metric-desc">总对局数</span>
                      </div>
                      <div className="stat-metric-box" style={{ padding: '6px' }}>
                        <span className={`metric-num ${activeStats.totalScore >= 0 ? 'pos' : 'neg'}`}>
                          {activeStats.totalScore > 0 ? `+${activeStats.totalScore}` : activeStats.totalScore}
                        </span>
                        <span className="metric-desc">累计净差分</span>
                      </div>
                      <div className="stat-metric-box" style={{ padding: '6px' }}>
                        <span className="metric-num highlight">{activeStats.maxHu}</span>
                        <span className="metric-desc">单局最高胡</span>
                      </div>
                      <div className="stat-metric-box" style={{ padding: '6px' }}>
                        <span className="metric-num" style={{ color: '#38bdf8' }}>+{activeStats.maxWinScore}</span>
                        <span className="metric-desc">最高单局赢分</span>
                      </div>
                      <div className="stat-metric-box" style={{ padding: '6px' }}>
                        <span className="metric-num" style={{ color: '#f43f5e' }}>{activeStats.winStreakMax}</span>
                        <span className="metric-desc">历史最高连胜</span>
                      </div>
                      <div className="stat-metric-box" style={{ padding: '6px' }}>
                        <span className="metric-num" style={{ color: '#a78bfa' }}>{activeStats.piaoHunCount}</span>
                        <span className="metric-desc">飘荤盘数</span>
                      </div>
                    </div>
                  </div>

                  {/* Fan Type Distribution Breakdown */}
                  <div
                    style={{
                      background: 'rgba(6, 22, 16, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fef08a' }}>
                        🀄 各番型结算频次分布 (Fan Type Breakdown)
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        共计 {activeStats.wins} 次胜局结算
                      </span>
                    </div>

                    {[
                      { label: '点炮平胡', count: activeStats.fanDistribution.pingHu, color: '#94a3b8', desc: '基础点炮胡牌' },
                      { label: '自摸大捷', count: activeStats.fanDistribution.ziMo, color: '#38bdf8', desc: '亲手摸取关键张' },
                      { label: '起手暗杠', count: activeStats.fanDistribution.qiShouGangHu, color: '#f59e0b', desc: '开局四张杠牌即胡' },
                      { label: '荤底飘荤', count: activeStats.fanDistribution.piaoHun, color: '#ef4444', desc: '纯清/四组单钓高番' },
                      { label: '两对关门', count: activeStats.fanDistribution.guanMen, color: '#10b981', desc: '锁听绝张封关克敌' },
                      { label: '包庄决胜', count: activeStats.fanDistribution.baoZhuang, color: '#ec4899', desc: '促成对手包香包庄' },
                      { label: '流局荒牌', count: activeStats.fanDistribution.liuJu, color: '#64748b', desc: '牌墙摸尽平局收场' },
                    ].map((fan) => {
                      const totalBasis = Math.max(1, activeStats.totalMatches);
                      const percent = Math.round((fan.count / totalBasis) * 100);
                      return (
                        <div key={fan.label} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                            <span style={{ color: '#e2e8f0' }}>{fan.label} <small style={{ color: '#64748b' }}>({fan.desc})</small></span>
                            <span style={{ color: fan.color, fontWeight: 'bold' }}>{fan.count} 局 ({percent}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, percent)}%`,
                                height: '100%',
                                background: fan.color,
                                borderRadius: '3px',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: 雀友风云榜 */}
              {tab === 'leaderboard' && (
                <div className="deck-pane leaderboard-pane">
                  {/* Metric Filter Bar */}
                  <div className="leaderboard-filter-bar">
                    <button
                      type="button"
                      className={`filter-pill ${leaderboardSort === 'score' ? 'active' : ''}`}
                      onClick={() => setLeaderboardSort('score')}
                    >
                      🪙 净胜积分
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${leaderboardSort === 'winRate' ? 'active' : ''}`}
                      onClick={() => setLeaderboardSort('winRate')}
                    >
                      🎯 胜率榜
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${leaderboardSort === 'matches' ? 'active' : ''}`}
                      onClick={() => setLeaderboardSort('matches')}
                    >
                      🀄 活跃榜
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${leaderboardSort === 'maxWin' ? 'active' : ''}`}
                      onClick={() => setLeaderboardSort('maxWin')}
                    >
                      ⚡ 大赢家
                    </button>
                  </div>

                  {/* Leaderboard List */}
                  <div className="leaderboard-list">
                    {sortedLeaderboard.length === 0 ? (
                      <div className="leaderboard-empty">
                        <span style={{ fontSize: '32px' }}>🀄</span>
                        <span>暂无更多雀友战绩数据，多打几局来上榜吧！</span>
                      </div>
                    ) : (
                      sortedLeaderboard.map((entry, index) => {
                        const isMe = entry.userId === effectiveUser.userId;
                        return (
                          <div
                            key={entry.userId}
                            className={`leaderboard-item ${isMe ? 'is-me' : ''}`}
                          >
                            <div className="rank-badge-wrap">
                              {index === 0 ? (
                                <span className="medal-icon">🥇</span>
                              ) : index === 1 ? (
                                <span className="medal-icon">🥈</span>
                              ) : index === 2 ? (
                                <span className="medal-icon">🥉</span>
                              ) : (
                                <span className="rank-num">#{index + 1}</span>
                              )}
                            </div>

                            <div className="player-avatar-cell">
                              <AvatarView avatar={entry.avatar} alt={entry.nickname} size={38} />
                            </div>

                            <div className="player-meta-cell">
                              <div className="player-name-row">
                                <span className="player-nick">{entry.nickname || entry.username}</span>
                                {isMe && <span className="me-tag">我</span>}
                                {entry.title && <span className="player-title-tag">{entry.title}</span>}
                              </div>
                              <span className="player-bio-text">
                                {entry.bio || '不碰坎不上，单钓不换张！'}
                              </span>
                            </div>

                            <div className="player-stats-cell">
                              {leaderboardSort === 'score' && (
                                <>
                                  <span
                                    className={`primary-stat ${
                                      entry.totalScore >= 0 ? 'pos-score' : 'neg-score'
                                    }`}
                                  >
                                    {entry.totalScore > 0 ? `+${entry.totalScore}` : entry.totalScore} 分
                                  </span>
                                  <span className="sub-stat">
                                    {entry.wins}胜 / {entry.totalMatches}局 ({Math.round(entry.winRate)}%)
                                  </span>
                                </>
                              )}
                              {leaderboardSort === 'winRate' && (
                                <>
                                  <span className="primary-stat highlight-stat">
                                    {Math.round(entry.winRate)}% 胜率
                                  </span>
                                  <span className="sub-stat">
                                    {entry.wins}胜 / 共{entry.totalMatches}局
                                  </span>
                                </>
                              )}
                              {leaderboardSort === 'matches' && (
                                <>
                                  <span className="primary-stat highlight-stat">
                                    {entry.totalMatches} 局
                                  </span>
                                  <span className="sub-stat">
                                    {entry.wins}胜 {entry.losses}负 (净胜 {entry.totalScore})
                                  </span>
                                </>
                              )}
                              {leaderboardSort === 'maxWin' && (
                                <>
                                  <span className="primary-stat pos-score">
                                    +{entry.maxWinScore} 单局最高
                                  </span>
                                  <span className="sub-stat">
                                    总净胜 {entry.totalScore} 分 / 最大番 {entry.maxHu || 0}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: 成就阶梯 */}
              {tab === 'achievements' && (
                <div className="deck-pane achievements-pane">
                  {/* Achievement Filter Tabs */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setAchievementFilter('all')}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: achievementFilter === 'all' ? '#ca8a04' : 'rgba(255,255,255,0.06)',
                          color: achievementFilter === 'all' ? '#fff' : '#94a3b8',
                        }}
                      >
                        全部 ({achievements.length})
                      </button>
                      {(Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[]).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setAchievementFilter(cat)}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            background: achievementFilter === cat ? '#ca8a04' : 'rgba(255,255,255,0.06)',
                            color: achievementFilter === cat ? '#fff' : '#94a3b8',
                          }}
                        >
                          {ACHIEVEMENT_CATEGORIES[cat].icon} {ACHIEVEMENT_CATEGORIES[cat].name}
                        </button>
                      ))}
                    </div>

                    <span style={{ fontSize: '11px', color: '#fef08a', fontWeight: 'bold' }}>
                      已达成 {unlockedAchievementsCount} / {achievements.length}
                    </span>
                  </div>

                  {/* Achievement Cards Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {filteredAchievements.map((item) => {
                      const isUnlocked = item.unlocked;
                      const isTitleEquipped = title === item.achievement.rewardTitle;
                      return (
                        <div
                          key={item.achievement.id}
                          style={{
                            background: isUnlocked
                              ? 'linear-gradient(90deg, rgba(202, 138, 4, 0.15) 0%, rgba(6, 28, 20, 0.8) 100%)'
                              : 'rgba(255, 255, 255, 0.03)',
                            border: isUnlocked
                              ? '1px solid rgba(250, 204, 21, 0.4)'
                              : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            display: 'grid',
                            gridTemplateColumns: '36px 1fr auto',
                            gap: '12px',
                            alignItems: 'center',
                          }}
                        >
                          {/* Icon */}
                          <span style={{ fontSize: '24px', textAlign: 'center' }}>{item.achievement.icon}</span>

                          {/* Info & Progress */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <strong style={{ fontSize: '13px', color: isUnlocked ? '#fef08a' : '#cbd5e1' }}>
                                {item.achievement.name}
                              </strong>
                              <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                                称号：{item.achievement.rewardTitle}
                              </span>
                            </div>
                            <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#94a3b8' }}>
                              {item.achievement.desc}
                            </p>
                            {/* Progress bar */}
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${item.progressPercent}%`,
                                  height: '100%',
                                  background: isUnlocked ? '#22c55e' : '#eab308',
                                }}
                              />
                            </div>
                          </div>

                          {/* Action / Status */}
                          <div style={{ textAlign: 'right' }}>
                            {isUnlocked ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 'bold' }}>
                                  ✓ 已达成
                                </span>
                                {isTitleEquipped ? (
                                  <span style={{ fontSize: '10px', color: '#fbbf24' }}>已佩戴称号</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTitle(item.achievement.rewardTitle);
                                      setNotice(`已佩戴称号【${item.achievement.rewardTitle}】`);
                                      setTimeout(() => setNotice(null), 1500);
                                    }}
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 8px',
                                      background: 'rgba(250, 204, 21, 0.2)',
                                      border: '1px solid #fbbf24',
                                      color: '#fef08a',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    佩戴称号
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {item.currentCount} / {item.targetCount}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: 账号安全 */}
              {tab === 'security' && (
                <div className="deck-pane security-pane">
                  {effectiveUser.isGuest ? (
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
                        <strong className="sec-val">{effectiveUser.username}</strong>
                      </div>
                      <span className="sec-status-tag ok">正常使用中</span>
                    </div>

                    <div className="security-row">
                      <div className="security-meta">
                        <span className="sec-label">账号认证级别</span>
                        <strong className="sec-val">{effectiveUser.isGuest ? '游客模式' : '云端正式雀士'}</strong>
                      </div>
                      {!effectiveUser.isGuest ? (
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
          user={effectiveUser}
          onClose={() => setSecurityOpen(false)}
          onUpdated={onUpdate}
        />
      ) : null}
    </div>
  );
}

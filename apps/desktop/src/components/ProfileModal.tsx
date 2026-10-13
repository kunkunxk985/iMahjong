import React, { useEffect, useState } from 'react';
import {
  PRESET_TITLES,
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
import { ProfileLookTab } from './profile/ProfileLookTab';
import { ProfileStatsTab } from './profile/ProfileStatsTab';
import { ProfileLeaderboardTab } from './profile/ProfileLeaderboardTab';
import { ProfileAchievementsTab } from './profile/ProfileAchievementsTab';
import { ProfileSecurityTab } from './profile/ProfileSecurityTab';
import { encodeAvatarFile } from './profile/avatarImage';
import { sortLeaderboard } from './profile/profileModel';

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

  const sortedLeaderboard = React.useMemo(() => sortLeaderboard(leaderboard, leaderboardSort), [leaderboard, leaderboardSort]);

  // Derived Achievements
  const achievements = evaluateAchievements(combinedMatches as EnrichedMatchRecord[], {
    avatar,
    bio,
    nickname,
  });

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

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal profile-modal luxury-dossier" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        {/* Dossier Header */}
        <div className="dossier-header">
          <div className="dossier-title-wrap">

            <div>
              <h2 className="dossier-title">个人资料</h2>

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
              <div className="card-no-row">
                <span className="card-no-label">ID</span>
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

            {bio && <blockquote className="card-quote">{bio}</blockquote>}

          </aside>

          {/* Right Pane: 5-Tab Operation Deck */}
          <section className="dossier-deck">
            <nav className="dossier-deck-tabs">
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'look' ? 'active' : ''}`}
                onClick={() => setTab('look')}
              >
                资料
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'stats' ? 'active' : ''}`}
                onClick={() => setTab('stats')}
              >
                战绩
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setTab('leaderboard')}
              >
                雀友榜
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'achievements' ? 'active' : ''}`}
                onClick={() => setTab('achievements')}
              >
                成就
              </button>
              <button
                type="button"
                className={`deck-tab-btn ${tab === 'security' ? 'active' : ''}`}
                onClick={() => setTab('security')}
              >
                账号
              </button>
            </nav>

            <div className="deck-scroll-content">
              {/* TAB 1: 形象与个性 */}
              {tab === 'look' && (
                <ProfileLookTab avatar={avatar} nickname={nickname} title={title} bio={bio}
                  avatarTab={avatarTab} uploadingAvatar={uploadingAvatar} avatarError={avatarError}
                  unlockedTitles={unlockedTitles} setAvatar={setAvatar} setNickname={setNickname}
                  setTitle={setTitle} setBio={setBio} setAvatarTab={setAvatarTab} handleAvatarFile={handleAvatarFile} />
              )}

              {/* TAB 2: 生涯战绩 */}
              {tab === 'stats' && (
                <ProfileStatsTab activeStats={activeStats} statsMode={statsMode} setStatsMode={setStatsMode} />
              )}

              {/* TAB 3: 雀友风云榜 */}
              {tab === 'leaderboard' && (
                <ProfileLeaderboardTab sortedLeaderboard={sortedLeaderboard} userId={effectiveUser.userId}
                  leaderboardSort={leaderboardSort} setLeaderboardSort={setLeaderboardSort} />
              )}

              {/* TAB 4: 成就阶梯 */}
              {tab === 'achievements' && (
                <ProfileAchievementsTab achievements={achievements} achievementFilter={achievementFilter}
                  title={title} setAchievementFilter={setAchievementFilter} onEquipTitle={(rewardTitle) => {
                    setTitle(rewardTitle);
                    setNotice(`已称号【${rewardTitle}】`);
                    setTimeout(() => setNotice(null), 1500);
                  }} />
              )}

              {/* TAB 5: 账号安全 */}
              {tab === 'security' && (
                <ProfileSecurityTab effectiveUser={effectiveUser} onOpenSecurity={() => setSecurityOpen(true)}
                  onOpenAuth={onOpenAuth} onLogout={onLogout} />
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
            {saving ? '保存中…' : '保存修改'}
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

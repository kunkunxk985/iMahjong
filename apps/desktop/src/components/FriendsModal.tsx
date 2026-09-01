import { useEffect, useState } from 'react';
import type {
  FriendItem,
  FriendRequestItem,
  MatchRecord,
  ModeStats,
  UserProfile,
  UserSearchResult,
} from '@pizhou/shared';
import {
  apiDeleteFriend,
  apiGetFriendRequests,
  apiGetFriends,
  apiGetFriendStats,
  apiRespondFriendRequest,
  apiSearchUsers,
  apiSendFriendRequest,
} from '../api/auth';

interface FriendsModalProps {
  serverUrl: string;
  token: string | null;
  currentRoomCode?: string | null;
  onClose: () => void;
  onInviteFriend?: (toUserId: string, friendName: string) => void;
}

export function FriendsModal({
  serverUrl,
  token,
  currentRoomCode,
  onClose,
  onInviteFriend,
}: FriendsModalProps) {
  const [tab, setTab] = useState<'list' | 'search'>('list');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Friend stats viewing state
  const [selectedFriendStats, setSelectedFriendStats] = useState<{
    user: UserProfile;
    stats: ModeStats;
    recentMatches: MatchRecord[];
    status: string;
    playingRoomCode?: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadFriendsAndRequests = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [fList, rList] = await Promise.all([
        apiGetFriends(serverUrl, token),
        apiGetFriendRequests(serverUrl, token),
      ]);
      setFriends(fList);
      setRequests(rList);
    } catch (err: any) {
      setError(err.message || '加载好友列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriendsAndRequests();
    const interval = setInterval(loadFriendsAndRequests, 10000);
    return () => clearInterval(interval);
  }, [serverUrl, token]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q || !token) return;
    setSearching(true);
    setError(null);
    try {
      const results = await apiSearchUsers(serverUrl, token, q);
      setSearchResults(results);
      if (results.length === 0) {
        setError('未找到匹配的玩家');
      }
    } catch (err: any) {
      setError(err.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (toUserId: string) => {
    if (!token) return;
    try {
      await apiSendFriendRequest(serverUrl, token, toUserId);
      showToast('好友申请已发送！');
      setSearchResults((prev) =>
        prev.map((u) => (u.userId === toUserId ? { ...u, hasPendingRequest: true } : u)),
      );
    } catch (err: any) {
      setError(err.message || '申请发送失败');
    }
  };

  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    if (!token) return;
    try {
      await apiRespondFriendRequest(serverUrl, token, requestId, accept);
      showToast(accept ? '已添加为好友！' : '已忽略申请');
      loadFriendsAndRequests();
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  };

  const handleDeleteFriend = async (friendId: string, nickname: string) => {
    if (!token) return;
    if (!confirm(`确定要删除好友「${nickname}」吗？`)) return;
    try {
      await apiDeleteFriend(serverUrl, token, friendId);
      showToast('已删除好友');
      loadFriendsAndRequests();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handleViewStats = async (friendId: string) => {
    if (!token) return;
    try {
      const data = await apiGetFriendStats(serverUrl, token, friendId);
      setSelectedFriendStats(data);
    } catch (err: any) {
      setError(err.message || '获取好友战绩失败');
    }
  };

  const onlineFriendsCount = friends.filter((f) => f.status !== 'offline').length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        <div className="friends-modal-header">
          <h2>👥 雀友社交中心</h2>
          <div className="online-summary-badge">
            <span className="net-dot open" />
            <span>{onlineFriendsCount} 人在线</span>
          </div>
        </div>

        {toast && <div className="profile-toast">{toast}</div>}
        {error && <div className="auth-error-banner">{error}</div>}

        {/* Tabs */}
        <div className="friends-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'list' ? 'active' : ''}`}
            onClick={() => {
              setTab('list');
              setError(null);
            }}
          >
            我的好友 ({friends.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'search' ? 'active' : ''}`}
            onClick={() => {
              setTab('search');
              setError(null);
            }}
          >
            添加好友 {requests.length > 0 && <span className="req-count-tag">{requests.length}</span>}
          </button>
        </div>

        <div className="friends-body">
          {tab === 'list' ? (
            /* Friend List Tab */
            <div className="friend-list-view">
              {loading && friends.length === 0 ? (
                <div className="empty-friends-hint">正在加载好友列表…</div>
              ) : friends.length === 0 ? (
                <div className="empty-friends-hint">
                  <span className="empty-icon">🀄</span>
                  <p>暂无好友，去「添加好友」中搜索雀友吧！</p>
                  <button type="button" className="btn-action ghost sm" onClick={() => setTab('search')}>
                    ➕ 去添加好友
                  </button>
                </div>
              ) : (
                <div className="friends-scroll-list">
                  {friends.map((f) => {
                    const isOnline = f.status === 'online';
                    const isPlaying = f.status === 'playing';
                    return (
                      <div key={f.userId} className="friend-card-row">
                        <div className="friend-card-left">
                          <div className="friend-card-avatar-wrap">
                            <div className="friend-card-avatar">{f.avatar || '🀄'}</div>
                            <span
                              className={`friend-status-dot ${isPlaying ? 'playing' : isOnline ? 'online' : 'offline'}`}
                              title={isPlaying ? '对局中' : isOnline ? '大厅空闲' : '离线'}
                            />
                          </div>
                          <div className="friend-card-info">
                            <div className="friend-name-row">
                              <span className="friend-nickname">{f.nickname}</span>
                              <span className="friend-title-badge">{f.title || '初学雀友'}</span>
                            </div>
                            <div className="friend-status-text">
                              {isPlaying ? (
                                <span className="status-playing">🟡 对局中 (房号: {f.playingRoomCode || '已开局'})</span>
                              ) : isOnline ? (
                                <span className="status-online">🟢 大厅空闲</span>
                              ) : (
                                <span className="status-offline">⚪ 离线</span>
                              )}
                              {f.bio && <span className="friend-bio"> · "{f.bio}"</span>}
                            </div>
                          </div>
                        </div>

                        <div className="friend-card-actions">
                          {currentRoomCode && onInviteFriend && (
                            <button
                              type="button"
                              className="btn-action primary sm invite-btn"
                              disabled={!isOnline}
                              title={isOnline ? '发送进房邀请' : '对方不在线或正在游戏中'}
                              onClick={() => onInviteFriend(f.userId, f.nickname)}
                            >
                              ✉️ 邀请
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-action ghost sm stats-btn"
                            onClick={() => handleViewStats(f.userId)}
                          >
                            📊 战绩
                          </button>
                          <button
                            type="button"
                            className="btn-action ghost sm del-btn"
                            title="删除好友"
                            onClick={() => handleDeleteFriend(f.userId, f.nickname)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Search & Requests Tab */
            <div className="friend-search-view">
              {/* Requests Section if any */}
              {requests.length > 0 && (
                <div className="friend-requests-section">
                  <h4 className="section-title">🔔 收到好友申请 ({requests.length})</h4>
                  <div className="requests-list">
                    {requests.map((r) => (
                      <div key={r.id} className="request-card-row">
                        <div className="friend-card-left">
                          <div className="friend-card-avatar">{r.fromAvatar || '🀄'}</div>
                          <div className="friend-card-info">
                            <div className="friend-name-row">
                              <span className="friend-nickname">{r.fromNickname}</span>
                              <span className="friend-title-badge">{r.fromTitle}</span>
                            </div>
                            <span className="friend-id-sub">账号: {r.fromUsername}</span>
                          </div>
                        </div>
                        <div className="friend-card-actions">
                          <button
                            type="button"
                            className="btn-action primary sm"
                            onClick={() => handleRespondRequest(r.id, true)}
                          >
                            ✓ 同意
                          </button>
                          <button
                            type="button"
                            className="btn-action ghost sm"
                            onClick={() => handleRespondRequest(r.id, false)}
                          >
                            ✕ 忽略
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Box */}
              <form className="search-box-form" onSubmit={handleSearch}>
                <input
                  type="text"
                  className="input-field search-input"
                  placeholder="输入雀士账号名 / 昵称 / ID 查找"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn-action primary" disabled={searching || !searchQuery.trim()}>
                  {searching ? '搜索中…' : '🔍 搜索'}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="search-results-list">
                  <h4 className="section-title">搜索结果</h4>
                  {searchResults.map((u) => (
                    <div key={u.userId} className="search-result-row">
                      <div className="friend-card-left">
                        <div className="friend-card-avatar">{u.avatar || '🀄'}</div>
                        <div className="friend-card-info">
                          <div className="friend-name-row">
                            <span className="friend-nickname">{u.nickname}</span>
                            <span className="friend-title-badge">{u.title}</span>
                          </div>
                          <span className="friend-id-sub">账号: {u.username}</span>
                        </div>
                      </div>

                      <div className="friend-card-actions">
                        {u.isFriend ? (
                          <span className="status-tag is-friend">已是好友</span>
                        ) : u.hasPendingRequest ? (
                          <span className="status-tag pending">申请已发送</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-action primary sm"
                            onClick={() => handleSendRequest(u.userId)}
                          >
                            ➕ 添加好友
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Friend Stats Drawer / Modal */}
        {selectedFriendStats && (
          <div className="friend-stats-overlay" onClick={() => setSelectedFriendStats(null)}>
            <div className="friend-stats-card" onClick={(e) => e.stopPropagation()}>
              <div className="stats-card-header">
                <div className="stats-user-meta">
                  <div className="stats-avatar">{selectedFriendStats.user.avatar || '🀄'}</div>
                  <div>
                    <div className="stats-user-name">
                      <b>{selectedFriendStats.user.nickname}</b>
                      <span className="friend-title-badge">{selectedFriendStats.user.title}</span>
                    </div>
                    <div className="stats-user-sub">
                      <span>账号: {selectedFriendStats.user.username}</span> ·{' '}
                      <span>
                        {selectedFriendStats.status === 'playing'
                          ? '🟡 对局中'
                          : selectedFriendStats.status === 'online'
                            ? '🟢 大厅空闲'
                            : '⚪ 离线'}
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" className="close-btn" onClick={() => setSelectedFriendStats(null)}>
                  ✕
                </button>
              </div>

              {/* Stats Banner */}
              <div className="friend-stats-banner">
                <div className="stats-grid-4">
                  <div className="stat-box">
                    <span className="stat-num">{selectedFriendStats.stats.totalMatches}</span>
                    <span className="stat-lbl">联机总场次</span>
                  </div>
                  <div className="stat-box highlight">
                    <span className="stat-num">{selectedFriendStats.stats.winRate}%</span>
                    <span className="stat-lbl">联机胜率</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-num">{selectedFriendStats.stats.maxHu}</span>
                    <span className="stat-lbl">单局最高胡</span>
                  </div>
                  <div className="stat-box">
                    <span className={`stat-num ${selectedFriendStats.stats.totalScore >= 0 ? 'pos' : 'neg'}`}>
                      {selectedFriendStats.stats.totalScore >= 0
                        ? `+${selectedFriendStats.stats.totalScore}`
                        : selectedFriendStats.stats.totalScore}
                    </span>
                    <span className="stat-lbl">联机总净分</span>
                  </div>
                </div>
              </div>

              {/* Recent Matches */}
              <h4 className="recent-matches-title">最近联机战报 (最多20局)</h4>
              <div className="recent-matches-scroll">
                {selectedFriendStats.recentMatches.length === 0 ? (
                  <p className="no-matches-hint">暂无联机对战记录</p>
                ) : (
                  selectedFriendStats.recentMatches.map((m) => (
                    <div key={m.id} className="friend-match-row">
                      <div className="match-left">
                        <span className={`match-result-tag ${m.myIsWinner ? 'win' : m.liuju ? 'draw' : 'lose'}`}>
                          {m.myIsWinner ? '🏆 获胜' : m.liuju ? '流局' : '平局/失利'}
                        </span>
                        <span className="match-date">{m.dateStr}</span>
                        <span className="match-room">房号: {m.roomCode}</span>
                      </div>
                      <div className="match-right">
                        <span className="match-hu">{m.hu} 胡</span>
                        <span className={`match-delta ${m.myDeltaScore >= 0 ? 'pos' : 'neg'}`}>
                          {m.myDeltaScore >= 0 ? `+${m.myDeltaScore}` : m.myDeltaScore} 分
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="friend-stats-footer">
                <button
                  type="button"
                  className="btn-action primary"
                  onClick={() => setSelectedFriendStats(null)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="friends-modal-footer">
          <button type="button" className="btn-action ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

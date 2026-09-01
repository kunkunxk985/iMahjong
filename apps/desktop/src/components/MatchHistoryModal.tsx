import { useEffect, useState } from 'react';
import { SEAT_NAMES, type GameMode, type ModeStats, type UserProfile } from '@pizhou/shared';
import { apiGetMatches } from '../api/auth';
import { calculateStats, clearMatchHistory, getMatchHistory, type MatchRecord } from '../storage/history';

interface MatchHistoryModalProps {
  serverUrl?: string;
  token?: string | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onSelectReplay?: (record: MatchRecord) => void;
}

export function MatchHistoryModal({
  serverUrl,
  token,
  currentUser,
  onClose,
}: MatchHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'online' | 'local' | 'overview'>('online');
  const [localRecords, setLocalRecords] = useState<MatchRecord[]>(() => getMatchHistory());
  const [cloudRecords, setCloudRecords] = useState<MatchRecord[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  // Sync from Cloudflare if token is available
  useEffect(() => {
    if (!token || !serverUrl) return;
    let active = true;
    setSyncing(true);
    apiGetMatches(serverUrl, token)
      .then((res) => {
        if (active && res && Array.isArray(res.matches)) {
          setCloudRecords(res.matches);
        }
      })
      .catch((err) => {
        console.warn('Sync match history from cloud failed, using local:', err);
      })
      .finally(() => {
        if (active) setSyncing(false);
      });
    return () => {
      active = false;
    };
  }, [token, serverUrl]);

  // Combine or select active record list
  const records = cloudRecords || localRecords;
  const onlineRecords = records.filter((r) => r.mode === 'online');
  const localModeRecords = records.filter((r) => r.mode === 'local');

  const onlineStats: ModeStats = calculateStats(onlineRecords);
  const localStats: ModeStats = calculateStats(localModeRecords);

  const displayedRecords = activeTab === 'online' ? onlineRecords : activeTab === 'local' ? localModeRecords : [];
  const currentStats = activeTab === 'online' ? onlineStats : localStats;

  const handleClearCurrentTab = () => {
    if (activeTab === 'overview') return;
    const modeName = activeTab === 'online' ? '联机对战' : '单机陪练';
    if (window.confirm(`确定要清空所有【${modeName}】的历史战绩记录吗？`)) {
      clearMatchHistory(activeTab as GameMode);
      setLocalRecords(getMatchHistory());
      if (cloudRecords) {
        setCloudRecords(cloudRecords.filter((r) => r.mode !== activeTab));
      }
    }
  };

  const handleCopySummary = (record: MatchRecord) => {
    const isOnline = record.mode === 'online';
    const lines = [
      `🀄 【邳州麻将·${isOnline ? '好友联机' : '单机陪练'}战报】`,
      `📅 时间: ${record.dateStr} (${isOnline ? `房间: ${record.roomCode}` : '单机练习'})`,
      `🏆 结果: ${record.liuju ? '牌墙摸尽·流局' : `${record.winnerNickname ?? '玩家'} 胡牌 (${record.hu}胡${record.yao ? `${record.yao}幺` : ''})`}`,
      record.baoZhuang ? `⚠️ 包庄: 由【${SEAT_NAMES[record.baoZhuang.payerSeat]}位】全额包赔` : '',
      `-----------------------`,
      `📊 四家对账总流水:`,
      ...record.scores.map(
        (s) => `• ${SEAT_NAMES[s.seat]}家 [${s.nickname}]: ${s.score > 0 ? `+${s.score}` : s.score} 分`
      ),
      `-----------------------`,
      `邳州查胡两两结 · 欢迎下局再战！`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyNotice(`已复制【${record.roomCode}】对战记录！`);
      setTimeout(() => setCopyNotice(null), 2500);
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        {/* Modal Header */}
        <div className="history-header">
          <div className="history-title-wrap">
            <h2>📜 雀士战绩与生涯看板</h2>
            {currentUser && (
              <span className="history-user-badge">
                {currentUser.avatar} {currentUser.nickname} ({currentUser.title})
              </span>
            )}
          </div>
          {syncing && <span className="syncing-indicator">☁️ 正在同步云端...</span>}
        </div>

        {copyNotice && <div className="history-toast">{copyNotice}</div>}

        {/* Mode Tabs */}
        <div className="history-mode-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            🌐 好友联机战绩 ({onlineRecords.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
          >
            🤖 单机陪练战绩 ({localModeRecords.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 生涯综合总览
          </button>
        </div>

        <div className="history-content">
          {activeTab === 'overview' ? (
            /* Career Overview Panel */
            <div className="history-overview-panel">
              <div className="overview-grid">
                {/* Online Stats Card */}
                <div className="overview-card online-card">
                  <div className="card-top">
                    <h3>🌐 好友联机对战</h3>
                    <span className="card-badge">真人对局</span>
                  </div>
                  <div className="stats-metric-row">
                    <div className="metric-box">
                      <span className="metric-label">总场次</span>
                      <strong className="metric-val">{onlineStats.totalMatches} 局</strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">联机胜率</span>
                      <strong className="metric-val highlight">{onlineStats.winRate}%</strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">累计净得分</span>
                      <strong className={`metric-val ${onlineStats.totalScore >= 0 ? 'plus' : 'minus'}`}>
                        {onlineStats.totalScore > 0 ? `+${onlineStats.totalScore}` : onlineStats.totalScore}
                      </strong>
                    </div>
                  </div>
                  <div className="stats-sub-row">
                    <span>胜 {onlineStats.wins} 场 / 负 {onlineStats.losses} 场 / 流局 {onlineStats.draws} 场</span>
                    <span>最高单局: <b>{onlineStats.maxHu} 胡</b> · 飘荤 {onlineStats.piaoHunCount} 次 · 包庄 {onlineStats.baoZhuangCount} 次</span>
                  </div>
                </div>

                {/* Local Single-player Stats Card */}
                <div className="overview-card local-card">
                  <div className="card-top">
                    <h3>🤖 单机人机陪练</h3>
                    <span className="card-badge ghost">本地练习</span>
                  </div>
                  <div className="stats-metric-row">
                    <div className="metric-box">
                      <span className="metric-label">练习场次</span>
                      <strong className="metric-val">{localStats.totalMatches} 局</strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">练习胜率</span>
                      <strong className="metric-val highlight">{localStats.winRate}%</strong>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">单机净得分</span>
                      <strong className={`metric-val ${localStats.totalScore >= 0 ? 'plus' : 'minus'}`}>
                        {localStats.totalScore > 0 ? `+${localStats.totalScore}` : localStats.totalScore}
                      </strong>
                    </div>
                  </div>
                  <div className="stats-sub-row">
                    <span>胜 {localStats.wins} 场 / 负 {localStats.losses} 场 / 流局 {localStats.draws} 场</span>
                    <span>最高单局: <b>{localStats.maxHu} 胡</b> · 飘荤 {localStats.piaoHunCount} 次</span>
                  </div>
                </div>
              </div>

              <div className="overview-tip">
                💡 <b>提示：</b>《邳州麻将》严格将好友联机与单机陪练数据分流记录。好友对局计入正式雀友战绩，单机陪练可尽情演练坎上和关门牌型！
              </div>
            </div>
          ) : (
            /* Mode-specific Match List */
            <>
              {/* Mode Metric Header Banner */}
              <div className="mode-stats-banner">
                <div className="banner-item">
                  <span>对局场次</span>
                  <b>{currentStats.totalMatches} 场</b>
                </div>
                <div className="banner-item">
                  <span>胜率</span>
                  <b className="green">{currentStats.winRate}%</b>
                </div>
                <div className="banner-item">
                  <span>胜 / 负 / 荒</span>
                  <b>{currentStats.wins} / {currentStats.losses} / {currentStats.draws}</b>
                </div>
                <div className="banner-item">
                  <span>单局最高</span>
                  <b>{currentStats.maxHu} 胡</b>
                </div>
                <div className="banner-item">
                  <span>总积分</span>
                  <b className={currentStats.totalScore >= 0 ? 'green' : 'red'}>
                    {currentStats.totalScore > 0 ? `+${currentStats.totalScore}` : currentStats.totalScore}
                  </b>
                </div>
              </div>

              {displayedRecords.length === 0 ? (
                <div className="history-empty">
                  <span className="empty-icon">🀄</span>
                  <p>暂无【{activeTab === 'online' ? '好友联机' : '单机陪练'}】战绩，去开一局吧！</p>
                </div>
              ) : (
                <div className="history-list">
                  {displayedRecords.map((record) => {
                    const isDraw = record.liuju;
                    const winnerScore = record.scores.find((s) => s.isWinner);

                    return (
                      <div key={record.id} className="history-card">
                        <div className="history-card-top">
                          <div className="history-card-meta">
                            <span className="history-date">{record.dateStr}</span>
                            <span className="history-room-tag">
                              {record.mode === 'online' ? `房号 ${record.roomCode}` : '单机练习'}
                            </span>
                            {record.hunDi ? <span className="history-piao-tag">飘荤</span> : null}
                            {record.baoZhuang ? <span className="history-bao-tag">包庄</span> : null}
                          </div>
                          <button
                            type="button"
                            className="history-copy-btn"
                            onClick={() => handleCopySummary(record)}
                            title="复制战报"
                          >
                            📋 复制战报
                          </button>
                        </div>

                        <div className="history-main-row">
                          <div className="history-winner-block">
                            {isDraw ? (
                              <span className="winner-label draw">💨 荒牌流局</span>
                            ) : (
                              <>
                                <span className="winner-crown">👑</span>
                                <div className="winner-info">
                                  <b className="winner-name">{record.winnerNickname ?? '玩家'} 胡牌</b>
                                  <span className="winner-hu">
                                    {record.hu} 胡 {record.yao ? `${record.yao} 幺` : ''} · {record.winType}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {winnerScore && (
                            <div className="history-win-points">
                              +{winnerScore.score} <span className="pts">分</span>
                            </div>
                          )}
                        </div>

                        <div className="history-scores-grid">
                          {record.scores.map((s) => (
                            <div
                              key={s.seat}
                              className={`score-pill ${s.isWinner ? 'winner' : ''} ${s.score >= 0 ? 'plus' : 'minus'}`}
                            >
                              <span className="seat-prefix">{SEAT_NAMES[s.seat]}</span>
                              <span className="player-nick">{s.nickname}</span>
                              <b className="score-val">{s.score > 0 ? `+${s.score}` : s.score}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="history-footer-row">
          {displayedRecords.length > 0 && activeTab !== 'overview' && (
            <button type="button" className="btn-action ghost sm danger" onClick={handleClearCurrentTab}>
              清空当前分类
            </button>
          )}
          <button type="button" className="btn-action primary" onClick={onClose}>
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type { LeaderboardEntry } from '@pizhou/shared';
import { AvatarView } from '../AvatarView';
import type { LeaderboardSort } from './profileModel';

interface ProfileLeaderboardTabProps {
  sortedLeaderboard: LeaderboardEntry[];
  userId: string;
  leaderboardSort: LeaderboardSort;
  setLeaderboardSort: (value: LeaderboardSort) => void;
}

export function ProfileLeaderboardTab({ sortedLeaderboard, userId, leaderboardSort, setLeaderboardSort }: ProfileLeaderboardTabProps): React.ReactElement {
  return (
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
            const isMe = entry.userId === userId;
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
  );
}

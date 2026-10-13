import React from 'react';
import { calculateCareerStats } from '@pizhou/shared';

interface ProfileStatsTabProps {
  activeStats: ReturnType<typeof calculateCareerStats>;
  statsMode: 'online' | 'local';
  setStatsMode: (value: 'online' | 'local') => void;
}

export function ProfileStatsTab({ activeStats, statsMode, setStatsMode }: ProfileStatsTabProps): React.ReactElement {
  const winRate = activeStats.winRate || 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, winRate)) / 100) * circumference;
  return (
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
                <span style={{ color: '#e2e8f0' }}>{fan.label} </span>
                <span style={{ color: fan.color, fontWeight: 'bold' }}>{fan.count} 局 ({percent}%)</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, percent)}%`,
                    height: '100%',
                    background: fan.color,
                    borderRadius: '3px',

                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

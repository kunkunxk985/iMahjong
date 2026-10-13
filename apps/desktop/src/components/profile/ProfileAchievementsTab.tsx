import React from 'react';
import { ACHIEVEMENT_CATEGORIES, evaluateAchievements, type AchievementCategory } from '@pizhou/shared';

interface ProfileAchievementsTabProps {
  achievements: ReturnType<typeof evaluateAchievements>;
  achievementFilter: 'all' | AchievementCategory;
  title: string;
  setAchievementFilter: (value: 'all' | AchievementCategory) => void;
  onEquipTitle: (value: string) => void;
}

export function ProfileAchievementsTab({ achievements, achievementFilter, title, setAchievementFilter, onEquipTitle }: ProfileAchievementsTabProps): React.ReactElement {
  const unlockedAchievementsCount = achievements.filter((item) => item.unlocked).length;
  const filteredAchievements = achievementFilter === 'all' ? achievements : achievements.filter((item) => item.achievement.category === achievementFilter);
  return (
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
                      <span style={{ fontSize: '10px', color: '#fbbf24' }}>已称号</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEquipTitle(item.achievement.rewardTitle)}
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
                        称号
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
  );
}

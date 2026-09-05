import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RANK_TIERS,
  ACHIEVEMENTS_CATALOG,
  GUOFENG_AVATAR_PRESETS,
  GUOFENG_AVATARS,
  sanitizeAvatar,
  calculateRP,
  getRankTier,
  calculateRank,
  evaluateAchievements,
  calculateFanTypeDistribution,
  calculateCareerStats,
  isGuofengAvatar,
  getGuofengAvatarDef,
  type EnrichedMatchRecord,
} from '../src/index.ts';

describe('Guofeng Avatars', () => {
  it('should provide exactly 12 curated Oriental/Guofeng avatars with complete metadata', () => {
    assert.equal(GUOFENG_AVATAR_PRESETS.length, 12);
    for (const preset of GUOFENG_AVATAR_PRESETS) {
      assert.ok(preset.id.startsWith('guofeng_'));
      assert.ok(preset.name.length > 0);
      assert.ok(preset.theme.startsWith('#'));
      assert.ok(preset.desc.length > 0);
      assert.ok(preset.title.length > 0);
      assert.ok(preset.category === 'character' || preset.category === 'auspicious');
    }
  });

  it('should identify valid and invalid guofeng avatar IDs', () => {
    assert.equal(isGuofengAvatar('guofeng_yushi'), true);
    assert.equal(isGuofengAvatar('guofeng_shenlong'), true);
    assert.equal(isGuofengAvatar('guofeng_zongshi'), true);
    assert.equal(isGuofengAvatar('🀄'), false);
    assert.equal(isGuofengAvatar('data:image/png;base64,123'), false);
    assert.equal(isGuofengAvatar(''), false);
    assert.equal(isGuofengAvatar(null), false);
  });

  it('should retrieve avatar definition by ID', () => {
    const yushi = getGuofengAvatarDef('guofeng_yushi');
    assert.ok(yushi);
    assert.equal(yushi?.name, '翡翠雀客');
    assert.equal(yushi?.theme, '#10b981');

    const invalid = getGuofengAvatarDef('unknown_avatar');
    assert.equal(invalid, undefined);
  });

  it('should accept all 12 guofeng avatars and custom guofeng IDs in sanitizeAvatar', () => {
    assert.equal(GUOFENG_AVATARS.length, 12);
    for (const preset of GUOFENG_AVATAR_PRESETS) {
      assert.equal(sanitizeAvatar(preset.id), preset.id);
      assert.ok(GUOFENG_AVATARS.includes(preset.id as any));
    }
    // Custom guofeng ID matching pattern
    assert.equal(sanitizeAvatar('guofeng_custom_dragon_99'), 'guofeng_custom_dragon_99');
    // Legacy emoji preset
    assert.equal(sanitizeAvatar('🐱'), '🐱');
    // Invalid avatar falls back to default
    assert.equal(sanitizeAvatar('hacker_avatar_injection'), '🀄');
  });
});

describe('Rank Ladder & Rating Points (RP)', () => {
  it('should define exactly 9 progressive tiers in strict order', () => {
    assert.equal(RANK_TIERS.length, 9);
    for (let i = 0; i < RANK_TIERS.length; i++) {
      assert.equal(RANK_TIERS[i].tier, i);
      if (i > 0) {
        assert.ok(RANK_TIERS[i].minRP > RANK_TIERS[i - 1].minRP);
      }
    }
    assert.equal(RANK_TIERS[0].name, '初心雀士');
    assert.equal(RANK_TIERS[1].name, '一星雀士');
    assert.equal(RANK_TIERS[2].name, '二星雀士');
    assert.equal(RANK_TIERS[3].name, '初段雀客');
    assert.equal(RANK_TIERS[4].name, '二段雀杰');
    assert.equal(RANK_TIERS[5].name, '三段高徒');
    assert.equal(RANK_TIERS[6].name, '高段名手');
    assert.equal(RANK_TIERS[7].name, '邳州雀圣');
    assert.equal(RANK_TIERS[8].name, '九天雀仙');
  });

  it('should map RP to correct tiers at boundary conditions', () => {
    assert.equal(getRankTier(0).name, '初心雀士');
    assert.equal(getRankTier(149).name, '初心雀士');
    assert.equal(getRankTier(150).name, '一星雀士');
    assert.equal(getRankTier(399).name, '一星雀士');
    assert.equal(getRankTier(400).name, '二星雀士');
    assert.equal(getRankTier(799).name, '二星雀士');
    assert.equal(getRankTier(800).name, '初段雀客');
    assert.equal(getRankTier(1399).name, '初段雀客');
    assert.equal(getRankTier(1400).name, '二段雀杰');
    assert.equal(getRankTier(2199).name, '二段雀杰');
    assert.equal(getRankTier(2200).name, '三段高徒');
    assert.equal(getRankTier(3199).name, '三段高徒');
    assert.equal(getRankTier(3200).name, '高段名手');
    assert.equal(getRankTier(4499).name, '高段名手');
    assert.equal(getRankTier(4500).name, '邳州雀圣');
    assert.equal(getRankTier(6499).name, '邳州雀圣');
    assert.equal(getRankTier(6500).name, '九天雀仙');
    assert.equal(getRankTier(12000).name, '九天雀仙');
  });

  it('should compute calculateRank with progress and next tier info', () => {
    // Beginner mid-tier
    const r1 = calculateRank(75);
    assert.equal(r1.currentTier.name, '初心雀士');
    assert.equal(r1.nextTier?.name, '一星雀士');
    assert.equal(r1.rpInTier, 75);
    assert.equal(r1.rpNeededForNext, 75);
    assert.ok(Math.abs(r1.progress - 0.5) < 0.01);
    assert.equal(r1.isMaxTier, false);

    // Max tier
    const rMax = calculateRank(8000);
    assert.equal(rMax.currentTier.name, '九天雀仙');
    assert.equal(rMax.nextTier, null);
    assert.equal(rMax.progress, 1.0);
    assert.equal(rMax.rpNeededForNext, 0);
    assert.equal(rMax.isMaxTier, true);
  });

  it('should deterministically calculate RP from online and local match history', () => {
    const records: EnrichedMatchRecord[] = [
      // Online win with 40 hu + piaoHun (+10) + closed (+15) -> 35 + 20 + 10 + 15 = 80 RP
      {
        id: 'm1',
        mode: 'online',
        timestamp: 1000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 40,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: true,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 120,
        myIsWinner: true,
        scores: [],
        myClosed: true,
      },
      // Online liuju -> +5 RP
      {
        id: 'm2',
        mode: 'online',
        timestamp: 2000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'liuju',
        winnerSeat: null,
        hu: 0,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: true,
        baoZhuang: null,
        myDeltaScore: 0,
        myIsWinner: false,
        scores: [],
      },
      // Online loss -> -10 RP
      {
        id: 'm3',
        mode: 'online',
        timestamp: 3000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 1,
        hu: 20,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: -30,
        myIsWinner: false,
        scores: [],
      },
      // Local win -> +12 RP
      {
        id: 'm4',
        mode: 'local',
        timestamp: 4000,
        dateStr: '2026-09-04',
        roomCode: 'local',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 30,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 50,
        myIsWinner: true,
        scores: [],
      },
    ];

    // Expected: 80 + 5 - 10 + 12 = 87
    const rp = calculateRP(records);
    assert.equal(rp, 87);
  });

  it('should handle NaN and non-finite numbers safely in calculateRP, calculateRank, and getRankTier', () => {
    const nanRecord: MatchRecord = {
      id: 'm_nan',
      mode: 'online',
      timestamp: 5000,
      dateStr: '2026-09-04',
      roomCode: '100001',
      winType: 'ping-hu',
      winnerSeat: 0,
      hu: NaN,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: NaN,
      myIsWinner: true,
      scores: [],
    };

    const rp = calculateRP([nanRecord]);
    assert.equal(Number.isFinite(rp), true);
    assert.equal(rp, 35); // 35 base + Math.floor(0 / 2)

    const rankFromNaN = calculateRank(NaN);
    assert.equal(Number.isFinite(rankFromNaN.rp), true);
    assert.equal(rankFromNaN.rp, 0);
    assert.equal(rankFromNaN.currentTier.name, '初心雀士');
    assert.equal(rankFromNaN.progress, 0);

    const tierFromNaN = getRankTier(NaN);
    assert.equal(tierFromNaN.name, '初心雀士');

    // Also test calculateCareerStats with NaN
    const careerStats = calculateCareerStats([nanRecord]);
    assert.equal(Number.isFinite(careerStats.totalScore), true);
    assert.equal(Number.isFinite(careerStats.maxHu), true);
  });
});

describe('Milestone Achievements System', () => {
  it('should include all 15 achievements across the 4 categories', () => {
    assert.equal(ACHIEVEMENTS_CATALOG.length, 15);
    const categories = new Set(ACHIEVEMENTS_CATALOG.map((a) => a.category));
    assert.deepEqual(Array.from(categories).sort(), ['combat', 'dealer', 'fantype', 'social'].sort());

    for (const ach of ACHIEVEMENTS_CATALOG) {
      assert.ok(ach.id.startsWith('ach_'));
      assert.ok(ach.name.length > 0);
      assert.ok(ach.desc.length > 0);
      assert.ok(ach.targetCount > 0);
      assert.ok(ach.rewardTitle.length > 0);
      assert.ok(ach.icon.length > 0);
    }
  });

  it('should evaluate empty history with all zero achievements', () => {
    const progress = evaluateAchievements([], { avatar: '🀄', bio: '不碰坎不上，单钓不换张！' });
    assert.equal(progress.length, 15);
    assert.ok(progress.every((p) => p.currentCount === 0 && !p.unlocked));
  });

  it('should unlock profile achievement when guofeng avatar and custom bio are set', () => {
    const progress = evaluateAchievements([], {
      avatar: 'guofeng_yushi',
      bio: '运河水暖，自摸清风',
    });
    const profileAch = progress.find((p) => p.achievement.id === 'ach_profile_full');
    assert.ok(profileAch);
    assert.equal(profileAch?.unlocked, true);
    assert.equal(profileAch?.currentCount, 1);
  });

  it('should evaluate combat win streaks and total win milestones', () => {
    const records: EnrichedMatchRecord[] = [];
    // Create 3 consecutive wins
    for (let i = 0; i < 3; i++) {
      records.push({
        id: `m_${i}`,
        mode: 'online',
        timestamp: 1000 + i * 1000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 30,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 50,
        myIsWinner: true,
        scores: [{ seat: 0, nickname: 'Me', score: 50, isWinner: true, isDealer: false }],
      });
    }

    const progress = evaluateAchievements(records);
    const firstBlood = progress.find((p) => p.achievement.id === 'ach_first_blood');
    const streak3 = progress.find((p) => p.achievement.id === 'ach_win_streak_3');
    const streak5 = progress.find((p) => p.achievement.id === 'ach_win_streak_5');

    assert.equal(firstBlood?.unlocked, true);
    assert.equal(streak3?.unlocked, true);
    assert.equal(streak3?.currentCount, 3);
    assert.equal(streak5?.unlocked, false);
    assert.equal(streak5?.currentCount, 3);
  });

  it('should evaluate fan type achievements (自摸, 起手杠胡, 关门, 飘荤)', () => {
    const records: EnrichedMatchRecord[] = [
      // 关门胡
      {
        id: 'm1',
        mode: 'online',
        timestamp: 1000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 30,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 80,
        myIsWinner: true,
        myClosed: true,
        scores: [{ seat: 0, nickname: 'Me', score: 80, isWinner: true, isDealer: false }],
      },
      // 起手杠胡
      {
        id: 'm2',
        mode: 'online',
        timestamp: 2000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'qidong-gang-hu',
        winnerSeat: 0,
        hu: 32,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 160,
        myIsWinner: true,
        scores: [{ seat: 0, nickname: 'Me', score: 160, isWinner: true, isDealer: false }],
      },
      // 飘荤 50胡
      {
        id: 'm3',
        mode: 'online',
        timestamp: 3000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 54,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: true,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 240,
        myIsWinner: true,
        scores: [{ seat: 0, nickname: 'Me', score: 240, isWinner: true, isDealer: false }],
      },
      // 包庄对手
      {
        id: 'm4',
        mode: 'online',
        timestamp: 4000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 30,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: { reason: 'four_wait_seq', payerSeat: 2, winnerSeat: 0 },
        myDeltaScore: 420, // also triggers big_win >= 400
        myIsWinner: true,
        scores: [{ seat: 0, nickname: 'Me', score: 420, isWinner: true, isDealer: false }],
      },
    ];

    const progress = evaluateAchievements(records);
    const guanMen = progress.find((p) => p.achievement.id === 'ach_guan_men');
    const qiShou = progress.find((p) => p.achievement.id === 'ach_qishou_gang');
    const piaoHun = progress.find((p) => p.achievement.id === 'ach_piao_hun');
    const baoZhuang = progress.find((p) => p.achievement.id === 'ach_bao_zhuang_win');
    const bigWin = progress.find((p) => p.achievement.id === 'ach_big_win');

    assert.equal(guanMen?.unlocked, true);
    assert.equal(qiShou?.unlocked, true);
    assert.equal(piaoHun?.unlocked, true);
    assert.equal(baoZhuang?.unlocked, true);
    assert.equal(bigWin?.unlocked, true);
  });
});

describe('Career Statistics & Fan Type Distribution', () => {
  it('should calculate complete Fan Type Distribution including 自摸, 关门, 起手杠胡, 飘荤, 包庄, 流局', () => {
    const records: EnrichedMatchRecord[] = [
      {
        id: 'r1',
        mode: 'online',
        timestamp: 1000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'qidong-gang-hu',
        winnerSeat: 0,
        hu: 32,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 100,
        myIsWinner: true,
        scores: [],
      },
      {
        id: 'r2',
        mode: 'online',
        timestamp: 2000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 30,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: true,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 60,
        myIsWinner: true,
        scores: [],
        selfDraw: true,
        myClosed: true,
      },
      {
        id: 'r3',
        mode: 'online',
        timestamp: 3000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'liuju',
        winnerSeat: null,
        hu: 0,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: true,
        baoZhuang: null,
        myDeltaScore: 0,
        myIsWinner: false,
        scores: [],
      },
      {
        id: 'r4',
        mode: 'online',
        timestamp: 4000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 20,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 40,
        myIsWinner: true,
        scores: [],
      },
    ];

    const dist = calculateFanTypeDistribution(records);
    assert.equal(dist.qiShouGangHu, 1);
    assert.equal(dist.ziMo, 1);
    assert.equal(dist.guanMen, 1);
    assert.equal(dist.piaoHun, 1);
    assert.equal(dist.liuJu, 1);
    assert.equal(dist.pingHu, 1);
  });

  it('should compute career stats with winRate, maxWinScore, and win streaks', () => {
    const records: EnrichedMatchRecord[] = [
      {
        id: 'c1',
        mode: 'online',
        timestamp: 1000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 40,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 120,
        myIsWinner: true,
        scores: [],
      },
      {
        id: 'c2',
        mode: 'online',
        timestamp: 2000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 0,
        hu: 60,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: true,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: 350,
        myIsWinner: true,
        scores: [],
      },
      {
        id: 'c3',
        mode: 'online',
        timestamp: 3000,
        dateStr: '2026-09-04',
        roomCode: '100001',
        winType: 'ping-hu',
        winnerSeat: 1,
        hu: 20,
        yao: 0,
        dealerMultiplier: 1,
        hunDi: false,
        liuju: false,
        baoZhuang: null,
        myDeltaScore: -50,
        myIsWinner: false,
        scores: [],
      },
    ];

    const stats = calculateCareerStats(records);
    assert.equal(stats.totalMatches, 3);
    assert.equal(stats.wins, 2);
    assert.equal(stats.losses, 1);
    assert.equal(Math.round(stats.winRate), 67);
    assert.equal(stats.maxHu, 60);
    assert.equal(stats.maxWinScore, 350);
    assert.equal(stats.winStreakMax, 2);
    assert.equal(stats.currentWinStreak, 0);
  });
});

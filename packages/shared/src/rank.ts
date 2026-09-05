import type { MatchRecord, ModeStats } from './auth.ts';

// ─── 1. 12 Curated Guofeng Avatars ───────────────────────────────────

export interface GuofengAvatarDef {
  id: string;
  name: string;
  theme: string;
  category: 'character' | 'auspicious';
  desc: string;
  title: string;
}

export const GUOFENG_AVATAR_PRESETS: readonly GuofengAvatarDef[] = [
  { id: 'guofeng_yushi', name: '翡翠雀客', theme: '#10b981', category: 'character', desc: '温润如玉，算无遗策', title: '翡翠名仕' },
  { id: 'guofeng_mingling', name: '执扇名伶', theme: '#f43f5e', category: 'character', desc: '红袖拂牌，巧变万千', title: '绝艺名伶' },
  { id: 'guofeng_daoshi', name: '运河仙翁', theme: '#8b5cf6', category: 'character', desc: '太极生风，坐隐忘忧', title: '太虚道翁' },
  { id: 'guofeng_nuxia', name: '飒爽剑客', theme: '#f59e0b', category: 'character', desc: '斗笠藏锋，决断如电', title: '惊鸿剑豪' },
  { id: 'guofeng_jinli', name: '祥瑞锦鲤', theme: '#f97316', category: 'auspicious', desc: '吉庆自摸，如鱼得水', title: '运河锦鲤' },
  { id: 'guofeng_xianhe', name: '云中仙鹤', theme: '#38bdf8', category: 'auspicious', desc: '九皋鹤鸣，超然尘外', title: '青云野鹤' },
  { id: 'guofeng_shenlong', name: '苍青游龙', theme: '#059669', category: 'auspicious', desc: '气吞山河，威震牌桌', title: '江海苍龙' },
  { id: 'guofeng_fenghuang', name: '赤炎神凤', theme: '#ef4444', category: 'auspicious', desc: '涅槃破局，百胜无伤', title: '九天神凤' },
  { id: 'guofeng_qilin', name: '金甲麒麟', theme: '#eab308', category: 'auspicious', desc: '踏金送福，稳如泰山', title: '瑞兽麒麟' },
  { id: 'guofeng_xuanwu', name: '镇水玄武', theme: '#0284c7', category: 'auspicious', desc: '不动如山，严密防守', title: '玄冥镇水' },
  { id: 'guofeng_linglu', name: '呦呦仙鹿', theme: '#14b8a6', category: 'auspicious', desc: '林深见鹿，灵犀通牌', title: '瑶池仙鹿' },
  { id: 'guofeng_zongshi', name: '邳州宗师', theme: '#b91c1c', category: 'character', desc: '运河雄浑，宗师大器', title: '邳州宗师' },
] as const;

export type GuofengAvatarId = typeof GUOFENG_AVATAR_PRESETS[number]['id'];

export const GUOFENG_AVATARS: readonly GuofengAvatarId[] = GUOFENG_AVATAR_PRESETS.map(
  (preset) => preset.id as GuofengAvatarId,
);

export function isGuofengAvatar(id: unknown): id is GuofengAvatarId {
  return typeof id === 'string' && GUOFENG_AVATAR_PRESETS.some((preset) => preset.id === id);
}

export function getGuofengAvatarDef(id: string): GuofengAvatarDef | undefined {
  return GUOFENG_AVATAR_PRESETS.find((preset) => preset.id === id);
}

// ─── 2. 9-Tier Rank Ladder (Rating Points) ───────────────────────────

export interface RankTier {
  id: string;
  tier: number;            // 0..8
  name: string;
  subTitle: string;
  minRP: number;
  maxRP: number;
  colorTheme: string;
  sealChar: string;        // 2-character seal
  badgeIcon: string;
}

export const RANK_TIERS: readonly RankTier[] = [
  { id: 'novice_1', tier: 0, name: '初心雀士', subTitle: '初入牌舍 · 尚待磨砺', minRP: 0, maxRP: 149, colorTheme: '#64748b', sealChar: '初心', badgeIcon: '🌱' },
  { id: 'novice_2', tier: 1, name: '一星雀士', subTitle: '渐悟牌理 · 规避生张', minRP: 150, maxRP: 399, colorTheme: '#0284c7', sealChar: '一星', badgeIcon: '⭐' },
  { id: 'novice_3', tier: 2, name: '二星雀士', subTitle: '出牌从容 · 进张有数', minRP: 400, maxRP: 799, colorTheme: '#059669', sealChar: '二星', badgeIcon: '🌟' },
  { id: 'dan_1', tier: 3, name: '初段雀客', subTitle: '运河起步 · 堂皇入室', minRP: 800, maxRP: 1399, colorTheme: '#10b981', sealChar: '初段', badgeIcon: '🥉' },
  { id: 'dan_2', tier: 4, name: '二段雀杰', subTitle: '攻守兼备 · 明辨香臭', minRP: 1400, maxRP: 2199, colorTheme: '#6366f1', sealChar: '二段', badgeIcon: '🥈' },
  { id: 'dan_3', tier: 5, name: '三段高徒', subTitle: '精通坎上 · 关门必克', minRP: 2200, maxRP: 3199, colorTheme: '#8b5cf6', sealChar: '三段', badgeIcon: '🥇' },
  { id: 'master_1', tier: 6, name: '高段名手', subTitle: '威震淮东 · 名动一城', minRP: 3200, maxRP: 4499, colorTheme: '#f59e0b', sealChar: '名手', badgeIcon: '🏆' },
  { id: 'saint_1', tier: 7, name: '邳州雀圣', subTitle: '运河砥柱 · 算绝千牌', minRP: 4500, maxRP: 6499, colorTheme: '#ef4444', sealChar: '雀圣', badgeIcon: '👑' },
  { id: 'celestial_9', tier: 8, name: '九天雀仙', subTitle: '登峰造极 · 传世不朽', minRP: 6500, maxRP: Infinity, colorTheme: '#ec4899', sealChar: '雀仙', badgeIcon: '✨' },
] as const;

export interface RankInfo {
  rp: number;
  currentTier: RankTier;
  nextTier: RankTier | null;
  progress: number; // 0..1 (fraction completed in current tier toward next tier)
  rpInTier: number;
  rpNeededForNext: number;
  isMaxTier: boolean;
}

export interface EnrichedMatchRecord extends MatchRecord {
  selfDraw?: boolean;
  myClosed?: boolean;
  myPiaoHun?: boolean;
  myBaoZhuangPayer?: boolean;
}

/**
 * Deterministically compute total Rating Points (RP) from match history.
 * Online wins award +35 RP base + Math.floor(hu / 2), with bonuses for 荤底 (+10) and 关门 (+15).
 * Online liuju gives +5 RP. Online loss subtracts 10 RP (clamped >= 0).
 * Local practice matches award +12 RP for win, +2 RP for liuju.
 */
export function calculateRP(records: Array<MatchRecord | EnrichedMatchRecord>): number {
  let rp = 0;
  for (const r of records) {
    const isOnline = r.mode === 'online';
    const isWinner = Boolean(r.myIsWinner);
    const isLiuju = Boolean(r.liuju);
    const enriched = r as EnrichedMatchRecord;

    if (isOnline) {
      if (isWinner) {
        const hu = Number.isFinite(r.hu) ? Math.max(0, r.hu) : 0;
        rp += 35 + Math.floor(hu / 2);
        if (r.hunDi || enriched.myPiaoHun) rp += 10;
        if (enriched.myClosed) rp += 15;
      } else if (isLiuju) {
        rp += 5;
      } else {
        rp = Math.max(0, rp - 10);
      }
    } else {
      if (isWinner) {
        rp += 12;
      } else if (isLiuju) {
        rp += 2;
      }
    }
  }
  return rp;
}

export function getRankTier(rp: number): RankTier {
  const safeRP = Number.isFinite(rp) ? Math.max(0, Math.floor(rp)) : 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (safeRP >= RANK_TIERS[i].minRP) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

export function calculateRank(rp: number): RankInfo {
  const safeRP = Number.isFinite(rp) ? Math.max(0, Math.floor(rp)) : 0;
  const currentTier = getRankTier(safeRP);
  const nextTier = currentTier.tier < RANK_TIERS.length - 1 ? RANK_TIERS[currentTier.tier + 1] : null;

  if (!nextTier) {
    return {
      rp: safeRP,
      currentTier,
      nextTier: null,
      progress: 1.0,
      rpInTier: safeRP - currentTier.minRP,
      rpNeededForNext: 0,
      isMaxTier: true,
    };
  }

  const range = nextTier.minRP - currentTier.minRP;
  const rpInTier = safeRP - currentTier.minRP;
  const progress = Math.min(1.0, Math.max(0.0, range > 0 ? rpInTier / range : 1.0));
  const rpNeededForNext = Math.max(0, nextTier.minRP - safeRP);

  return {
    rp: safeRP,
    currentTier,
    nextTier,
    progress,
    rpInTier,
    rpNeededForNext,
    isMaxTier: false,
  };
}

// ─── 3. 15 Milestone Achievements ─────────────────────────────────────

export type AchievementCategory = 'combat' | 'fantype' | 'dealer' | 'social';

export interface AchievementDef {
  id: string;
  name: string;
  category: AchievementCategory;
  desc: string;
  targetCount: number;
  rewardTitle: string;
  icon: string;
}

export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, { name: string; icon: string }> = {
  combat: { name: '胜战之道', icon: '⚔️' },
  fantype: { name: '绝艺番型', icon: '🀄' },
  dealer: { name: '庄家博弈', icon: '👑' },
  social: { name: '雀友风雅', icon: '🪪' },
};

export const ACHIEVEMENTS_CATALOG: readonly AchievementDef[] = [
  // 胜战之道 (Combat)
  { id: 'ach_first_blood', name: '破晓初鸣', category: 'combat', desc: '取得任意模式第 1 场对局胜利', targetCount: 1, rewardTitle: '初鸣雀友', icon: '⚔️' },
  { id: 'ach_win_streak_3', name: '势如破竹', category: 'combat', desc: '达成 3 连胜辉煌战绩', targetCount: 3, rewardTitle: '连战连捷', icon: '🔥' },
  { id: 'ach_win_streak_5', name: '气贯长虹', category: 'combat', desc: '达成 5 连胜无敌传说', targetCount: 5, rewardTitle: '常胜将军', icon: '⚡' },
  { id: 'ach_matches_50', name: '千锤百炼', category: 'combat', desc: '累计完成 50 场对局', targetCount: 50, rewardTitle: '千牌不倒', icon: '🛡️' },
  { id: 'ach_wins_100', name: '百战百胜', category: 'combat', desc: '累计赢得 100 场胜利', targetCount: 100, rewardTitle: '运河传奇', icon: '🏅' },
  // 绝艺番型 (Fan Types)
  { id: 'ach_guan_men', name: '关门大吉', category: 'fantype', desc: '宣告“关门”听牌后成功胡牌', targetCount: 1, rewardTitle: '闭门隐士', icon: '🚪' },
  { id: 'ach_qishou_gang', name: '起手开花', category: 'fantype', desc: '起手四张相同杠牌直接宣告胡牌', targetCount: 1, rewardTitle: '起手狂魔', icon: '🌸' },
  { id: 'ach_piao_hun', name: '飘荤天花板', category: 'fantype', desc: '达成飘荤结算且胡数达到 50 胡以上', targetCount: 1, rewardTitle: '大蒜宗师', icon: '🍲' },
  { id: 'ach_zimo_10', name: '运河锦鲤', category: 'fantype', desc: '累计达成 10 次自摸胡牌', targetCount: 10, rewardTitle: '自摸仙人', icon: '🐟' },
  { id: 'ach_dan_diao', name: '单钓不换张', category: 'fantype', desc: '单钓一张坚决不换张并顺利胡牌', targetCount: 1, rewardTitle: '单钓不换张', icon: '🎯' },
  // 庄家与对局博弈 (Dealer)
  { id: 'ach_dealer_streak_3', name: '连庄大师', category: 'dealer', desc: '作为庄家连续连庄 3 局及以上', targetCount: 3, rewardTitle: '铁打庄主', icon: '👑' },
  { id: 'ach_bao_zhuang_win', name: '包庄终结者', category: 'dealer', desc: '成功促成对手包庄并获得全额结算', targetCount: 1, rewardTitle: '包庄终结者', icon: '⚖️' },
  { id: 'ach_big_win', name: '豪取万贯', category: 'dealer', desc: '单局对局净胜分超过 +400 分', targetCount: 1, rewardTitle: '雀庄豪侠', icon: '💰' },
  // 雀友风雅 (Social & Identity)
  { id: 'ach_profile_full', name: '风雅名士', category: 'social', desc: '完整自选国风头像并编辑个性宣言', targetCount: 1, rewardTitle: '风雅雀士', icon: '🪪' },
  { id: 'ach_friends_play', name: '高朋满座', category: 'social', desc: '在好友联机模式下完成 5 场对局', targetCount: 5, rewardTitle: '广结牌友', icon: '🤝' },
] as const;

export interface AchievementProgress {
  achievement: AchievementDef;
  currentCount: number;
  targetCount: number;
  unlocked: boolean;
  progressPercent: number; // 0..100
}

export function evaluateAchievements(
  history: Array<MatchRecord | EnrichedMatchRecord>,
  profile?: { avatar?: string; bio?: string; nickname?: string },
): AchievementProgress[] {
  let totalWins = 0;
  let maxWinStreak = 0;
  let currentStreak = 0;
  let guanMenWins = 0;
  let qiShouGangWins = 0;
  let piaoHunHighHuWins = 0;
  let ziMoWins = 0;
  let danDiaoWins = 0;
  let maxDealerStreak = 0;
  let currentDealerStreak = 0;
  let baoZhuangWins = 0;
  let bigWinMatches = 0;
  let onlineMatches = 0;

  for (const r of history) {
    const isWinner = Boolean(r.myIsWinner);
    const enriched = r as EnrichedMatchRecord;

    if (r.mode === 'online') {
      onlineMatches++;
    }

    if (isWinner) {
      totalWins++;
      currentStreak++;
      if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;

      const myScore = r.scores?.find((s) => s.isWinner || (typeof r.winnerSeat === 'number' && s.seat === r.winnerSeat));
      const wasDealer = Boolean(myScore?.isDealer || (typeof r.dealerMultiplier === 'number' && r.dealerMultiplier > 1));
      if (wasDealer) {
        currentDealerStreak++;
        if (currentDealerStreak > maxDealerStreak) maxDealerStreak = currentDealerStreak;
      } else {
        currentDealerStreak = 0;
      }

      if (enriched.myClosed || r.winType?.includes('关门') || r.scores?.some((s) => s.notes?.some((n) => n.includes('关门')))) {
        guanMenWins++;
      }

      if (r.winType === 'qidong-gang-hu' || r.winType === '起手杠胡') {
        qiShouGangWins++;
      }

      if ((r.hunDi || enriched.myPiaoHun) && (r.hu >= 50 || (r.hu && r.hu >= 50))) {
        piaoHunHighHuWins++;
      }

      if (enriched.selfDraw || r.winType === '自摸' || r.scores?.some((s) => s.notes?.some((n) => n.includes('自摸')))) {
        ziMoWins++;
      }

      if (enriched.myClosed || r.winType?.includes('单钓') || r.scores?.some((s) => s.notes?.some((n) => n.includes('单钓')))) {
        danDiaoWins++;
      }

      if (r.baoZhuang && r.baoZhuang.payerSeat !== r.winnerSeat) {
        baoZhuangWins++;
      }
    } else {
      currentStreak = 0;
      currentDealerStreak = 0;
    }

    const delta = Number.isFinite(r.myDeltaScore)
      ? r.myDeltaScore
      : (Number.isFinite((r as any).scoreDelta) ? (r as any).scoreDelta : 0);
    if (delta >= 400) {
      bigWinMatches++;
    }
  }

  // Profile completeness check
  const hasGuofengAvatar = Boolean(profile?.avatar && isGuofengAvatar(profile.avatar));
  const hasCustomBio = Boolean(
    profile?.bio &&
    profile.bio.trim().length > 0 &&
    profile.bio.trim() !== '不碰坎不上，单钓不换张！',
  );
  const profileCompletedCount = hasGuofengAvatar && hasCustomBio ? 1 : 0;

  return ACHIEVEMENTS_CATALOG.map((def) => {
    let current = 0;
    switch (def.id) {
      case 'ach_first_blood':
        current = totalWins;
        break;
      case 'ach_win_streak_3':
      case 'ach_win_streak_5':
        current = maxWinStreak;
        break;
      case 'ach_matches_50':
        current = history.length;
        break;
      case 'ach_wins_100':
        current = totalWins;
        break;
      case 'ach_guan_men':
        current = guanMenWins;
        break;
      case 'ach_qishou_gang':
        current = qiShouGangWins;
        break;
      case 'ach_piao_hun':
        current = piaoHunHighHuWins;
        break;
      case 'ach_zimo_10':
        current = ziMoWins;
        break;
      case 'ach_dan_diao':
        current = danDiaoWins;
        break;
      case 'ach_dealer_streak_3':
        current = maxDealerStreak;
        break;
      case 'ach_bao_zhuang_win':
        current = baoZhuangWins;
        break;
      case 'ach_big_win':
        current = bigWinMatches;
        break;
      case 'ach_profile_full':
        current = profileCompletedCount;
        break;
      case 'ach_friends_play':
        current = onlineMatches;
        break;
      default:
        current = 0;
    }

    const unlocked = current >= def.targetCount;
    const progressPercent = Math.min(100, Math.floor((Math.min(current, def.targetCount) / def.targetCount) * 100));

    return {
      achievement: def,
      currentCount: current,
      targetCount: def.targetCount,
      unlocked,
      progressPercent,
    };
  });
}

// ─── 4. Career Statistics & Fan Type Distribution ─────────────────────

export interface FanTypeDistribution {
  pingHu: number;        // 平胡 (点炮胡)
  ziMo: number;          // 自摸
  qiShouGangHu: number;  // 起手杠胡
  piaoHun: number;       // 飘荤 (荤底)
  guanMen: number;       // 关门 (两对或单钓锁定)
  baoZhuang: number;     // 胜局包庄
  liuJu: number;         // 流局荒牌
}

export function calculateFanTypeDistribution(records: Array<MatchRecord | EnrichedMatchRecord>): FanTypeDistribution {
  const dist: FanTypeDistribution = {
    pingHu: 0,
    ziMo: 0,
    qiShouGangHu: 0,
    piaoHun: 0,
    guanMen: 0,
    baoZhuang: 0,
    liuJu: 0,
  };

  for (const r of records) {
    const isWinner = Boolean(r.myIsWinner);
    const isLiuju = Boolean(r.liuju);
    const enriched = r as EnrichedMatchRecord;

    if (isLiuju) {
      dist.liuJu++;
      continue;
    }

    if (!isWinner) continue;

    if (r.winType === 'qidong-gang-hu' || r.winType === '起手杠胡') {
      dist.qiShouGangHu++;
      continue;
    }

    let isSpecial = false;

    if (enriched.selfDraw || r.winType === '自摸' || r.scores?.some((s) => s.notes?.some((n) => n.includes('自摸')))) {
      dist.ziMo++;
      isSpecial = true;
    }

    if (enriched.myClosed || r.winType?.includes('关门') || r.scores?.some((s) => s.notes?.some((n) => n.includes('关门')))) {
      dist.guanMen++;
      isSpecial = true;
    }

    if (r.hunDi || enriched.myPiaoHun) {
      dist.piaoHun++;
      isSpecial = true;
    }

    if (r.baoZhuang && r.baoZhuang.payerSeat !== r.winnerSeat) {
      dist.baoZhuang++;
      isSpecial = true;
    }

    if (!isSpecial) {
      dist.pingHu++;
    }
  }

  return dist;
}

export interface EnrichedModeStats extends ModeStats {
  maxWinScore: number;
  fanDistribution: FanTypeDistribution;
  winStreakMax: number;
  currentWinStreak: number;
}

export function calculateCareerStats(records: Array<MatchRecord | EnrichedMatchRecord>): EnrichedModeStats {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalScore = 0;
  let maxHu = 0;
  let maxWinScore = 0;
  let piaoHunCount = 0;
  let baoZhuangCount = 0;
  let winStreakMax = 0;
  let currentWinStreak = 0;

  for (const r of records) {
    const isWinner = Boolean(r.myIsWinner);
    const isLiuju = Boolean(r.liuju);
    const enriched = r as EnrichedMatchRecord;

    if (isWinner) {
      wins++;
      currentWinStreak++;
      if (currentWinStreak > winStreakMax) winStreakMax = currentWinStreak;
    } else if (isLiuju) {
      draws++;
      currentWinStreak = 0;
    } else {
      losses++;
      currentWinStreak = 0;
    }

    const delta = Number.isFinite(r.myDeltaScore)
      ? r.myDeltaScore
      : (Number.isFinite((r as any).scoreDelta) ? (r as any).scoreDelta : 0);
    if (delta !== 0) {
      totalScore += delta;
      if (isWinner && delta > maxWinScore) {
        maxWinScore = delta;
      }
    }

    if (isWinner && Number.isFinite(r.hu) && r.hu > maxHu) {
      maxHu = r.hu;
    }

    if (r.hunDi || enriched.myPiaoHun) {
      piaoHunCount++;
    }

    if (r.baoZhuang) {
      baoZhuangCount++;
    }
  }

  const totalMatches = records.length;
  const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;
  const fanDistribution = calculateFanTypeDistribution(records);

  return {
    totalMatches,
    wins,
    draws,
    losses,
    winRate,
    totalScore,
    maxHu,
    maxWinScore,
    piaoHunCount,
    baoZhuangCount,
    fanDistribution,
    winStreakMax,
    currentWinStreak,
  };
}

import {
  isHonor,
  isYaoJiu,
  type PublicPlayerView,
  type Tile,
} from '@pizhou/shared';


export interface DangerAssessment {
  dangerScore: number;
  reason: string;
}

export interface OpponentThreat {
  seat: number;
  isClosed: boolean;
  isThreePkUnclosed: boolean;
  isFourMeldsSingleWait: boolean;
  threatLevel: 'extreme' | 'high' | 'medium' | 'low';
}

/**
 * Identify the threat level of an opponent in Pizhou Mahjong.
 * - extreme: 3 pk melds unclosed (extreme Baozhuang Xiang risk) or Closed Door (Guanmen / Single Wait).
 * - high: 2+ exposed melds late game.
 * - medium: 1 exposed meld.
 * - low: concealed hand, early game.
 */
export function analyzeOpponentThreat(player: PublicPlayerView): OpponentThreat {
  const exposedCount = player.melds.length;
  const noChi = player.melds.every((m) => m.type !== 'chi');

  // 1. Player has declared Guanmen or is 4-meld single wait (closed === true)
  if (player.closed) {
    return {
      seat: player.seat,
      isClosed: true,
      isThreePkUnclosed: false,
      isFourMeldsSingleWait: exposedCount >= 4,
      threatLevel: 'extreme',
    };
  }

  // 2. 4 melds exposed (single wait tenpai)
  if (exposedCount >= 4) {
    return {
      seat: player.seat,
      isClosed: true,
      isThreePkUnclosed: false,
      isFourMeldsSingleWait: true,
      threatLevel: 'extreme',
    };
  }

  // 3. 3 pk melds (peng/kan/gang, no chi) and hand has 4 or 5 tiles, not closed:
  // Threat of Xiang (包香包庄: raw tile point-cannon triggers all-player payout)
  if (exposedCount === 3 && noChi && player.handCount <= 5) {
    return {
      seat: player.seat,
      isClosed: false,
      isThreePkUnclosed: true,
      isFourMeldsSingleWait: false,
      threatLevel: 'extreme',
    };
  }

  if (exposedCount >= 2) {
    return {
      seat: player.seat,
      isClosed: false,
      isThreePkUnclosed: false,
      isFourMeldsSingleWait: false,
      threatLevel: 'high',
    };
  }

  if (exposedCount === 1) {
    return {
      seat: player.seat,
      isClosed: false,
      isThreePkUnclosed: false,
      isFourMeldsSingleWait: false,
      threatLevel: 'medium',
    };
  }

  return {
    seat: player.seat,
    isClosed: false,
    isThreePkUnclosed: false,
    isFourMeldsSingleWait: false,
    threatLevel: 'low',
  };
}

/**
 * Returns true if any opponent has closed door (closed === true) or 3 pk melds.
 */
export function isTableInHighDefenseState(
  publicViews: PublicPlayerView[],
  excludeSeat?: number,
): boolean {
  for (const player of publicViews) {
    if (excludeSeat !== undefined && player.seat === excludeSeat) continue;
    const threat = analyzeOpponentThreat(player);
    if (threat.threatLevel === 'extreme') return true;
  }
  return false;
}

/**
 * Count total occurrences of a tile key across visible public areas:
 * all discards in the river and all exposed melds.
 */
function countPublicSeen(
  key: string,
  allDiscards: Tile[],
  publicViews: PublicPlayerView[],
): number {
  let seen = 0;
  for (const d of allDiscards) {
    if (d.key === key) seen++;
  }
  for (const p of publicViews) {
    for (const m of p.melds) {
      for (const t of m.tiles) {
        if (t.key === key) seen++;
      }
    }
  }
  return seen;
}

/**
 * Check if a numbered tile is Suji (筋牌) with respect to an opponent's discards.
 * In Mahjong, if 4 is discarded, 1 and 7 have lower two-sided wait probability.
 * If 5 is discarded, 2 and 8 are Suji.
 * If 6 is discarded, 3 and 9 are Suji.
 */
function isSujiAgainst(tile: Tile, opponentDiscards: Tile[]): boolean {
  if (tile.suit === 'dragon') return false;
  const oppRanks = new Set(
    opponentDiscards
      .filter((d) => d.suit === tile.suit)
      .map((d) => d.rank),
  );
  if (tile.rank === 1 || tile.rank === 7) return oppRanks.has(4);
  if (tile.rank === 2 || tile.rank === 8) return oppRanks.has(5);
  if (tile.rank === 3 || tile.rank === 9) return oppRanks.has(6);
  if (tile.rank === 4) return oppRanks.has(1) && oppRanks.has(7);
  if (tile.rank === 5) return oppRanks.has(2) && oppRanks.has(8);
  if (tile.rank === 6) return oppRanks.has(3) && oppRanks.has(9);
  return false;
}

/**
 * Evaluates the discard danger of a specific tile against all other players.
 * Danger score ranges from 0 (100% safe: genbutsu / 4-seen) to 100 (extreme danger: fresh raw tile against 3-meld incense or closed door).
 *
 * @param tile The candidate tile to discard
 * @param publicViews Public player views of opponents (or all players)
 * @param allDiscards All discards on the table (river)
 */
export function assessDiscardDanger(
  tile: Tile,
  publicViews: PublicPlayerView[],
  allDiscards: Tile[],
): DangerAssessment {
  const totalSeen = countPublicSeen(tile.key, allDiscards, publicViews);
  const inRiver = allDiscards.some((d) => d.key === tile.key);

  // 1. 4-Seen (绝张): All 4 copies are accounted for. Absolutely safe against everyone!
  if (totalSeen >= 4) {
    return {
      dangerScore: 0,
      reason: '绝张全见4张，绝对安全',
    };
  }

  let maxDanger = 0;
  let dominantReason = '常规出牌，安全度良好';

  for (const opp of publicViews) {
    const threat = analyzeOpponentThreat(opp);
    const isGenbutsu = opp.discards.some((d) => d.key === tile.key);

    // Genbutsu (现物): Opponent discarded this tile themselves.
    if (isGenbutsu) {
      // 0 danger against this opponent
      continue;
    }

    let oppDanger = 0;
    let oppReason = '';

    if (threat.threatLevel === 'extreme') {
      // Threat 1: 3-meld incense (三碰香牌) unclosed -> Baozhuang Xiang risk!
      if (threat.isThreePkUnclosed) {
        if (!inRiver) {
          // Fresh raw tile (香牌): If opponent hits, triggers 包香 (一人全包整桌三家输分)!
          oppDanger = 100;
          oppReason = `致命生张香牌！防范座位 ${opp.seat} 三碰包香包庄`;
        } else if (totalSeen >= 3) {
          oppDanger = 0; // Cannot hold pair if 3 seen
          oppReason = `臭牌已见3张，座位 ${opp.seat} 无法成对`;
        } else {
          // Seen in river (臭牌): Exempt from 包香 by rule
          oppDanger = 20;
          oppReason = `牌河已见臭牌，免除座位 ${opp.seat} 包香风险`;
        }
      } else if (threat.isClosed) {
        // Threat 2: Closed Door (关门听牌) or 4-meld single wait
        if (totalSeen >= 3) {
          oppDanger = 8;
          oppReason = `多见张（已见3张），对关门座位 ${opp.seat} 极低危险`;
        } else if (inRiver) {
          // Seen in river before, but opponent hasn't discarded it
          const suji = isSujiAgainst(tile, opp.discards);
          oppDanger = suji ? 25 : 40;
          oppReason = suji
            ? `筋牌半熟张，防守关门座位 ${opp.seat}`
            : `牌河已见半熟张，防守关门座位 ${opp.seat}`;
        } else {
          // Fresh raw tile (生张) against closed door opponent
          if (isHonor(tile)) {
            oppDanger = 92;
            oppReason = `未见生字牌！严防关门座位 ${opp.seat} 捉铳`;
          } else if (isYaoJiu(tile)) {
            oppDanger = 78;
            oppReason = `未见幺九生张！严防关门座位 ${opp.seat} 捉铳`;
          } else {
            const suji = isSujiAgainst(tile, opp.discards);
            oppDanger = suji ? 60 : 88;
            oppReason = suji
              ? `生张筋牌，对关门座位 ${opp.seat} 存在危险`
              : `中张危险生张！严防关门座位 ${opp.seat} 捉铳`;
          }
        }
      }
    } else if (threat.threatLevel === 'high') {
      // 2 exposed melds
      if (inRiver || totalSeen >= 3) {
        oppDanger = 12;
        oppReason = `熟张，对高副露对手安全`;
      } else {
        oppDanger = isHonor(tile) ? 45 : 35;
        oppReason = `生张，防范高副露对手`;
      }
    } else {
      // Normal early/mid-game
      if (inRiver || totalSeen >= 3) {
        oppDanger = 5;
        oppReason = `熟张安全牌`;
      } else {
        oppDanger = isHonor(tile) ? 20 : 15;
        oppReason = `普通生张`;
      }
    }

    if (oppDanger > maxDanger) {
      maxDanger = oppDanger;
      dominantReason = oppReason;
    }
  }

  // Clamp danger score to [0, 100]
  const finalScore = Math.max(0, Math.min(100, Math.round(maxDanger)));
  return {
    dangerScore: finalScore,
    reason: finalScore === 0 ? '安全牌（现物/绝张）' : dominantReason,
  };
}

/**
 * Convenience helper to assess danger scores for all tiles in hand.
 */
export function assessHandDefense(
  hand: Tile[],
  publicViews: PublicPlayerView[],
  allDiscards: Tile[],
): Array<{ tile: Tile; dangerScore: number; reason: string }> {
  return hand.map((tile) => {
    const evalRes = assessDiscardDanger(tile, publicViews, allDiscards);
    return {
      tile,
      dangerScore: evalRes.dangerScore,
      reason: evalRes.reason,
    };
  });
}

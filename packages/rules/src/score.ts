import {
  BASE_HU,
  HUN_DI,
  HU_RATE,
  YAO_RATE,
  isYaoJiu,
  parseKey,
  tileLabel,
  type BaoZhuang,
  type BaoZhuangReason,
  type Meld,
  type PairwiseTransaction,
  type ScoreBreakdownItem,
  type Settlement,
  type SettlementScore,
  type WinType,
} from '@pizhou/shared';
import { findWinDecompositions, type WinDecomp } from './win.ts';

export type UnitKind = 'pair' | 'peng' | 'pung' | 'song_kong' | 'zi_kong';

export interface ScoreResult {
  hu: number;
  huBeforeDealer: number;
  yao: number;
  dealerMultiplier: number;
  breakdown: ScoreBreakdownItem[];
  decomp: WinDecomp;
  winType: WinType;
}

export interface SeatScoreInput {
  hand: Array<{ key: string; id?: string }>;
  exposed: Meld[];
  /** 点炮胡进来的牌只用于组成胡牌，不得把手里的对子升级为坎。 */
  winningDiscardId?: string;
  /** 自摸胡时用于识别摸进来的牌补成的坎；其它合法暗坎也照常查胡。 */
  winningTileId?: string;
  changed?: boolean;
  /** 四组单钓后是否换过等牌；只用于“不换张”包庄条件，不改变关门状态。 */
  singleWaitChanged?: boolean;
  closedTwoPair?: boolean;
  discardedBeforeClose?: string[];
}

export interface SeatScore {
  seat: number;
  /** 牌面基础胡数；不包含飘荤或庄家结算倍数。 */
  hu: number;
  /** 历史字段名，现表示结算倍数前的牌面胡数。 */
  huBeforeDealer: number;
  yao: number;
  fen: number;
  isWinner: boolean;
  isDealer: boolean;
  piaoHun: boolean;
  units: Array<{ key: string; kind: UnitKind }>;
  notes: string[];
  breakdown: ScoreBreakdownItem[];
  decomp: WinDecomp;
}

/**
 * 本房规则：飘荤先把飘荤者本人的牌面胡数乘 2；庄家不改自己的牌面胡数，
 * 而是在两家查胡时把涉及庄家的胡差整体乘 2。幺差和荤底不走这里。
 */
function piaoHuMultiplierForSeat(score: SeatScore): number {
  return score.piaoHun ? 2 : 1;
}

export interface ChaHuResult {
  seats: SeatScore[];
  deltas: number[];
  transactions: PairwiseTransaction[];
  receivables: number[];
  payables: number[];
  baoZhuang: BaoZhuang | null;
  hunDi: boolean;
  openingGang: boolean;
  drawReason: string | null;
}

const KIND_CN: Record<UnitKind, string> = {
  pair: '对',
  peng: '碰',
  pung: '坎',
  song_kong: '送杠',
  zi_kong: '自杠',
};

export function finalPoints(hu: number, yao: number): number {
  return hu * HU_RATE + yao * YAO_RATE;
}

export function nextDealer(
  currentDealer: number,
  winnerSeat: number | null,
  liuju: boolean,
  _drawReason?: string | null,
): number {
  // 公开规则写明“从第二局起，如果不是庄家胡牌，则轮庄”。
  // 项目据此采用：只有庄家实际胡牌才连庄，闲家胡或流局都换到下一家。
  if (!liuju && winnerSeat === currentDealer) return currentDealer;
  return (currentDealer + 1) % 4;
}

export function unitValue(key: string, kind: UnitKind): { hu: number; yao: number } {
  const yaoTou = isYaoJiu(key);
  const table: Record<`${UnitKind}:${'yao' | 'plain'}`, { hu: number; yao: number }> = {
    'pair:yao': { hu: 2, yao: 0 },
    'pair:plain': { hu: 1, yao: 0 },
    'peng:yao': { hu: 2, yao: 0 },
    'peng:plain': { hu: 1, yao: 0 },
    'pung:yao': { hu: 4, yao: 1 },
    'pung:plain': { hu: 2, yao: 0 },
    'song_kong:yao': { hu: 8, yao: 2 },
    'song_kong:plain': { hu: 4, yao: 0 },
    'zi_kong:yao': { hu: 12, yao: 3 },
    'zi_kong:plain': { hu: 6, yao: 0 },
  };
  return table[`${kind}:${yaoTou ? 'yao' : 'plain'}`];
}

export function canFormSequence(a: string, b: string): boolean {
  const pa = parseKey(a);
  const pb = parseKey(b);
  if (pa.suit === 'dragon' || pb.suit === 'dragon') return false;
  if (pa.suit !== pb.suit) return false;
  const gap = Math.abs(pa.rank - pb.rank);
  return gap === 1 || gap === 2;
}

export function hasOpeningKong(hand: Array<{ key: string }>): string | null {
  const counts: Record<string, number> = {};
  for (const tile of hand) counts[tile.key] = (counts[tile.key] ?? 0) + 1;
  for (const [key, count] of Object.entries(counts)) {
    if ((count ?? 0) >= 4) return key;
  }
  return null;
}

function meldKind(meld: Meld): UnitKind | null {
  if (meld.type === 'chi') return null;
  if (meld.type === 'peng') return 'peng';
  if (meld.type === 'kan') return 'pung';
  if (meld.type === 'ming-gang') return 'song_kong';
  if (meld.type === 'an-gang' || meld.type === 'zi-gang') return 'zi_kong';
  return null;
}

function countKeys(hand: Array<{ key: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tile of hand) counts[tile.key] = (counts[tile.key] ?? 0) + 1;
  return counts;
}

/**
 * 飘荤判断要看“胡前一张”：
 * 四组牌剩一张，或三组牌剩两对，都是关门/飘荤的等牌状态。
 * 结算传入的手牌已经包含胡进来的那张，不能直接拿完成牌型判断。
 */
function handBeforeWinningTile(input: Pick<SeatScoreInput, 'hand' | 'winningDiscardId' | 'winningTileId'>): Array<{ key: string; id?: string }> {
  const winningId = input.winningDiscardId ?? input.winningTileId;
  if (!winningId) return input.hand;
  const index = input.hand.findIndex((tile) => tile.id === winningId);
  if (index < 0) return input.hand;
  return input.hand.filter((_, tileIndex) => tileIndex !== index);
}

function exposedUnits(exposed: Meld[]): Array<{ key: string; kind: UnitKind }> {
  const units: Array<{ key: string; kind: UnitKind }> = [];
  for (const meld of exposed) {
    const kind = meldKind(meld);
    const key = meld.tiles[0]?.key;
    if (kind && key) units.push({ key, kind });
  }
  return units;
}

/**
 * 按相同张数查胡。起手杠胡时四张按自杠；普通局未声明的四张只形成一坎，
 * 不会在结算时追认成自杠。相同牌组之间互不复用。
 */
function countBasedUnits(
  hand: Array<{ key: string }>,
  options: { pungs: boolean; pairs: boolean; selfKongs: boolean },
): Array<{ key: string; kind: UnitKind }> {
  const units: Array<{ key: string; kind: UnitKind }> = [];
  for (const [key, raw] of Object.entries(countKeys(hand))) {
    let n = raw ?? 0;
    if (n >= 4 && options.selfKongs) {
      units.push({ key, kind: 'zi_kong' });
      n -= 4;
    }
    if (n >= 3 && options.pungs) {
      units.push({ key, kind: 'pung' });
      n -= 3;
    }
    if (n >= 2 && options.pairs) {
      units.push({ key, kind: 'pair' });
    }
  }
  return units;
}

function decompPoints(
  decomp: WinDecomp,
  winningKey?: string,
  winningCompletesPung = false,
  winningFromDiscard = false,
): number {
  const pair = unitValue(decomp.pairKey, 'pair');
  let hu = pair.hu;
  let yao = pair.yao;
  for (const meld of decomp.melds) {
    if (meld.type !== 'pung') continue;
    const kind: UnitKind = winningCompletesPung && meld.key === winningKey && winningFromDiscard
      ? 'peng'
      : 'pung';
    const value = unitValue(meld.key, kind);
    hu += value.hu;
    yao += value.yao;
  }
  return finalPoints(hu, yao);
}

function pickWinDecomp(
  decomps: WinDecomp[],
  winningKey?: string,
  preferWinningPung = false,
  winningFromDiscard = false,
): WinDecomp {
  return decomps.reduce((best, item) => {
    // 先选实际结算分更高的合法拆法；最后一张的落位只用于同分拆法的稳定裁决。
    const itemPoints = decompPoints(item, winningKey, preferWinningPung, winningFromDiscard);
    const bestPoints = decompPoints(best, winningKey, preferWinningPung, winningFromDiscard);
    if (itemPoints !== bestPoints) return itemPoints > bestPoints ? item : best;

    if (winningKey) {
      const itemHasWinningPung = item.melds.some((meld) => meld.type === 'pung' && meld.key === winningKey);
      const bestHasWinningPung = best.melds.some((meld) => meld.type === 'pung' && meld.key === winningKey);
      if (preferWinningPung && itemHasWinningPung !== bestHasWinningPung) {
        return itemHasWinningPung ? item : best;
      }
      // 如果最后一张是将牌，优先保留它作为将牌。
      if (!preferWinningPung) {
        if (item.pairKey === winningKey && best.pairKey !== winningKey) return item;
        if (best.pairKey === winningKey && item.pairKey !== winningKey) return best;
      }
    }
    const pungs = item.melds.filter((meld) => meld.type === 'pung').length;
    const bestPungs = best.melds.filter((meld) => meld.type === 'pung').length;
    return pungs > bestPungs ? item : best;
  });
}

interface ScoringDecomp {
  decomp: WinDecomp;
  winningKey?: string;
  winningCompletesPung: boolean;
}

function selectScoringDecomp(
  hand: Array<{ key: string; id?: string }>,
  exposedCount: number,
  winningDiscardId?: string,
  winningTileId?: string,
): ScoringDecomp | null {
  const needMelds = 4 - exposedCount;
  let decomps = findWinDecompositions(hand).filter((item) => item.melds.length === needMelds);
  if (decomps.length === 0) decomps = findWinDecompositions(hand);
  if (decomps.length === 0) return null;

  const winningId = winningDiscardId ?? winningTileId;
  const winningKey = winningId
    ? hand.find((tile) => tile.id === winningId)?.key
    : undefined;
  const beforeWin = winningId
    ? hand.filter((tile) => tile.id !== winningId)
    : hand;
  const countsBefore = countKeys(beforeWin);
  const winningCompletesPung = Boolean(
    winningKey && (countsBefore[winningKey] ?? 0) === 2,
  );
  return {
    decomp: pickWinDecomp(
      decomps,
      winningKey,
      winningCompletesPung,
      Boolean(winningDiscardId),
    ),
    winningKey,
    winningCompletesPung,
  };
}

/**
 * 当前项目采用的查胡拆牌：
 * - 吃/顺子不计胡
 * - 普通对子1胡，幺头对子2胡
 * - 别人打出来碰的（明碰）普通1胡，幺牌2胡
 * - 暗手里的坎（包括已“坎上”的牌）普通2胡，幺牌4胡1幺
 * - 送杠（明杠）普通4胡，幺牌8胡2幺
 * - 自杠（暗杠）普通6胡，幺牌12胡3幺
 * - 没胡的人也查手里的对子与坎；吃、顺子和单张不计
 * - 双碰点炮时，点炮形成的三张算碰，留下的对子照常计胡
 * - 双碰自摸时，自摸形成的三张算坎，留下的对子照常计胡
 * - 单钓补成的最后对子照常计对子胡，并另加胡牌基础10胡
 */
export function extractUnits(
  hand: Array<{ key: string; id?: string }>,
  exposed: Meld[],
  isWinner = false,
  winningDiscardId?: string,
  winningTileId?: string,
  winType?: WinType,
): Array<{ key: string; kind: UnitKind }> {
  const units = exposedUnits(exposed);

  if (!isWinner) {
    // 查胡是四家分别开算：没胡的人手里的对子、暗坎也要计入。
    units.push(...countBasedUnits(hand, { pungs: true, pairs: true, selfKongs: false }));
    return units;
  }

  if (winType === 'qidong-gang-hu') {
    units.push(...countBasedUnits(hand, { pungs: true, pairs: true, selfKongs: true }));
    return units;
  }

  const selected = selectScoringDecomp(
    hand,
    exposed.length,
    winningDiscardId,
    winningTileId,
  );
  if (!selected) {
    units.push(...countBasedUnits(hand, { pungs: true, pairs: true, selfKongs: false }));
    return units;
  }
  const { decomp, winningKey, winningCompletesPung } = selected;
  units.push({ key: decomp.pairKey, kind: 'pair' });
  for (const meld of decomp.melds) {
    if (meld.type !== 'pung') continue;
    const completedByWinningTile = winningCompletesPung && meld.key === winningKey;
    units.push({
      key: meld.key,
      kind: completedByWinningTile && winningDiscardId ? 'peng' : 'pung',
    });
  }
  return units;
}

export function countPk(_hand: Array<{ key: string }>, exposed: Meld[]): {
  pk: number;
  chow: number;
} {
  let pk = 0;
  let chow = 0;
  for (const meld of exposed) {
    if (meld.type === 'chi') chow += 1;
    else if (meldKind(meld)) pk += 1;
  }
  // 未主动“坎上”的三张仍可拆打，不进入坎数、飘荤或包庄判断。
  return { pk, chow };
}

export function isPiaoHun(hand: Array<{ key: string }>, exposed: Meld[]): boolean {
  const { pk, chow } = countPk(hand, exposed);
  // 飘荤要求成组部分是碰、坎或杠；含吃的四组牌走普通胡/吃牌听顺口径。
  if (chow > 0) return false;
  const totalPk = pk;
  const pairs = Object.values(countKeys(hand)).filter((n) => n === 2).length;
  if (totalPk === 4 && hand.length === 1) return true;
  if (totalPk === 3 && pairs === 2 && hand.length === 4) return true;
  return false;
}

function handBeforeRon(hand: Array<{ key: string }>, discardKey: string): Array<{ key: string }> | null {
  const index = hand.findIndex((tile) => tile.key === discardKey);
  if (index < 0) return null;
  return hand.filter((_, i) => i !== index);
}

export interface BaoZhuangCheckInput {
  hand: Array<{ key: string }>;
  exposed: Meld[];
  ron: boolean;
  discardKey?: string | null;
  /** 四组单钓后换过等牌时，不满足公开规则要求的“不换张”。 */
  singleWaitChanged?: boolean;
  closedTwoPair?: boolean;
  discardedBeforeClose?: string[];
}

export function detectBaoZhuang(input: BaoZhuangCheckInput): BaoZhuangReason | null {
  const discardKey = input.discardKey;
  if (!input.ron || !discardKey) return null;
  const waitHand = handBeforeRon(input.hand, discardKey);
  if (!waitHand) return null;
  const { pk, chow } = countPk(waitHand, input.exposed);
  const totalPk = pk;
  const pairs = Object.values(countKeys(waitHand)).filter((n) => n === 2).length;
  const waitKey = waitHand[0]?.key;

  if (!input.singleWaitChanged && totalPk === 4 && chow === 0 && waitHand.length === 1 && waitKey) {
    if (canFormSequence(waitKey, discardKey)) return 'four_wait_seq';
  }
  if (!input.singleWaitChanged && (totalPk + chow === 4) && chow >= 1 && waitHand.length === 1 && waitKey) {
    if (canFormSequence(waitKey, discardKey)) return 'chow_wait_seq';
  }
  if (totalPk === 3 && chow === 0 && pairs === 2 && waitHand.length === 4) {
    // 公开邳州规则明确“两对关门玩家不受包香规则限制”——
    // 包香只适用于尚未选择两对关门、仍以两对等牌的玩家。
    if (input.closedTwoPair) return null;
    if (!(input.discardedBeforeClose ?? []).includes(discardKey)) return 'xiang';
  }
  return null;
}

/**
 * 四组单钓听顺和带吃单钓听顺是邳州麻将的特殊点炮胡入口，
 * 它们不满足大众麻将“一对将牌”的普通胡牌结构，但仍必须给出“胡”。
 */
export function isSpecialBaoZhuangHu(input: BaoZhuangCheckInput): boolean {
  const reason = detectBaoZhuang(input);
  return reason === 'four_wait_seq' || reason === 'chow_wait_seq';
}

function describeUnit(key: string, kind: UnitKind): ScoreBreakdownItem {
  const value = unitValue(key, kind);
  return {
    label: `${tileLabel(key)}${KIND_CN[kind]}`,
    hu: value.hu,
    yao: value.yao,
  };
}

export function scoreSeat(input: {
  seat: number;
  hand: Array<{ key: string; id?: string }>;
  exposed: Meld[];
  winningDiscardId?: string;
  winningTileId?: string;
  isWinner: boolean;
  isDealer: boolean;
  forcePiaoHun?: boolean;
  winType?: WinType;
}): SeatScore {
  const units = extractUnits(
    input.hand,
    input.exposed,
    input.isWinner,
    input.winningDiscardId,
    input.winningTileId,
    input.winType,
  );
  const breakdown: ScoreBreakdownItem[] = [];
  let hu = 0;
  let yao = 0;
  for (const unit of units) {
    const value = unitValue(unit.key, unit.kind);
    hu += value.hu;
    yao += value.yao;
    if (value.hu > 0 || value.yao > 0) {
      breakdown.push(describeUnit(unit.key, unit.kind));
    }
  }

  const notes = breakdown.map((item) => `${item.label}+${item.hu}胡${item.yao ? `+${item.yao}幺` : ''}`);
  const waitingHand = handBeforeWinningTile(input);
  const piao = Boolean(input.forcePiaoHun || (input.isWinner && isPiaoHun(waitingHand, input.exposed)));

  if (input.isWinner) {
    hu += BASE_HU;
    breakdown.unshift({ label: input.winType === 'qidong-gang-hu' ? '起手杠胡' : '胡牌', hu: BASE_HU, yao: 0 });
    notes.push('胡牌+10胡');
    if (piao) {
      notes.push('飘荤（先将本人牌面胡数×2，再查胡）');
    }
  }
  if (input.isDealer) {
    notes.push('庄家（涉及本人的两两胡差×2）');
  }

  if (notes.length === 0) {
    notes.push('0胡0幺');
  }

  const huBeforeDealer = hu;

  const decomp = input.isWinner
    ? (selectScoringDecomp(
        input.hand,
        input.exposed.length,
        input.winningDiscardId,
        input.winningTileId,
      )?.decomp ?? { pairKey: 'wan-5', melds: [] })
    : { pairKey: 'wan-5', melds: [] };

  return {
    seat: input.seat,
    hu,
    huBeforeDealer,
    yao,
    fen: finalPoints(hu, yao),
    isWinner: input.isWinner,
    isDealer: input.isDealer,
    piaoHun: piao,
    units,
    notes,
    breakdown,
    decomp,
  };
}

export function settleChaHu(input: {
  seats: SeatScoreInput[];
  winnerSeat: number | null;
  dealer: number;
  ron?: boolean;
  discardKey?: string | null;
  discarderSeat?: number | null;
  openingGang?: boolean;
  drawReason?: string | null;
  winType?: WinType;
}): ChaHuResult {
  if (input.drawReason) {
    return {
      seats: input.seats.map((_, seat) => ({
        seat,
        hu: 0,
        huBeforeDealer: 0,
        yao: 0,
        fen: 0,
        isWinner: false,
        isDealer: seat === input.dealer,
        piaoHun: false,
        units: [],
        notes: [],
        breakdown: [],
        decomp: { pairKey: 'wan-5', melds: [] },
      })),
      deltas: [0, 0, 0, 0],
      transactions: [],
      receivables: [0, 0, 0, 0],
      payables: [0, 0, 0, 0],
      baoZhuang: null,
      hunDi: false,
      openingGang: false,
      drawReason: input.drawReason,
    };
  }

  let baoReason: BaoZhuangReason | null = null;
  let forcePiao = false;
  if (input.winnerSeat !== null) {
    const winner = input.seats[input.winnerSeat]!;
    const waitingHand = handBeforeWinningTile(winner);
    baoReason = detectBaoZhuang({
      hand: winner.hand,
      exposed: winner.exposed,
      ron: Boolean(input.ron),
      discardKey: input.discardKey,
      singleWaitChanged: winner.singleWaitChanged,
      closedTwoPair: winner.closedTwoPair,
      discardedBeforeClose: winner.discardedBeforeClose,
    });
    // 关门不加胡，但三组两对/四组单钓的胡牌仍然按等牌状态飘荤；
    // 包庄识别只负责决定是否包香，不应替代飘荤判断。
    if (isPiaoHun(waitingHand, winner.exposed)
      || baoReason === 'four_wait_seq'
      || baoReason === 'xiang') {
      forcePiao = true;
    }
  }

  const seats = input.seats.map((seat, index) => scoreSeat({
    seat: index,
    hand: seat.hand,
    exposed: seat.exposed,
    winningDiscardId: seat.winningDiscardId,
    winningTileId: seat.winningTileId,
    isWinner: index === input.winnerSeat,
    isDealer: index === input.dealer,
    forcePiaoHun: forcePiao && index === input.winnerSeat,
    winType: input.winType,
  }));

  const deltas = [0, 0, 0, 0];
  const receivables = [0, 0, 0, 0];
  const payables = [0, 0, 0, 0];
  const transactions: PairwiseTransaction[] = [];

  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const isDealerPair = i === input.dealer || j === input.dealer;
      const huMultiplierA = piaoHuMultiplierForSeat(seats[i]!);
      const huMultiplierB = piaoHuMultiplierForSeat(seats[j]!);
      const effectiveHuA = seats[i]!.hu * huMultiplierA;
      const effectiveHuB = seats[j]!.hu * huMultiplierB;
      const diffHuBeforeDealer = effectiveHuA - effectiveHuB;
      const diffHu = diffHuBeforeDealer * (isDealerPair ? 2 : 1);
      const diffYao = seats[i]!.yao - seats[j]!.yao;
      const pairPoints = diffHu * HU_RATE + diffYao * YAO_RATE;

      deltas[i] += pairPoints;
      deltas[j] -= pairPoints;

      if (pairPoints > 0) {
        receivables[i] += pairPoints;
        payables[j] += pairPoints;
      } else if (pairPoints < 0) {
        payables[i] += Math.abs(pairPoints);
        receivables[j] += Math.abs(pairPoints);
      }

      transactions.push({
        seatA: i,
        seatB: j,
        huA: seats[i]!.hu,
        huB: seats[j]!.hu,
        yaoA: seats[i]!.yao,
        yaoB: seats[j]!.yao,
        huMultiplierA,
        huMultiplierB,
        effectiveHuA,
        effectiveHuB,
        isDealerPair,
        deltaHu: diffHu,
        deltaYao: diffYao,
        points: pairPoints,
      });
    }
  }

  const hunDi = input.winnerSeat !== null && seats[input.winnerSeat]!.piaoHun;
  let baoZhuang: BaoZhuang | null = null;
  if (baoReason && input.discarderSeat !== null && input.discarderSeat !== undefined && input.winnerSeat !== null) {
    baoZhuang = { reason: baoReason, payerSeat: input.discarderSeat, winnerSeat: input.winnerSeat };
  }

  if (hunDi && input.winnerSeat !== null) {
    if (!baoZhuang) {
      for (let seat = 0; seat < 4; seat += 1) {
        if (seat === input.winnerSeat) continue;
        deltas[input.winnerSeat] += HUN_DI;
        deltas[seat] -= HUN_DI;
        receivables[input.winnerSeat] += HUN_DI;
        payables[seat] += HUN_DI;
      }
    }
  }

  if (baoZhuang && input.winnerSeat !== null) {
    const winnerSeat = input.winnerSeat;
    const pack = baoZhuang.payerSeat;
    const winnerSeatObj = seats[winnerSeat]!;
    const huMultiplierWinner = piaoHuMultiplierForSeat(winnerSeatObj);
    const effectiveHuWinner = winnerSeatObj.hu * huMultiplierWinner;
    let totalWin = 0;

    // Reset all deltas & transactions for clean 100% bao-zhuang transfer
    for (let s = 0; s < 4; s += 1) {
      deltas[s] = 0;
      receivables[s] = 0;
      payables[s] = 0;
    }

    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === winnerSeat) continue;
      const opponent = seats[seat]!;
      const huMultiplierOpp = piaoHuMultiplierForSeat(opponent);
      const effectiveHuOpp = opponent.hu * huMultiplierOpp;
      const diffHuBeforeDealer = effectiveHuWinner - effectiveHuOpp;
      const diffHu = diffHuBeforeDealer * (winnerSeat === input.dealer || seat === input.dealer ? 2 : 1);
      const diffYao = winnerSeatObj.yao - opponent.yao;
      const pairPoints = diffHu * HU_RATE + diffYao * YAO_RATE;

      const seatGain = Math.max(0, pairPoints) + (hunDi ? HUN_DI : 0);
      totalWin += seatGain;
    }

    deltas[winnerSeat] = totalWin;
    receivables[winnerSeat] = totalWin;
    payables[winnerSeat] = 0;

    deltas[pack] = -totalWin;
    payables[pack] = totalWin;
    receivables[pack] = 0;

    for (let seat = 0; seat < 4; seat += 1) {
      if (seat !== winnerSeat && seat !== pack) {
        deltas[seat] = 0;
        receivables[seat] = 0;
        payables[seat] = 0;
      }
    }
  }

  return {
    seats,
    deltas,
    transactions,
    receivables,
    payables,
    baoZhuang,
    hunDi,
    openingGang: Boolean(input.openingGang),
    drawReason: null,
  };
}

export function toSettlement(
  result: ChaHuResult,
  extra: {
    winType: WinType;
    selfDraw: boolean;
    winnerNickname?: string | null;
  },
): Settlement {
  const winner = extra.winType === 'liuju' ? null : result.seats.find((seat) => seat.isWinner) ?? null;
  const scores: SettlementScore[] = result.seats.map((seat) => ({
    seat: seat.seat,
    nickname: '',
    hu: seat.hu,
    yao: seat.yao,
    fen: seat.fen,
    delta: result.deltas[seat.seat] ?? 0,
    total: 0,
    piaoHun: seat.piaoHun,
    isWinner: seat.isWinner,
    isDealer: seat.isDealer,
    notes: seat.notes,
    receivable: result.receivables[seat.seat] ?? 0,
    payable: result.payables[seat.seat] ?? 0,
  }));
  return {
    liuju: extra.winType === 'liuju',
    winnerSeat: winner?.seat ?? null,
    winnerNickname: extra.winnerNickname ?? null,
    winType: extra.winType,
    hu: winner?.hu ?? 0,
    huBeforeDealer: winner?.huBeforeDealer ?? 0,
    yao: winner?.yao ?? 0,
    dealerMultiplier: winner?.isDealer ? 2 : 1,
    selfDraw: extra.selfDraw,
    breakdown: winner?.breakdown ?? [],
    scores,
    transactions: result.transactions,
    hunDi: result.hunDi,
    baoZhuang: result.baoZhuang,
    drawReason: result.drawReason,
  };
}

export function scoreQidongGangHu(hand: Array<{ key: string }>, isDealer: boolean): ScoreResult {
  const scored = scoreSeat({
    seat: 0,
    hand,
    exposed: [],
    isWinner: true,
    isDealer,
    winType: 'qidong-gang-hu',
  });
  return {
    hu: scored.hu,
    huBeforeDealer: scored.huBeforeDealer,
    yao: scored.yao,
    dealerMultiplier: isDealer ? 2 : 1,
    breakdown: scored.breakdown,
    decomp: scored.decomp,
    winType: 'qidong-gang-hu',
  };
}

export function scoreWin(input: {
  concealed: Array<{ key: string }>;
  exposed: Meld[];
  isDealer: boolean;
  winType: WinType;
  winningTileId?: string;
}): ScoreResult | null {
  const needMelds = 4 - input.exposed.length;
  const decomps = findWinDecompositions(input.concealed).filter((item) => item.melds.length === needMelds);
  if (input.winType !== 'qidong-gang-hu' && decomps.length === 0) return null;
  const scored = scoreSeat({
    seat: 0,
    hand: input.concealed,
    exposed: input.exposed,
    isWinner: true,
    isDealer: input.isDealer,
    forcePiaoHun: input.winType !== 'qidong-gang-hu'
      && isPiaoHun(
        handBeforeWinningTile({ hand: input.concealed, winningTileId: input.winningTileId }),
        input.exposed,
      ),
    winningTileId: input.winningTileId,
    winType: input.winType,
  });
  return {
    hu: scored.hu,
    huBeforeDealer: scored.huBeforeDealer,
    yao: scored.yao,
    dealerMultiplier: input.isDealer ? 2 : 1,
    breakdown: scored.breakdown,
    decomp: scored.decomp,
    winType: input.winType,
  };
}

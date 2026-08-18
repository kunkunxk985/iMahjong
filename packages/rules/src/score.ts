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
  type ScoreBreakdownItem,
  type Settlement,
  type SettlementScore,
  type WinType,
} from '@pizhou/shared';
import { findWinDecompositions, type WinDecomp } from './win.ts';

export type UnitKind = 'pair' | 'pung' | 'song_kong' | 'zi_kong';

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
  hand: Array<{ key: string }>;
  exposed: Meld[];
  changed?: boolean;
  closedTwoPair?: boolean;
  discardedBeforeClose?: string[];
}

export interface SeatScore {
  seat: number;
  hu: number;
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

export interface ChaHuResult {
  seats: SeatScore[];
  deltas: number[];
  baoZhuang: BaoZhuang | null;
  hunDi: boolean;
  openingGang: boolean;
  drawReason: string | null;
}

const KIND_CN: Record<UnitKind, string> = {
  pair: '对',
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
  drawReason?: string | null,
): number {
  if (drawReason === 'four_same') return (currentDealer + 1) % 4;
  if (liuju || winnerSeat === null || winnerSeat === currentDealer) return currentDealer;
  return (currentDealer + 1) % 4;
}

export function unitValue(key: string, kind: UnitKind): { hu: number; yao: number } {
  const yaoTou = isYaoJiu(key);
  const table: Record<`${UnitKind}:${'yao' | 'plain'}`, { hu: number; yao: number }> = {
    'pair:yao': { hu: 2, yao: 0 },
    'pung:yao': { hu: 4, yao: 1 },
    'song_kong:yao': { hu: 8, yao: 2 },
    'zi_kong:yao': { hu: 12, yao: 3 },
    'pair:plain': { hu: 1, yao: 0 },
    'pung:plain': { hu: 2, yao: 0 },
    'song_kong:plain': { hu: 4, yao: 0 },
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
  if (meld.type === 'peng') return 'pung';
  if (meld.type === 'ming-gang') return 'song_kong';
  if (meld.type === 'an-gang' || meld.type === 'bu-gang') return 'zi_kong';
  return null;
}

function countKeys(hand: Array<{ key: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tile of hand) counts[tile.key] = (counts[tile.key] ?? 0) + 1;
  return counts;
}

export function extractUnits(
  hand: Array<{ key: string }>,
  exposed: Meld[],
  isWinner = false,
): Array<{ key: string; kind: UnitKind }> {
  const units: Array<{ key: string; kind: UnitKind }> = [];
  for (const meld of exposed) {
    const kind = meldKind(meld);
    const key = meld.tiles[0]?.key;
    if (kind && key) units.push({ key, kind });
  }

  const counts = countKeys(hand);
  if (isWinner) {
    const needMelds = 4 - exposed.length;
    const decomps = findWinDecompositions(hand).filter((item) => item.melds.length === needMelds);
    if (decomps.length > 0) {
      const decomp = pickBestDecomp(decomps);
      units.push({ key: decomp.pairKey, kind: 'pair' });
      for (const meld of decomp.melds) {
        if (meld.type === 'pung') units.push({ key: meld.key, kind: 'pung' });
      }
      return units;
    }
    for (const [key, count] of Object.entries(counts)) {
      if ((count ?? 0) >= 4) units.push({ key, kind: 'zi_kong' });
      else if (count === 3) units.push({ key, kind: 'pung' });
      else if (count === 2) units.push({ key, kind: 'pair' });
    }
    return units;
  }

  for (const [key, count] of Object.entries(counts)) {
    if ((count ?? 0) >= 4) units.push({ key, kind: 'zi_kong' });
    else if (count === 3) units.push({ key, kind: 'pung' });
  }
  return units;
}

function pickBestDecomp(decomps: WinDecomp[]): WinDecomp {
  return decomps.reduce((best, item) => {
    const score = (isYaoJiu(item.pairKey) ? 2 : 1)
      + item.melds.reduce((sum, meld) => {
        if (meld.type !== 'pung') return sum;
        return sum + (isYaoJiu(meld.key) ? 4 : 2);
      }, 0);
    const bestScore = (isYaoJiu(best.pairKey) ? 2 : 1)
      + best.melds.reduce((sum, meld) => {
        if (meld.type !== 'pung') return sum;
        return sum + (isYaoJiu(meld.key) ? 4 : 2);
      }, 0);
    return score > bestScore ? item : best;
  });
}

export function countPk(hand: Array<{ key: string }>, exposed: Meld[]): {
  pk: number;
  chow: number;
  concealedPung: number;
} {
  let pk = 0;
  let chow = 0;
  for (const meld of exposed) {
    if (meld.type === 'chi') chow += 1;
    else if (meldKind(meld)) pk += 1;
  }
  const concealedPung = Object.values(countKeys(hand)).filter((n) => n >= 3).length;
  return { pk, chow, concealedPung };
}

export function isPiaoHun(hand: Array<{ key: string }>, exposed: Meld[]): boolean {
  const { pk, concealedPung } = countPk(hand, exposed);
  const totalPk = pk + concealedPung;
  const pairs = Object.values(countKeys(hand)).filter((n) => n === 2).length;
  if (totalPk === 4 && hand.length === 1) return true;
  if (totalPk === 3 && pairs === 2 && hand.length === 4) return true;
  return false;
}

function handBeforeRon(hand: Array<{ key: string }>, discardKey: string): Array<{ key: string }> {
  const index = hand.findIndex((tile) => tile.key === discardKey);
  if (index < 0) return hand;
  return hand.filter((_, i) => i !== index);
}

export function detectBaoZhuang(input: {
  hand: Array<{ key: string }>;
  exposed: Meld[];
  ron: boolean;
  discardKey?: string | null;
  changed?: boolean;
  closedTwoPair?: boolean;
  discardedBeforeClose?: string[];
}): BaoZhuangReason | null {
  const discardKey = input.discardKey;
  if (!input.ron || !discardKey) return null;
  const waitHand = handBeforeRon(input.hand, discardKey);
  const { pk, chow, concealedPung } = countPk(waitHand, input.exposed);
  const totalPk = pk + concealedPung;
  const pairs = Object.values(countKeys(waitHand)).filter((n) => n === 2).length;
  const waitKey = waitHand[0]?.key;

  if (totalPk === 4 && waitHand.length === 1 && !input.changed && waitKey) {
    if (canFormSequence(waitKey, discardKey)) return 'four_wait_seq';
  }
  if (totalPk >= 1 && chow >= 1 && waitHand.length === 1 && !input.changed && waitKey) {
    if (canFormSequence(waitKey, discardKey)) return 'chow_wait_seq';
  }
  if (totalPk === 3 && pairs === 2 && waitHand.length === 4) {
    if (input.closedTwoPair) return null;
    if (!(input.discardedBeforeClose ?? []).includes(discardKey)) return 'xiang';
  }
  return null;
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
  hand: Array<{ key: string }>;
  exposed: Meld[];
  isWinner: boolean;
  isDealer: boolean;
  forcePiaoHun?: boolean;
  winType?: WinType;
}): SeatScore {
  const units = extractUnits(input.hand, input.exposed, input.isWinner);
  const breakdown: ScoreBreakdownItem[] = [];
  let hu = 0;
  let yao = 0;
  for (const unit of units) {
    const value = unitValue(unit.key, unit.kind);
    hu += value.hu;
    yao += value.yao;
    breakdown.push(describeUnit(unit.key, unit.kind));
  }

  const notes = breakdown.map((item) => `${item.label}+${item.hu}胡${item.yao ? `+${item.yao}幺` : ''}`);
  const piao = Boolean(input.forcePiaoHun || (input.isWinner && isPiaoHun(input.hand, input.exposed)));

  if (input.isWinner) {
    hu += BASE_HU;
    breakdown.unshift({ label: input.winType === 'qidong-gang-hu' ? '起手杠胡' : '胡牌', hu: BASE_HU, yao: 0 });
    notes.push('胡牌+10胡');
    if (piao) {
      hu *= 2;
      notes.push('飘荤×2');
    }
    if (input.isDealer) notes.push('庄×2');
  } else if (input.isDealer && hu > 0) {
    notes.push('庄×2');
  }

  const huBeforeDealer = hu;
  const dealerMultiplier = input.isDealer ? 2 : 1;
  if (input.isDealer) hu *= 2;

  const decomp = input.isWinner
    ? (findWinDecompositions(input.hand)[0] ?? { pairKey: units.find((u) => u.kind === 'pair')?.key ?? 'wan-5', melds: [] })
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
    baoReason = detectBaoZhuang({
      hand: winner.hand,
      exposed: winner.exposed,
      ron: Boolean(input.ron),
      discardKey: input.discardKey,
      changed: winner.changed,
      closedTwoPair: winner.closedTwoPair,
      discardedBeforeClose: winner.discardedBeforeClose,
    });
    if (baoReason === 'four_wait_seq' || baoReason === 'xiang') forcePiao = true;
  }

  const seats = input.seats.map((seat, index) => scoreSeat({
    seat: index,
    hand: seat.hand,
    exposed: seat.exposed,
    isWinner: index === input.winnerSeat,
    isDealer: index === input.dealer,
    forcePiaoHun: forcePiao && index === input.winnerSeat,
    winType: input.winType,
  }));

  const deltas = [0, 0, 0, 0];
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const diff = seats[i]!.fen - seats[j]!.fen;
      deltas[i] += diff;
      deltas[j] -= diff;
    }
  }

  const hunDi = input.winnerSeat !== null && seats[input.winnerSeat]!.piaoHun;
  let baoZhuang: BaoZhuang | null = null;
  if (baoReason && input.discarderSeat !== null && input.discarderSeat !== undefined && input.winnerSeat !== null) {
    baoZhuang = { reason: baoReason, payerSeat: input.discarderSeat, winnerSeat: input.winnerSeat };
  }

  if (hunDi && input.winnerSeat !== null) {
    if (baoZhuang) {
      for (let seat = 0; seat < 4; seat += 1) {
        if (seat === input.winnerSeat) continue;
        deltas[input.winnerSeat] += HUN_DI;
        deltas[baoZhuang.payerSeat] -= HUN_DI;
      }
    } else {
      for (let seat = 0; seat < 4; seat += 1) {
        if (seat === input.winnerSeat) continue;
        deltas[input.winnerSeat] += HUN_DI;
        deltas[seat] -= HUN_DI;
      }
    }
  }

  if (baoZhuang && input.winnerSeat !== null) {
    const winnerFen = seats[input.winnerSeat]!.fen;
    const pack = baoZhuang.payerSeat;
    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === input.winnerSeat || seat === pack) continue;
      const owe = winnerFen - seats[seat]!.fen;
      if (owe > 0) {
        deltas[seat] += owe;
        deltas[pack] -= owe;
      }
    }
  }

  return {
    seats,
    deltas,
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

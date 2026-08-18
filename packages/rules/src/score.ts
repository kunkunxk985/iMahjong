import {
  BASE_HU,
  isYaoJiu,
  type Meld,
  type ScoreBreakdownItem,
  type WinType,
} from '@pizhou/shared';
import { findWinDecompositions, type WinDecomp } from './win.ts';

export interface ScoreResult {
  hu: number;
  huBeforeDealer: number;
  yao: number;
  dealerMultiplier: number;
  breakdown: ScoreBreakdownItem[];
  decomp: WinDecomp;
  winType: WinType;
}

function scoreExposedMeld(meld: Meld): { hu: number; yao: number; label: string } {
  const sample = meld.tiles[0];
  if (!sample) return { hu: 0, yao: 0, label: meld.type };
  const yaojiu = isYaoJiu(sample);
  switch (meld.type) {
    case 'chi':
    case 'peng':
      // 吃牌不计胡数；明碰不计作坎
      return { hu: 0, yao: 0, label: meld.type };
    case 'ming-gang':
      return yaojiu
        ? { hu: 8, yao: 2, label: '幺九明杠' }
        : { hu: 4, yao: 0, label: '明杠' };
    case 'an-gang':
    case 'bu-gang':
      return yaojiu
        ? { hu: 12, yao: 3, label: '幺九暗杠/自杠' }
        : { hu: 6, yao: 0, label: '暗杠/自杠' };
    default:
      return { hu: 0, yao: 0, label: meld.type };
  }
}

export function finalPoints(hu: number, yao: number): number {
  return hu + yao;
}

export function nextDealer(currentDealer: number, winnerSeat: number | null, liuju: boolean): number {
  if (liuju || winnerSeat === null || winnerSeat === currentDealer) return currentDealer;
  return (currentDealer + 1) % 4;
}

export function scoreQidongGangHu(hand: Array<{ key: string }>, isDealer: boolean): ScoreResult {
  const counts: Record<string, number> = {};
  for (const tile of hand) {
    counts[tile.key] = (counts[tile.key] ?? 0) + 1;
  }

  const breakdown: ScoreBreakdownItem[] = [{ label: '起手杠胡', hu: BASE_HU, yao: 0 }];
  let hu = BASE_HU;
  let yao = 0;
  let pairKey = 'wan-5';
  const leftover = { ...counts };

  for (const [key, count] of Object.entries(leftover)) {
    if ((count ?? 0) < 4) continue;
    const n = Math.floor((count ?? 0) / 4);
    const part = isYaoJiu(key)
      ? { hu: 12, yao: 3, label: '幺九暗杠/自杠' }
      : { hu: 6, yao: 0, label: '暗杠/自杠' };
    for (let i = 0; i < n; i += 1) {
      hu += part.hu;
      yao += part.yao;
      breakdown.push({ label: part.label, hu: part.hu, yao: part.yao });
      leftover[key] = (leftover[key] ?? 0) - 4;
    }
  }

  for (const [key, count] of Object.entries(leftover)) {
    if ((count ?? 0) < 3) continue;
    const n = Math.floor((count ?? 0) / 3);
    const part = isYaoJiu(key)
      ? { hu: 4, yao: 1, label: '幺九坎' }
      : { hu: 2, yao: 0, label: '普通坎' };
    for (let i = 0; i < n; i += 1) {
      hu += part.hu;
      yao += part.yao;
      breakdown.push({ label: part.label, hu: part.hu, yao: part.yao });
      leftover[key] = (leftover[key] ?? 0) - 3;
    }
  }

  for (const [key, count] of Object.entries(leftover)) {
    if ((count ?? 0) < 2) continue;
    pairKey = key;
    if (isYaoJiu(key)) {
      hu += 2;
      breakdown.push({ label: '幺九对子', hu: 2, yao: 0 });
    } else {
      hu += 1;
      breakdown.push({ label: '普通对子', hu: 1, yao: 0 });
    }
    leftover[key] = (leftover[key] ?? 0) - 2;
    break;
  }

  const dealerMultiplier = isDealer ? 2 : 1;
  return {
    hu: hu * dealerMultiplier,
    huBeforeDealer: hu,
    yao,
    dealerMultiplier,
    breakdown,
    decomp: { pairKey, melds: [] },
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
  const decomps = findWinDecompositions(input.concealed).filter((d) => d.melds.length === needMelds);
  if (decomps.length === 0) return null;

  let best: ScoreResult | null = null;
  for (const decomp of decomps) {
    const breakdown: ScoreBreakdownItem[] = [{ label: '胡牌', hu: BASE_HU, yao: 0 }];
    let hu = BASE_HU;
    let yao = 0;

    if (isYaoJiu(decomp.pairKey)) {
      hu += 2;
      breakdown.push({ label: '幺九对子', hu: 2, yao: 0 });
    } else {
      hu += 1;
      breakdown.push({ label: '普通对子', hu: 1, yao: 0 });
    }

    for (const meld of decomp.melds) {
      if (meld.type !== 'pung') continue;
      if (isYaoJiu(meld.key)) {
        hu += 4;
        yao += 1;
        breakdown.push({ label: '幺九坎', hu: 4, yao: 1 });
      } else {
        hu += 2;
        breakdown.push({ label: '普通坎', hu: 2, yao: 0 });
      }
    }

    for (const meld of input.exposed) {
      const part = scoreExposedMeld(meld);
      if (part.hu === 0 && part.yao === 0) continue;
      hu += part.hu;
      yao += part.yao;
      breakdown.push({ label: part.label, hu: part.hu, yao: part.yao });
    }

    const dealerMultiplier = input.isDealer ? 2 : 1;
    const result: ScoreResult = {
      hu: hu * dealerMultiplier,
      huBeforeDealer: hu,
      yao,
      dealerMultiplier,
      breakdown,
      decomp,
      winType: input.winType,
    };
    if (
      !best ||
      result.huBeforeDealer > best.huBeforeDealer ||
      (result.huBeforeDealer === best.huBeforeDealer && result.yao > best.yao)
    ) {
      best = result;
    }
  }
  return best;
}

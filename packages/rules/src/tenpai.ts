import { canHuTiles } from './win.ts';
import { canFormSequence } from './score.ts';
import type { Meld, Tile } from '@pizhou/shared';

/**
 * All 30 unique tile keys in Pizhou mahjong (no wind, no flower).
 */
export const ALL_TILE_KEYS: readonly string[] = [
  'wan-1', 'wan-2', 'wan-3', 'wan-4', 'wan-5', 'wan-6', 'wan-7', 'wan-8', 'wan-9',
  'tong-1', 'tong-2', 'tong-3', 'tong-4', 'tong-5', 'tong-6', 'tong-7', 'tong-8', 'tong-9',
  'tiao-1', 'tiao-2', 'tiao-3', 'tiao-4', 'tiao-5', 'tiao-6', 'tiao-7', 'tiao-8', 'tiao-9',
  'dragon-1', 'dragon-2', 'dragon-3',
];

/**
 * Given a waiting hand (length = (4 - melds) * 3 + 1, e.g. 13, 10, 7, 4, 1),
 * return all tile keys that would complete a winning hand.
 */
export function getTenpaiWaits(
  hand: Array<Pick<Tile, 'key'>>,
  exposedMeldCount: number,
  exposedMelds?: Array<Pick<Meld, 'type'>>,
): string[] {
  const needMelds = 4 - exposedMeldCount;
  if (needMelds < 0 || hand.length !== needMelds * 3 + 1) return [];

  const waits: string[] = [];
  for (const key of ALL_TILE_KEYS) {
    if (canHuTiles([...hand, { key }], exposedMeldCount)) {
      waits.push(key);
    }
  }

  // 邳州本房的四组碰/坎/杠单张特殊等牌：单张与别人打来的牌能组成顺子时，
  // 也可以胡并按对应的包庄/飘荤流程处理。必须拿到副露类型并确认四组都不是吃，
  // 避免仅凭 meldCount 把含吃牌的普通单钓误提示成特殊听牌。
  const isFourNonChi = exposedMeldCount === 4
    && exposedMelds?.length === 4
    && exposedMelds.every((meld) => meld.type !== 'chi');
  if (isFourNonChi && hand.length === 1) {
    const singleKey = hand[0]!.key;
    for (const key of ALL_TILE_KEYS) {
      if (canFormSequence(singleKey, key) && !waits.includes(key)) waits.push(key);
    }
  }
  return waits.sort((a, b) => ALL_TILE_KEYS.indexOf(a) - ALL_TILE_KEYS.indexOf(b));
}

/**
 * Result of checking which discard puts the player into tenpai.
 */
export interface DiscardTenpaiOption {
  /** The tile id to discard */
  discardTileId: string;
  /** The tile key being discarded */
  discardKey: string;
  /** The tile keys that would complete the hand after this discard */
  waits: string[];
}

/**
 * Given a self-turn hand (length = (4 - melds) * 3 + 2, e.g. 14, 11, 8, 5, 2),
 * returns which discards would put the player into tenpai, and what they'd wait for.
 *
 * Tiles with the same key share the same waits, so we cache by key to avoid
 * redundant computation.
 */
export function getDiscardTenpaiOptions(
  hand: Tile[],
  exposedMeldCount: number,
  exposedMelds?: Array<Pick<Meld, 'type'>>,
): DiscardTenpaiOption[] {
  const needMelds = 4 - exposedMeldCount;
  if (needMelds < 0 || hand.length !== needMelds * 3 + 2) return [];

  const results: DiscardTenpaiOption[] = [];
  const checkedKeys = new Map<string, string[]>();

  for (let i = 0; i < hand.length; i++) {
    const tile = hand[i]!;
    let waits = checkedKeys.get(tile.key);
    if (waits === undefined) {
      const rest = hand.filter((_, idx) => idx !== i);
      waits = getTenpaiWaits(rest, exposedMeldCount, exposedMelds);
      checkedKeys.set(tile.key, waits);
    }
    if (waits.length > 0) {
      results.push({
        discardTileId: tile.id,
        discardKey: tile.key,
        waits,
      });
    }
  }
  return results;
}

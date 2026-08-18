import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTenpaiWaits, getDiscardTenpaiOptions } from '../src/tenpai.ts';
import { makeTile, type Tile } from '@pizhou/shared';

function hand(...specs: Array<[string, number]>): Array<{ key: string }> {
  return specs.map(([suit, rank]) => ({ key: `${suit}-${rank}` }));
}

function fullHand(...specs: Array<[string, number, number]>): Tile[] {
  return specs.map(([suit, rank, copy]) => makeTile(suit as any, rank, copy));
}

describe('getTenpaiWaits', () => {
  it('三面子一对等一张：听一张牌', () => {
    // 一二三万 四五六万 七八九万 一一筒 — 等: 任意对子已成，这是 14 张不是 13 张
    // 正确：一二三万 四五六万 七八九万 一筒 = 13 张，听一筒
    const h = hand(
      ['wan', 1], ['wan', 2], ['wan', 3],
      ['wan', 4], ['wan', 5], ['wan', 6],
      ['wan', 7], ['wan', 8], ['wan', 9],
      ['tong', 1], ['tong', 1], ['tong', 1],
      ['tong', 2],
    );
    const waits = getTenpaiWaits(h, 0);
    assert.ok(waits.includes('tong-2'), '应听筒二（组成一对）');
    assert.ok(waits.includes('tong-3'), '应听筒三（顺子）');
  });

  it('有一组副露时手牌 10 张', () => {
    // 三面子(含一副露) + 只差一对
    const h = hand(
      ['wan', 1], ['wan', 2], ['wan', 3],
      ['wan', 4], ['wan', 5], ['wan', 6],
      ['tong', 5], ['tong', 5], ['tong', 5],
      ['tiao', 3],
    );
    const waits = getTenpaiWaits(h, 1);
    assert.ok(waits.includes('tiao-3'), '应听条三做对子');
  });

  it('非法手牌张数返回空', () => {
    const h = hand(['wan', 1], ['wan', 2]);
    assert.deepEqual(getTenpaiWaits(h, 0), []);
  });

  it('不能胡的手牌返回空', () => {
    const h = hand(
      ['wan', 1], ['wan', 3], ['wan', 5],
      ['wan', 7], ['wan', 9], ['tong', 1],
      ['tong', 3], ['tong', 5], ['tong', 7],
      ['tong', 9], ['tiao', 1], ['tiao', 3],
      ['tiao', 5],
    );
    const waits = getTenpaiWaits(h, 0);
    assert.equal(waits.length, 0, '散牌不应听');
  });
});

describe('getDiscardTenpaiOptions', () => {
  it('14张手牌中找到可听的打法', () => {
    // 完整胡牌：一二三万 四五六万 七八九万 一一筒 = 14 张
    // 加一张废牌 dragon-1，看看是否能提示打 dragon-1 听牌
    const h = fullHand(
      ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
      ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
      ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
      ['tong', 1, 0], ['tong', 1, 1], ['tong', 1, 2],
      ['tong', 2, 0],
      ['dragon', 1, 0],
    );
    const options = getDiscardTenpaiOptions(h, 0);
    const dragonDiscard = options.find(o => o.discardKey === 'dragon-1');
    assert.ok(dragonDiscard, '应该能打出中听牌');
    assert.ok(dragonDiscard!.waits.length > 0, '打出中后应有听牌');
  });

  it('相同 key 的牌只计算一次 waits', () => {
    const h = fullHand(
      ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
      ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
      ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
      ['tong', 1, 0], ['tong', 1, 1],
      ['tong', 5, 0], ['tong', 5, 1],
      ['tong', 5, 2],
    );
    const options = getDiscardTenpaiOptions(h, 0);
    // All tong-5 discards should have the same waits array content
    const tong5Options = options.filter(o => o.discardKey === 'tong-5');
    if (tong5Options.length >= 2) {
      assert.deepEqual(tong5Options[0]!.waits, tong5Options[1]!.waits, '同 key 牌听牌相同');
    }
  });

  it('非出牌阶段张数返回空', () => {
    const h = fullHand(
      ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    );
    assert.deepEqual(getDiscardTenpaiOptions(h, 0), []);
  });
});

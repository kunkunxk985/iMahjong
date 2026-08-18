import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeTile, type Tile } from '@pizhou/shared';
import { canHuTiles, findWinDecompositions, isSevenPairs } from '../src/win.ts';

function tiles(...specs: Array<[Tile['suit'], number, number]>): Tile[] {
  return specs.map(([suit, rank, copy]) => makeTile(suit, rank, copy));
}

test('120张牌标准平胡：四面子加一对', () => {
  const hand = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['wan', 7, 0], ['wan', 8, 0], ['wan', 9, 0],
    ['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0],
    ['tiao', 1, 0], ['tiao', 1, 1],
  );
  assert.equal(canHuTiles(hand, 0), true);
  assert.equal(findWinDecompositions(hand).length > 0, true);
});

test('中发白只能做碰/对，不能做顺子', () => {
  const hand = tiles(
    ['dragon', 1, 0], ['dragon', 2, 0], ['dragon', 3, 0],
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0],
    ['tiao', 2, 0], ['tiao', 2, 1],
  );
  assert.equal(canHuTiles(hand, 0), false);
});

test('中中中可以做成坎', () => {
  const hand = tiles(
    ['dragon', 1, 0], ['dragon', 1, 1], ['dragon', 1, 2],
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0],
    ['tiao', 2, 0], ['tiao', 2, 1],
  );
  assert.equal(canHuTiles(hand, 0), true);
});

test('七对暂不支持', () => {
  const hand = tiles(
    ['wan', 1, 0], ['wan', 1, 1],
    ['wan', 2, 0], ['wan', 2, 1],
    ['wan', 3, 0], ['wan', 3, 1],
    ['tong', 1, 0], ['tong', 1, 1],
    ['tong', 2, 0], ['tong', 2, 1],
    ['tiao', 1, 0], ['tiao', 1, 1],
    ['dragon', 1, 0], ['dragon', 1, 1],
  );
  assert.equal(isSevenPairs(hand), true);
  assert.equal(canHuTiles(hand, 0), false);
});

test('已有一组碰时，手牌需组成三面子加一对', () => {
  const hand = tiles(
    ['wan', 1, 0], ['wan', 2, 0], ['wan', 3, 0],
    ['wan', 4, 0], ['wan', 5, 0], ['wan', 6, 0],
    ['tong', 1, 0], ['tong', 2, 0], ['tong', 3, 0],
    ['tiao', 5, 0], ['tiao', 5, 1],
  );
  assert.equal(canHuTiles(hand, 1), true);
  assert.equal(canHuTiles(hand, 0), false);
});

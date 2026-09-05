import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAccountStore } from '../src/accountStore.js';

test('MemoryAccountStore getLeaderboard 正确汇聚多位玩家战绩并排序', async () => {
  const store = new MemoryAccountStore();
  await store.init();

  // Create 3 users
  const userA = await store.register('player_a', 'password123', '雀圣阿强');
  assert.equal(typeof userA, 'object');
  const userB = await store.register('player_b', 'password123', '邳州二叔');
  assert.equal(typeof userB, 'object');
  const userC = await store.register('player_c', 'password123', '运河雀王');
  assert.equal(typeof userC, 'object');

  if (typeof userA === 'string' || typeof userB === 'string' || typeof userC === 'string') {
    throw new Error('Register failed');
  }

  // Record matches
  // Player A: 1 win (+50), 1 loss (-20) => net +30, 2 matches, 50% winrate
  await store.saveMatch(userA.user.userId, {
    matchId: 'm1',
    mode: 'online',
    roomCode: '888888',
    playedAt: Date.now(),
    scoreDelta: 50,
    isWin: true,
    huTypes: ['起手杠胡'],
  });
  await store.saveMatch(userA.user.userId, {
    matchId: 'm2',
    mode: 'online',
    roomCode: '888888',
    playedAt: Date.now(),
    scoreDelta: -20,
    isWin: false,
    huTypes: [],
  });

  // Player B: 2 wins (+80, +40) => net +120, 2 matches, 100% winrate
  await store.saveMatch(userB.user.userId, {
    matchId: 'm3',
    mode: 'online',
    roomCode: '888888',
    playedAt: Date.now(),
    scoreDelta: 80,
    isWin: true,
    huTypes: ['飘荤'],
  });
  await store.saveMatch(userB.user.userId, {
    matchId: 'm4',
    mode: 'online',
    roomCode: '888888',
    playedAt: Date.now(),
    scoreDelta: 40,
    isWin: true,
    huTypes: ['两对关门'],
  });

  // Player C: 1 loss (-60) => net -60, 1 match, 0% winrate
  await store.saveMatch(userC.user.userId, {
    matchId: 'm5',
    mode: 'online',
    roomCode: '888888',
    playedAt: Date.now(),
    scoreDelta: -60,
    isWin: false,
    huTypes: [],
  });

  const leaderboard = await store.getLeaderboard();
  assert.equal(leaderboard.length, 3);

  // Player B should be rank 1 with +120 totalScore
  assert.equal(leaderboard[0].userId, userB.user.userId);
  assert.equal(leaderboard[0].rank, 1);
  assert.equal(leaderboard[0].totalScore, 120);
  assert.equal(leaderboard[0].winRate, 100);
  assert.equal(leaderboard[0].nickname, '邳州二叔');

  // Player A should be rank 2 with +30 totalScore
  assert.equal(leaderboard[1].userId, userA.user.userId);
  assert.equal(leaderboard[1].rank, 2);
  assert.equal(leaderboard[1].totalScore, 30);
  assert.equal(leaderboard[1].winRate, 50);

  // Player C should be rank 3 with -60 totalScore
  assert.equal(leaderboard[2].userId, userC.user.userId);
  assert.equal(leaderboard[2].rank, 3);
  assert.equal(leaderboard[2].totalScore, -60);
});

import { EventEmitter } from 'node:events';
import { handleHttpApi } from '../src/httpRouter.js';

test('handleHttpApi GET /api/leaderboard 成功返回雀友排行榜', async () => {
  const store = new MemoryAccountStore();
  await store.init();
  await store.register('player_hall', 'pass1234', '大厅雀神');

  const req = Object.assign(new EventEmitter(), {
    method: 'GET',
    url: '/api/leaderboard',
    headers: { host: '127.0.0.1:9090' },
  });

  let responseBody = '';
  let statusCode = 0;
  const res = {
    writeHead(status: number) {
      statusCode = status;
      return this;
    },
    end(body: string) {
      responseBody = body;
    },
  };

  const handled = await handleHttpApi(req as any, res as any, store);
  assert.equal(handled, true);
  assert.equal(statusCode, 200);

  const parsed = JSON.parse(responseBody);
  assert.ok(Array.isArray(parsed.leaderboard));
  assert.equal(parsed.leaderboard.length, 1);
  assert.equal(parsed.leaderboard[0].nickname, '大厅雀神');
});

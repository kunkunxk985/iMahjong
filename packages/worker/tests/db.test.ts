import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HubDatabase } from '../src/db.js';

describe('Cloudflare DO HubDatabase', () => {
  const db = new HubDatabase();

  it('支持免密创建游客账号并初始化档案', async () => {
    const res = await db.createGuest('测试雀友');
    assert.ok(res.token.startsWith('tk_guest_'));
    assert.equal(res.user.nickname, '测试雀友');
    assert.equal(res.user.avatar, '🀄');
    assert.equal(res.user.isGuest, true);
  });

  it('支持正式账号注册与重复账号校验', async () => {
    const regRes = await db.register('player_test', 'pass1234', '邳州牌圣');
    assert.ok(typeof regRes !== 'string');
    assert.equal(regRes.user.username, 'player_test');
    assert.equal(regRes.user.nickname, '邳州牌圣');
    assert.equal(regRes.user.isGuest, false);

    // Duplicate check
    const dupRes = await db.register('player_test', 'pass1234');
    assert.equal(dupRes, '账号已被注册');
  });

  it('支持账号密码登录与档案获取', async () => {
    const loginRes = await db.login('player_test', 'pass1234');
    assert.ok(typeof loginRes !== 'string');
    assert.equal(loginRes.user.username, 'player_test');

    const wrongLogin = await db.login('player_test', 'wrongpassword');
    assert.equal(wrongLogin, '账号或密码不正确');
  });

  it('支持修改头像、称号与个性签名', async () => {
    const loginRes = (await db.login('player_test', 'pass1234')) as any;
    const updated = await db.updateProfile(loginRes.user.userId, {
      avatar: '🐱',
      title: '大蒜宗师',
      bio: '单钓不换张，胡牌按飘荤！',
    });
    assert.ok(updated);
    assert.equal(updated.avatar, '🐱');
    assert.equal(updated.title, '大蒜宗师');
    assert.equal(updated.bio, '单钓不换张，胡牌按飘荤！');
  });

  it('支持严格分流保存与统计联机战绩 vs 单机战绩', async () => {
    const loginRes = (await db.login('player_test', 'pass1234')) as any;
    const userId = loginRes.user.userId;

    // Save 1 online match (win)
    await db.saveMatch(userId, {
      id: 'm_online_1',
      mode: 'online',
      roomCode: '666888',
      timestamp: Date.now(),
      dateStr: '9月1日 18:00',
      winType: '平胡',
      winnerNickname: '邳州牌圣',
      winnerSeat: 0,
      hu: 16,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 120,
      myIsWinner: true,
      scores: [
        { seat: 0, nickname: '邳州牌圣', score: 120, isWinner: true, isDealer: false },
        { seat: 1, nickname: '对家', score: -40, isWinner: false, isDealer: false },
        { seat: 2, nickname: '上家', score: -40, isWinner: false, isDealer: false },
        { seat: 3, nickname: '下家', score: -40, isWinner: false, isDealer: false },
      ],
    });

    // Save 1 local single-player match (loss)
    await db.saveMatch(userId, {
      id: 'm_local_1',
      mode: 'local',
      roomCode: '单机练习',
      timestamp: Date.now(),
      dateStr: '9月1日 18:10',
      winType: '平胡',
      winnerNickname: '陪练·南',
      winnerSeat: 1,
      hu: 12,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: -40,
      myIsWinner: false,
      scores: [
        { seat: 0, nickname: '邳州牌圣', score: -40, isWinner: false, isDealer: false },
        { seat: 1, nickname: '陪练·南', score: 120, isWinner: true, isDealer: false },
      ],
    });

    // Query online only
    const onlineQuery = await db.getMatches(userId, 'online');
    assert.equal(onlineQuery.matches.length, 1);
    assert.equal(onlineQuery.matches[0]!.mode, 'online');
    assert.equal(onlineQuery.stats.totalMatches, 1);
    assert.equal(onlineQuery.stats.wins, 1);
    assert.equal(onlineQuery.stats.winRate, 100);
    assert.equal(onlineQuery.stats.totalScore, 120);

    // Query local only
    const localQuery = await db.getMatches(userId, 'local');
    assert.equal(localQuery.matches.length, 1);
    assert.equal(localQuery.matches[0]!.mode, 'local');
    assert.equal(localQuery.stats.totalMatches, 1);
    assert.equal(localQuery.stats.wins, 0);
    assert.equal(localQuery.stats.winRate, 0);
    assert.equal(localQuery.stats.totalScore, -40);

    // Confirm they are completely independent and not mixed
    assert.notEqual(onlineQuery.stats.totalScore, localQuery.stats.totalScore);
  });
});

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
    const caseInsensitiveDup = await db.register('PLAYER_TEST', 'pass1234');
    assert.equal(caseInsensitiveDup, '账号已被注册');
  });

  it('支持账号密码登录与档案获取', async () => {
    const loginRes = await db.login('player_test', 'pass1234');
    assert.ok(typeof loginRes !== 'string');
    assert.equal(loginRes.user.username, 'player_test');

    const stored = await db.getUserById(loginRes.user.userId);
    assert.match(stored?.password_hash ?? '', /^pbkdf2-sha256\$100000\$/);

    const wrongLogin = await db.login('player_test', 'wrongpassword');
    assert.equal(wrongLogin, '账号或密码不正确');
  });

  it('支持修改自定义头像、网名、称号与个性签名', async () => {
    const loginRes = (await db.login('player_test', 'pass1234')) as any;
    const customAvatar = 'data:image/webp;base64,dGVzdC1hdmF0YXI=';
    const updated = await db.updateProfile(loginRes.user.userId, {
      avatar: customAvatar,
      nickname: '云端自定义雀士',
      title: '大蒜宗师',
      bio: '单钓不换张，胡牌按飘荤！',
    });
    assert.ok(updated);
    assert.equal(updated.avatar, customAvatar);
    assert.equal(updated.nickname, '云端自定义雀士');
    assert.equal(updated.title, '大蒜宗师');
    assert.equal(updated.bio, '单钓不换张，胡牌按飘荤！');

    const profile = await db.getProfile(loginRes.user.userId);
    assert.equal(profile?.avatar, customAvatar);
    assert.equal(profile?.nickname, '云端自定义雀士');

    const cleared = await db.updateProfile(loginRes.user.userId, { bio: '' });
    assert.equal(cleared?.bio, '');
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

  it('游客升级正式账号时保留完整资料和云端身份', async () => {
    const guest = await db.createGuest('临时雀友');
    const customAvatar = 'data:image/webp;base64,dGVzdC1ndWVzdC1hdmF0YXI=';
    await db.updateProfile(guest.user.userId, {
      avatar: customAvatar,
      nickname: '不丢档案的雀士',
      title: '运河雀圣',
      bio: '游客也要认真打牌',
    });

    const upgraded = await db.upgradeGuest(
      guest.user.userId,
      'saved_guest_account',
      'newpass123',
      '不丢档案的雀士',
    );
    assert.ok(typeof upgraded !== 'string');
    if (typeof upgraded === 'string') return;

    assert.equal(upgraded.user.username, 'saved_guest_account');
    assert.equal(upgraded.user.isGuest, false);
    assert.equal(upgraded.user.avatar, customAvatar);
    assert.equal(upgraded.user.title, '运河雀圣');
    assert.equal(upgraded.user.bio, '游客也要认真打牌');
    assert.equal(await db.getUserByToken(guest.token), null);
    assert.ok(await db.getUserByToken(upgraded.token));
    const login = await db.login('SAVED_GUEST_ACCOUNT', 'newpass123');
    assert.ok(typeof login !== 'string');
  });

  it('旧版固定盐密码在成功登录后自动迁移到 PBKDF2', async () => {
    const registered = await db.register('legacy_password_user', 'legacyPass123');
    assert.ok(typeof registered !== 'string');
    if (typeof registered === 'string') return;

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('legacyPass123:pizhou_salt_v1'),
    );
    const legacyHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const row = await db.getUserById(registered.user.userId);
    assert.ok(row);
    if (!row) return;
    row.password_hash = legacyHash;

    const login = await db.login('legacy_password_user', 'legacyPass123');
    assert.ok(typeof login !== 'string');
    assert.match(row.password_hash, /^pbkdf2-sha256\$100000\$/);
  });

  it('修改密码会轮换凭证并让旧密码和旧 token 失效', async () => {
    const login = await db.login('player_test', 'pass1234');
    assert.ok(typeof login !== 'string');
    if (typeof login === 'string') return;

    const changed = await db.changePassword(login.user.userId, 'pass1234', 'changedpass123');
    assert.ok(typeof changed !== 'string');
    if (typeof changed === 'string') return;

    assert.notEqual(changed.token, login.token);
    assert.equal(await db.getUserByToken(login.token), null);
    assert.equal(await db.login('player_test', 'pass1234'), '账号或密码不正确');
    const newLogin = await db.login('player_test', 'changedpass123');
    assert.ok(typeof newLogin !== 'string');
    if (typeof newLogin === 'string') return;
    assert.equal(await db.revokeToken(newLogin.token), true);
    assert.equal(await db.getUserByToken(newLogin.token), null);
  });
});

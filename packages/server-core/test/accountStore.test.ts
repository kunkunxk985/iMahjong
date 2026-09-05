import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GameMode, MatchRecord } from '@pizhou/shared';
import {
  constantTimeStringEqual,
  generateId,
  generateToken,
  hashPassword,
  legacyHashPassword,
  verifyPassword,
} from '../src/password.ts';
import {
  DiskAccountStore,
  MemoryAccountStore,
  type AccountStore,
} from '../src/accountStore.ts';
import { startMahjongServer } from '../src/createServer.ts';

test('WebCrypto PBKDF2: 密码加盐哈希与恒定时间校验', async () => {
  const plainPassword = 'PizhouMahjong2026!';
  const hash = await hashPassword(plainPassword);

  assert.equal(hash.startsWith('pbkdf2-sha256$120000$'), true);
  const parts = hash.split('$');
  assert.equal(parts.length, 4);
  assert.equal(parts[1], '120000');

  // 正确密码校验通过
  const checkPass = await verifyPassword(plainPassword, hash);
  assert.equal(checkPass.valid, true);
  assert.equal(checkPass.needsUpgrade, false);

  // 错误密码校验失败
  const checkFail = await verifyPassword('WrongPassword', hash);
  assert.equal(checkFail.valid, false);

  // 恒定时间字符串比较
  assert.equal(constantTimeStringEqual('token_secret_abc', 'token_secret_abc'), true);
  assert.equal(constantTimeStringEqual('token_secret_abc', 'token_secret_xyz'), false);
  assert.equal(constantTimeStringEqual('short', 'longer_string'), false);
  assert.equal(constantTimeStringEqual('', ''), true);
  assert.equal(constantTimeStringEqual('', 'a'), false);

  // 唯一 ID 与 Token 生成
  const id1 = generateId('guest');
  const id2 = generateId('usr');
  assert.notEqual(id1, id2);
  assert.equal(id1.startsWith('guest_'), true);
  assert.equal(id2.startsWith('usr_'), true);

  const token1 = generateToken('u123');
  const token2 = generateToken('u123');
  assert.notEqual(token1, token2);
  assert.equal(token1.startsWith('tk_u123_'), true);
});

test('WebCrypto PBKDF2: 兼容旧版固定盐密码并在校验通过后标记升级', async () => {
  const legacyPassword = 'LegacyPassword666';
  const legacyHash = await legacyHashPassword(legacyPassword);

  // 验证旧哈希
  const check = await verifyPassword(legacyPassword, legacyHash);
  assert.equal(check.valid, true);
  assert.equal(check.needsUpgrade, true);

  // 错误密码验证旧哈希失败
  const fail = await verifyPassword('Incorrect', legacyHash);
  assert.equal(fail.valid, false);
});

test('MemoryAccountStore: 游客创建、注册、登录、升级与多端会话', async () => {
  const store = new MemoryAccountStore();
  await store.init();

  // 1. 游客创建
  const guestRes = await store.createGuest('测试游客');
  assert.equal(typeof guestRes.token, 'string');
  assert.equal(guestRes.user.isGuest, true);
  assert.equal(guestRes.user.nickname, '测试游客');
  assert.equal(guestRes.user.avatar, '🀄');

  // 2. 账号注册校验
  const shortUser = await store.register('a', '123456');
  assert.equal(typeof shortUser, 'string');
  assert.equal(shortUser.includes('至少2位'), true);

  const shortPass = await store.register('user_test', '123');
  assert.equal(typeof shortPass, 'string');
  assert.equal(shortPass.includes('至少6位'), true);

  // 正常注册
  const regRes = await store.register('player_one', 'Secret123', '雀神小一');
  assert.equal(typeof regRes, 'object');
  if (typeof regRes === 'string') throw new Error('Registration failed');
  assert.equal(regRes.user.username, 'player_one');
  assert.equal(regRes.user.nickname, '雀神小一');
  assert.equal(regRes.user.isGuest, false);

  // 重复注册拒绝
  const dup = await store.register('Player_One', 'AnotherPass');
  assert.equal(dup, '账号已被注册');

  // 3. 登录
  const loginFail = await store.login('player_one', 'WrongPass');
  assert.equal(loginFail, '账号或密码不正确');

  const loginSuccess = await store.login('player_one', 'Secret123');
  assert.equal(typeof loginSuccess, 'object');
  if (typeof loginSuccess === 'string') throw new Error('Login failed');
  assert.equal(loginSuccess.user.userId, regRes.user.userId);
  assert.notEqual(loginSuccess.token, regRes.token); // 多设备登录各自分配独立 Token

  // 两台设备的 Token 同时有效（多端漫游支持）
  const userByToken1 = await store.getUserByToken(regRes.token);
  const userByToken2 = await store.getUserByToken(loginSuccess.token);
  assert.equal(userByToken1?.id, regRes.user.userId);
  assert.equal(userByToken2?.id, regRes.user.userId);

  // 4. 静默续期 renewSession
  const renewed = await store.renewSession(regRes.token);
  assert.equal(renewed?.token, regRes.token);
  assert.equal(renewed?.user.userId, regRes.user.userId);

  // 5. 游客升级为正式账号
  const upgradeFail = await store.upgradeGuest(regRes.user.userId, 'new_name', '123456');
  assert.equal(upgradeFail, '该账号已经是正式账号');

  const upgradeSuccess = await store.upgradeGuest(guestRes.user.userId, 'upgraded_user', 'NewPass123', '升级雀士');
  assert.equal(typeof upgradeSuccess, 'object');
  if (typeof upgradeSuccess === 'string') throw new Error('Upgrade failed');
  assert.equal(upgradeSuccess.user.userId, guestRes.user.userId);
  assert.equal(upgradeSuccess.user.username, 'upgraded_user');
  assert.equal(upgradeSuccess.user.nickname, '升级雀士');
  assert.equal(upgradeSuccess.user.isGuest, false);

  // 6. 修改密码并吊销所有其它设备会话
  // 再为 upgraded_user 创建一个会话
  const secondDevice = await store.login('upgraded_user', 'NewPass123');
  if (typeof secondDevice === 'string') throw new Error('Second login failed');

  const changePassRes = await store.changePassword(guestRes.user.userId, 'NewPass123', 'BrandNewPass888');
  assert.equal(typeof changePassRes, 'object');
  if (typeof changePassRes === 'string') throw new Error('Change password failed');

  // 旧设备会话均已失效
  const oldSession1 = await store.getUserByToken(upgradeSuccess.token);
  const oldSession2 = await store.getUserByToken(secondDevice.token);
  assert.equal(oldSession1, null);
  assert.equal(oldSession2, null);

  // 本次修改密码设备的新 Token 正常有效
  const activeSession = await store.getUserByToken(changePassRes.token);
  assert.equal(activeSession?.id, guestRes.user.userId);

  // 7. 单独退出登录 revokeToken
  const logoutOk = await store.revokeToken(changePassRes.token);
  assert.equal(logoutOk, true);
  const loggedOut = await store.getUserByToken(changePassRes.token);
  assert.equal(loggedOut, null);
});

test('MemoryAccountStore: 个人名片与战绩统计', async () => {
  const store = new MemoryAccountStore();
  const reg = await store.register('mahjong_master', 'Password666', '初始昵称');
  if (typeof reg === 'string') throw new Error('Register failed');
  const userId = reg.user.userId;

  // 更新个人资料（支持国风头像）
  const updatedProfile = await store.updateProfile(userId, {
    nickname: '运河雀王',
    avatar: 'guofeng_yushi',
    title: '大蒜宗师',
    bio: '运河边上，谁与争锋！',
  });
  assert.equal(updatedProfile?.nickname, '运河雀王');
  assert.equal(updatedProfile?.avatar, 'guofeng_yushi');
  assert.equal(updatedProfile?.title, '大蒜宗师');
  assert.equal(updatedProfile?.bio, '运河边上，谁与争锋！');

  // 战绩记录与分流
  const match1: MatchRecord = {
    id: 'match-001',
    mode: 'local',
    timestamp: Date.now() - 2000,
    dateStr: '9月5日 10:00',
    roomCode: '单机练习',
    winType: '平胡',
    winnerSeat: 0,
    hu: 20,
    yao: 1,
    dealerMultiplier: 1,
    hunDi: false,
    liuju: false,
    baoZhuang: null,
    myDeltaScore: 35,
    myIsWinner: true,
    scores: [],
  };

  const match2: MatchRecord = {
    id: 'match-002',
    mode: 'online',
    timestamp: Date.now() - 1000,
    dateStr: '9月5日 10:30',
    roomCode: '668822',
    winType: '飘荤',
    winnerSeat: 1,
    hu: 40,
    yao: 0,
    dealerMultiplier: 2,
    hunDi: true,
    liuju: false,
    baoZhuang: { reason: '香牌点炮', payerSeat: 2, winnerSeat: 1 },
    myDeltaScore: -12,
    myIsWinner: false,
    scores: [],
  };

  await store.saveMatch(userId, match1);
  await store.saveMatch(userId, match2);

  // 查询单机战绩
  const localMatches = await store.getMatches(userId, 'local');
  assert.equal(localMatches.matches.length, 1);
  assert.equal(localMatches.stats.totalMatches, 1);
  assert.equal(localMatches.stats.wins, 1);
  assert.equal(localMatches.stats.totalScore, 35);

  // 查询联机战绩
  const onlineMatches = await store.getMatches(userId, 'online');
  assert.equal(onlineMatches.matches.length, 1);
  assert.equal(onlineMatches.stats.totalMatches, 1);
  assert.equal(onlineMatches.stats.losses, 1);
  assert.equal(onlineMatches.stats.piaoHunCount, 1);
  assert.equal(onlineMatches.stats.baoZhuangCount, 1);

  // 查询全量战绩
  const allMatches = await store.getMatches(userId);
  assert.equal(allMatches.matches.length, 2);
  assert.equal(allMatches.stats.totalMatches, 2);
  assert.equal(allMatches.stats.wins, 1);
  assert.equal(allMatches.stats.losses, 1);
  assert.equal(allMatches.stats.winRate, 50);
});

test('AccountStore: 多玩家同一对局 ID 战绩隔离不相互覆盖', async () => {
  const store = new MemoryAccountStore();
  const u1 = await store.register('user_alpha', 'Password123');
  const u2 = await store.register('user_beta', 'Password123');
  if (typeof u1 === 'string' || typeof u2 === 'string') throw new Error('Register failed');

  const sharedMatchId = 'match_shared_online_001';
  const matchA: MatchRecord = {
    id: sharedMatchId,
    mode: 'online',
    timestamp: 1700000000000,
    dateStr: '9月5日 12:00',
    roomCode: '888666',
    winType: '平胡',
    winnerSeat: 0,
    hu: 20,
    yao: 0,
    dealerMultiplier: 1,
    hunDi: false,
    liuju: false,
    baoZhuang: null,
    myDeltaScore: 45,
    myIsWinner: true,
    scores: [],
  };

  const matchB: MatchRecord = {
    id: sharedMatchId,
    mode: 'online',
    timestamp: 1700000000000,
    dateStr: '9月5日 12:00',
    roomCode: '888666',
    winType: '平胡',
    winnerSeat: 0,
    hu: 20,
    yao: 0,
    dealerMultiplier: 1,
    hunDi: false,
    liuju: false,
    baoZhuang: null,
    myDeltaScore: -15,
    myIsWinner: false,
    scores: [],
  };

  await store.saveMatch(u1.user.userId, matchA);
  await store.saveMatch(u2.user.userId, matchB);

  const resA = await store.getMatches(u1.user.userId);
  const resB = await store.getMatches(u2.user.userId);

  assert.equal(resA.matches.length, 1);
  assert.equal(resA.matches[0]?.id, sharedMatchId);
  assert.equal(resA.matches[0]?.myDeltaScore, 45);
  assert.equal(resA.matches[0]?.myIsWinner, true);

  assert.equal(resB.matches.length, 1);
  assert.equal(resB.matches[0]?.id, sharedMatchId);
  assert.equal(resB.matches[0]?.myDeltaScore, -15);
  assert.equal(resB.matches[0]?.myIsWinner, false);

  // 同一玩家重复保存同一 matchId 正常幂等去重
  await store.saveMatch(u1.user.userId, { ...matchA, myDeltaScore: 50 });
  const resA2 = await store.getMatches(u1.user.userId);
  assert.equal(resA2.matches.length, 1);
  assert.equal(resA2.matches[0]?.myDeltaScore, 50);
});

test('多设备会话限制：超过10个会话时自动淘汰最早活跃的旧会话', async () => {
  const store = new MemoryAccountStore();
  const reg = await store.register('multi_device_user', 'Passw0rd123');
  if (typeof reg === 'string') throw new Error('Register failed');
  const userId = reg.user.userId;

  const tokens: string[] = [reg.token];
  // 创建另外 10 个会话（总计达到 11 个会话）
  for (let i = 1; i <= 10; i++) {
    const session = await store.createSession(userId, `Device-${i}`);
    tokens.push(session.token);
  }

  assert.equal(tokens.length, 11);

  // 验证第 1 个会话已被淘汰 (null)
  const firstSession = await store.getSessionByToken(tokens[0]!);
  assert.equal(firstSession, null);

  // 验证后 10 个会话依然全部有效
  for (let i = 1; i <= 10; i++) {
    const validSession = await store.getSessionByToken(tokens[i]!);
    assert.notEqual(validSession, null);
    assert.equal(validSession?.userId, userId);
  }
});

test('DiskAccountStore: 原子文件持久化与断电/重启完整恢复', async () => {
  const tmpDir = path.join(os.tmpdir(), `pizhou-test-accounts-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.promises.mkdir(tmpDir, { recursive: true });

  try {
    const store1 = new DiskAccountStore({ dirPath: tmpDir });
    await store1.init();

    const reg = await store1.register('persistent_user', 'Passw0rd!', '原子写雀士');
    if (typeof reg === 'string') throw new Error('Register failed');
    const token = reg.token;
    const userId = reg.user.userId;

    await store1.updateProfile(userId, { bio: '持久化测试签名' });

    const match: MatchRecord = {
      id: 'p-match-1',
      mode: 'online',
      timestamp: Date.now(),
      dateStr: '9月5日 11:00',
      roomCode: '123456',
      winType: '自摸',
      winnerSeat: 0,
      hu: 30,
      yao: 2,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 50,
      myIsWinner: true,
      scores: [],
    };
    await store1.saveMatch(userId, match);

    // 验证磁盘物理文件存在且格式合法
    assert.equal(fs.existsSync(path.join(tmpDir, 'users.json')), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'sessions.json')), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'profiles.json')), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'matches.json')), true);

    // 模拟服务端进程崩溃/重启：重新实例化 DiskAccountStore 并从磁盘重新加载
    const store2 = new DiskAccountStore({ dirPath: tmpDir });
    await store2.init();

    const restoredUser = await store2.getUserByToken(token);
    assert.equal(restoredUser?.id, userId);
    assert.equal(restoredUser?.username, 'persistent_user');

    const restoredProfile = await store2.getProfile(userId);
    assert.equal(restoredProfile?.nickname, '原子写雀士');
    assert.equal(restoredProfile?.bio, '持久化测试签名');

    const restoredMatches = await store2.getMatches(userId, 'online');
    assert.equal(restoredMatches.matches.length, 1);
    assert.equal(restoredMatches.matches[0]?.id, 'p-match-1');
    assert.equal(restoredMatches.stats.wins, 1);
    assert.equal(restoredMatches.stats.totalScore, 50);

    // 验证登录状态在重启后仍然可用密码登录
    const reLogin = await store2.login('persistent_user', 'Passw0rd!');
    assert.equal(typeof reLogin, 'object');
    if (typeof reLogin === 'string') throw new Error('Re-login failed');
    assert.equal(reLogin.user.userId, userId);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('HTTP Router & createServer: 完整 REST API 端点验证', async () => {
  const tmpDir = path.join(os.tmpdir(), `pizhou-test-http-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const server = await startMahjongServer({
    port: 0,
    host: '127.0.0.1',
    log: false,
    stateDir: path.join(tmpDir, 'state'),
    accountsDir: path.join(tmpDir, 'accounts'),
  });

  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    // 1. GET / 探活端点
    const probeRes = await fetch(`${baseUrl}/`);
    assert.equal(probeRes.status, 200);
    const probeText = await probeRes.text();
    assert.equal(probeText.includes('pizhou-mahjong-server'), true);

    // 2. OPTIONS 跨域预检
    const optionsRes = await fetch(`${baseUrl}/api/auth/guest`, { method: 'OPTIONS' });
    assert.equal(optionsRes.status, 204);
    assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');

    // 3. POST /api/auth/guest 游客登录
    const guestRes = await fetch(`${baseUrl}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'REST游客' }),
    });
    assert.equal(guestRes.status, 200);
    const guestData = await guestRes.json() as any;
    assert.equal(typeof guestData.token, 'string');
    assert.equal(guestData.user.nickname, 'REST游客');
    assert.equal(guestData.user.isGuest, true);
    const guestToken = guestData.token;

    // 4. POST /api/auth/register 正式注册
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'rest_user', password: 'Password888', nickname: 'REST玩家' }),
    });
    assert.equal(regRes.status, 200);
    const regData = await regRes.json() as any;
    assert.equal(regData.user.username, 'rest_user');
    assert.equal(regData.user.nickname, 'REST玩家');
    const userToken = regData.token;

    // 5. POST /api/auth/login 密码登录
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'rest_user', password: 'Password888' }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json() as any;
    assert.equal(loginData.user.username, 'rest_user');

    // 6. POST /api/auth/renew 登录态静默续期
    const renewRes = await fetch(`${baseUrl}/api/auth/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
    });
    assert.equal(renewRes.status, 200);
    const renewData = await renewRes.json() as any;
    assert.equal(renewData.token, userToken);
    assert.equal(renewData.user.username, 'rest_user');

    // 7. POST /api/auth/upgrade 游客升级为正式账号
    const upgradeRes = await fetch(`${baseUrl}/api/auth/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({ username: 'upgraded_rest', password: 'NewPassword999', nickname: '已升级玩家' }),
    });
    assert.equal(upgradeRes.status, 200);
    const upgradeData = await upgradeRes.json() as any;
    assert.equal(upgradeData.user.username, 'upgraded_rest');
    assert.equal(upgradeData.user.isGuest, false);

    // 8. GET & POST /api/profile
    const getProfileRes = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(getProfileRes.status, 200);
    const profileData = await getProfileRes.json() as any;
    assert.equal(profileData.user.username, 'rest_user');

    const updateProfileRes = await fetch(`${baseUrl}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ title: '运河雀圣', bio: 'REST测试个性签名' }),
    });
    assert.equal(updateProfileRes.status, 200);
    const updatedData = await updateProfileRes.json() as any;
    assert.equal(updatedData.user.title, '运河雀圣');
    assert.equal(updatedData.user.bio, 'REST测试个性签名');

    // 9. POST & GET /api/matches
    const record: MatchRecord = {
      id: 'rest-match-1',
      mode: 'online',
      timestamp: Date.now(),
      dateStr: '9月5日 12:00',
      roomCode: '888888',
      winType: '平胡',
      winnerSeat: 0,
      hu: 15,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 20,
      myIsWinner: true,
      scores: [],
    };

    const saveMatchRes = await fetch(`${baseUrl}/api/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(record),
    });
    assert.equal(saveMatchRes.status, 200);
    const saveMatchData = await saveMatchRes.json() as any;
    assert.equal(saveMatchData.success, true);
    assert.equal(saveMatchData.id, 'rest-match-1');

    const getMatchesRes = await fetch(`${baseUrl}/api/matches?mode=online`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(getMatchesRes.status, 200);
    const matchesData = await getMatchesRes.json() as any;
    assert.equal(matchesData.matches.length, 1);
    assert.equal(matchesData.stats.wins, 1);
    assert.equal(matchesData.stats.totalScore, 20);

    // 10. POST /api/auth/password 修改密码
    const changePassRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ currentPassword: 'Password888', newPassword: 'UpdatedSecret2026' }),
    });
    assert.equal(changePassRes.status, 200);
    const changePassData = await changePassRes.json() as any;
    assert.equal(typeof changePassData.token, 'string');
    const newToken = changePassData.token;

    // 旧 token 应该失效 (401)
    const oldTokenReq = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(oldTokenReq.status, 401);

    // 新 token 正常鉴权
    const newTokenReq = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    assert.equal(newTokenReq.status, 200);

    // 11. POST /api/auth/logout 退出登录
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newToken}` },
    });
    assert.equal(logoutRes.status, 200);

    // 退出后 token 失效 (401)
    const afterLogoutReq = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    assert.equal(afterLogoutReq.status, 401);
  } finally {
    await server.close();
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

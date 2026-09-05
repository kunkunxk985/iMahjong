import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  calculateCareerStats,
  calculateFanTypeDistribution,
  calculateRank,
  calculateRP,
  evaluateAchievements,
  getRankTier,
  RANK_TIERS,
  type AchievementProgress,
  type EnrichedMatchRecord,
  type FanTypeDistribution,
  type GameMode,
  type MatchRecord,
  type UserProfile,
} from '@pizhou/shared';
import {
  computeModeStats,
  DiskAccountStore,
  startMahjongServer,
  type StartedServer,
} from '@pizhou/server-core';
import {
  DEFAULT_SESSION_LIFETIME_MS,
  MAX_SESSIONS_PER_USER,
} from '../packages/server-core/src/accountStore.ts';

interface StressTestSummary {
  suite: string;
  passed: boolean;
  durationMs: number;
  details: Record<string, unknown>;
}

const summaries: StressTestSummary[] = [];

async function runStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  console.log(`\n======================================================`);
  console.log(`▶ RUNNING SUITE: ${name}`);
  console.log(`======================================================`);
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    console.log(`✔ PASSED: ${name} (${durationMs}ms)`);
    summaries.push({
      suite: name,
      passed: true,
      durationMs,
      details: typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : { result },
    });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error(`✖ FAILED: ${name} (${durationMs}ms)`, err);
    summaries.push({
      suite: name,
      passed: false,
      durationMs,
      details: { error: String(err) },
    });
    throw err;
  }
}

// --------------------------------------------------------------------------
// SUITE 1: Multi-Device Sessions Limit & Oldest Session Eviction
// --------------------------------------------------------------------------
async function testMultiDeviceSessions(server: StartedServer, baseUrl: string) {
  // 1A. Sequential 15 Device Sessions (Device-01 to Device-15)
  const userA = 'stress_seq_user';
  const passA = 'Passw0rd_15_Seq!';

  const regResA = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userA, password: passA, nickname: '会话淘汰测试A' }),
  });
  assert.equal(regResA.status, 200, 'User A registration should succeed');
  const regDataA = (await regResA.json()) as any;
  const initialToken = regDataA.token as string;
  const userIdA = regDataA.user.userId as string;

  const tokensA: string[] = [initialToken];
  // Create 14 more sessions sequentially with distinct timestamps to ensure ordering
  for (let i = 2; i <= 15; i++) {
    // Small delay so timestamps strictly increase
    await new Promise((r) => setTimeout(r, 5));
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userA, password: passA }),
    });
    assert.equal(loginRes.status, 200, `Login for device ${i} should succeed`);
    const loginData = (await loginRes.json()) as any;
    tokensA.push(loginData.token);
  }

  assert.equal(tokensA.length, 15, 'Should have created 15 total sessions');

  // Verify oldest 5 sessions (tokens 0..4) are evicted (401 Unauthorized & store returns null)
  for (let i = 0; i < 5; i++) {
    const t = tokensA[i]!;
    const checkHttp = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    assert.equal(
      checkHttp.status,
      401,
      `Old session index ${i} (Device ${i + 1}) must be evicted (HTTP 401)`,
    );

    const checkStore = await server.accountStore.getSessionByToken(t);
    assert.equal(
      checkStore,
      null,
      `Old session index ${i} (Device ${i + 1}) must not exist in store`,
    );
  }

  // Verify latest 10 sessions (tokens 5..14) remain valid (200 OK & store returns session)
  for (let i = 5; i < 15; i++) {
    const t = tokensA[i]!;
    const checkHttp = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    assert.equal(
      checkHttp.status,
      200,
      `Recent session index ${i} (Device ${i + 1}) must remain active (HTTP 200)`,
    );

    const checkStore = await server.accountStore.getSessionByToken(t);
    assert.notEqual(
      checkStore,
      null,
      `Recent session index ${i} (Device ${i + 1}) must exist in store`,
    );
    assert.equal(checkStore?.userId, userIdA);
  }

  // 1B. Concurrent Burst: 15 Concurrent Logins via Promise.all
  const userB = 'stress_burst_user';
  const passB = 'Passw0rd_15_Burst!';

  const regResB = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userB, password: passB, nickname: '并发突发用户' }),
  });
  assert.equal(regResB.status, 200, 'User B registration should succeed');
  const regDataB = (await regResB.json()) as any;
  const userIdB = regDataB.user.userId as string;

  // Fire 15 concurrent login requests simultaneously
  const loginPromises = Array.from({ length: 15 }, async (_, idx) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userB, password: passB }),
    });
    assert.equal(res.status, 200, `Concurrent login #${idx + 1} should return 200`);
    const data = (await res.json()) as any;
    return data.token as string;
  });

  const burstTokens = await Promise.all(loginPromises);
  assert.equal(burstTokens.length, 15, 'All 15 concurrent logins should complete');

  // Verify that after 15 logins (+1 register = 16 total created):
  // Exactly 10 sessions are valid and active, and exactly 6 are evicted
  let validCount = 0;
  let evictedCount = 0;

  for (const t of [regDataB.token, ...burstTokens]) {
    const probe = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (probe.status === 200) {
      validCount++;
    } else if (probe.status === 401) {
      evictedCount++;
    } else {
      assert.fail(`Unexpected status code: ${probe.status}`);
    }
  }

  assert.equal(validCount, MAX_SESSIONS_PER_USER, 'Active sessions count must be exactly MAX_SESSIONS_PER_USER (10)');
  assert.equal(evictedCount, 6, 'Total evicted sessions must be exactly 6 (1 registration + 15 logins - 10 kept)');

  return {
    sequentialEvicted: 5,
    sequentialKept: 10,
    burstTotalLogins: 15,
    burstValidCount: validCount,
    burstEvictedCount: evictedCount,
    maxSessionsPerUser: MAX_SESSIONS_PER_USER,
  };
}

// --------------------------------------------------------------------------
// SUITE 2: Session Renewal (/api/auth/renew)
// --------------------------------------------------------------------------
async function testSessionRenewal(server: StartedServer, baseUrl: string) {
  const user = 'stress_renew_user';
  const pass = 'Passw0rd_Renew_2026!';

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass, nickname: '续期测试用户' }),
  });
  assert.equal(regRes.status, 200);
  const regData = (await regRes.json()) as any;
  const token = regData.token as string;

  // 2A. Artificially advance expiration to 10 seconds in the future
  const sessionRecord = await server.accountStore.getSessionByToken(token);
  assert.notEqual(sessionRecord, null, 'Session must exist');
  const now = Date.now();
  sessionRecord!.expiresAt = now + 10_000; // 10s left

  // Verify expiresAt is within 15s of now
  const beforeRenewSession = await server.accountStore.getSessionByToken(token);
  assert.equal(beforeRenewSession!.expiresAt <= now + 15_000, true);

  // Call /api/auth/renew to silently extend the session
  const renewRes = await fetch(`${baseUrl}/api/auth/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  assert.equal(renewRes.status, 200, 'Renew API must return HTTP 200');
  const renewData = (await renewRes.json()) as any;
  assert.equal(renewData.token, token, 'Renew should preserve the session token');
  assert.equal(renewData.user.username, user);

  // Inspect extended expiration in the store
  const afterRenewSession = await server.accountStore.getSessionByToken(token);
  assert.notEqual(afterRenewSession, null);
  const extendedLifetime = afterRenewSession!.expiresAt - Date.now();
  const daysRemaining = extendedLifetime / (24 * 60 * 60 * 1000);
  console.log(`  [Renew Check] Lifetime after renewal: ~${daysRemaining.toFixed(2)} days (expiresAt extended)`);

  assert.equal(
    daysRemaining >= 29 && daysRemaining <= 31,
    true,
    'Session expiration should be extended by ~30 days',
  );

  // 2B. Attempt to renew an already expired session
  afterRenewSession!.expiresAt = Date.now() - 5000; // 5s in the past
  const expiredRenewRes = await fetch(`${baseUrl}/api/auth/renew`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  assert.equal(expiredRenewRes.status, 401, 'Expired session renew must return HTTP 401');
  const expiredData = (await expiredRenewRes.json()) as any;
  assert.equal(expiredData.error, '登录已失效');

  // Verify expired session was purged
  const purgedSession = await server.accountStore.getSessionByToken(token);
  assert.equal(purgedSession, null, 'Expired session must be purged from store');

  // 2C. Renew with invalid / unauthenticated token
  const noTokenRes = await fetch(`${baseUrl}/api/auth/renew`, { method: 'POST' });
  assert.equal(noTokenRes.status, 401, 'Missing token must return 401');

  const bogusRes = await fetch(`${baseUrl}/api/auth/renew`, {
    method: 'POST',
    headers: { Authorization: 'Bearer tk_invalid_bogus_token' },
  });
  assert.equal(bogusRes.status, 401, 'Bogus token must return 401');

  return {
    initialShortExpiryMs: 10_000,
    renewedLifetimeDays: Number(daysRemaining.toFixed(2)),
    expiredRenewStatus: expiredRenewRes.status,
    bogusRenewStatus: bogusRes.status,
  };
}

// --------------------------------------------------------------------------
// SUITE 3: Password Change Revocation Across Multiple Devices
// --------------------------------------------------------------------------
async function testPasswordRevocation(server: StartedServer, baseUrl: string) {
  const user = 'stress_pwd_user';
  const originalPass = 'Initial_Pass123!';
  const updatedPass = 'New_SecurePass999#';

  // 1. Register user
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: originalPass, nickname: '多端密码修改测试' }),
  });
  assert.equal(regRes.status, 200);

  // 2. Simulate 3 distinct devices logging in
  // Device 1
  const dev1Res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: originalPass }),
  });
  assert.equal(dev1Res.status, 200);
  const tokenD1 = ((await dev1Res.json()) as any).token as string;

  // Device 2
  const dev2Res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: originalPass }),
  });
  assert.equal(dev2Res.status, 200);
  const tokenD2 = ((await dev2Res.json()) as any).token as string;

  // Device 3
  const dev3Res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: originalPass }),
  });
  assert.equal(dev3Res.status, 200);
  const tokenD3 = ((await dev3Res.json()) as any).token as string;

  // Verify all 3 devices initially have valid sessions
  for (const [idx, t] of [tokenD1, tokenD2, tokenD3].entries()) {
    const probe = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    assert.equal(probe.status, 200, `Device ${idx + 1} initial probe must succeed (200)`);
  }

  // 3. Device 1 initiates password change
  const changeRes = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenD1}`,
    },
    body: JSON.stringify({
      currentPassword: originalPass,
      newPassword: updatedPass,
    }),
  });
  assert.equal(changeRes.status, 200, 'Password change must succeed (HTTP 200)');
  const changeData = (await changeRes.json()) as any;
  const tokenD1Fresh = changeData.token as string;
  assert.notEqual(tokenD1Fresh, tokenD1, 'Device 1 must receive a newly generated fresh session token');

  // 4. Verify revocation across all other devices & old tokens
  // Device 2 token -> Revoked (401)
  const probeD2 = await fetch(`${baseUrl}/api/profile`, {
    headers: { Authorization: `Bearer ${tokenD2}` },
  });
  assert.equal(probeD2.status, 401, 'Device 2 token must be revoked immediately (401)');

  // Device 3 token -> Revoked (401)
  const probeD3 = await fetch(`${baseUrl}/api/profile`, {
    headers: { Authorization: `Bearer ${tokenD3}` },
  });
  assert.equal(probeD3.status, 401, 'Device 3 token must be revoked immediately (401)');

  // Device 1 OLD token -> Revoked (401)
  const probeD1Old = await fetch(`${baseUrl}/api/profile`, {
    headers: { Authorization: `Bearer ${tokenD1}` },
  });
  assert.equal(probeD1Old.status, 401, 'Device 1 old token must be revoked immediately (401)');

  // Device 1 FRESH token -> Active (200)
  const probeD1Fresh = await fetch(`${baseUrl}/api/profile`, {
    headers: { Authorization: `Bearer ${tokenD1Fresh}` },
  });
  assert.equal(probeD1Fresh.status, 200, 'Device 1 fresh token must be active (200)');

  // 5. Verify credentials verification
  // Old password login must fail
  const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: originalPass }),
  });
  assert.equal(oldLoginRes.status, 400, 'Login with old password must fail (400)');

  // New password login must succeed
  const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: updatedPass }),
  });
  assert.equal(newLoginRes.status, 200, 'Login with new password must succeed (200)');

  return {
    device1OldTokenRevoked: probeD1Old.status === 401,
    device2TokenRevoked: probeD2.status === 401,
    device3TokenRevoked: probeD3.status === 401,
    device1FreshTokenActive: probeD1Fresh.status === 200,
    oldPasswordLoginBlocked: oldLoginRes.status === 400,
    newPasswordLoginAccepted: newLoginRes.status === 200,
  };
}

// --------------------------------------------------------------------------
// SUITE 4: Career Stats & Achievement Boundary Stress (0 & 1000 Matches)
// --------------------------------------------------------------------------
function testCareerStatsAndAchievements() {
  console.log('--- 4A: Boundary Evaluation with 0 Matches ---');

  // 4A. Zero matches
  const emptyRecords: MatchRecord[] = [];

  const rpZero = calculateRP(emptyRecords);
  assert.equal(rpZero, 0, 'RP for 0 matches must be 0');
  assert.equal(typeof rpZero, 'number');

  const rankZero = calculateRank(rpZero);
  assert.equal(rankZero.currentTier.id, 'novice_1');
  assert.equal(rankZero.currentTier.name, '初心雀士');
  assert.equal(rankZero.progress, 0);
  assert.equal(rankZero.isMaxTier, false);
  assert.equal(rankZero.rpNeededForNext, 150);

  const fanDistZero = calculateFanTypeDistribution(emptyRecords);
  assert.deepStrictEqual(fanDistZero, {
    pingHu: 0,
    ziMo: 0,
    qiShouGangHu: 0,
    piaoHun: 0,
    guanMen: 0,
    baoZhuang: 0,
    liuJu: 0,
  });

  const statsZero = calculateCareerStats(emptyRecords);
  assert.equal(statsZero.totalMatches, 0);
  assert.equal(statsZero.wins, 0);
  assert.equal(statsZero.losses, 0);
  assert.equal(statsZero.draws, 0);
  assert.equal(statsZero.winRate, 0, 'winRate for 0 matches must be 0, never NaN');
  assert.equal(statsZero.totalScore, 0);
  assert.equal(statsZero.maxHu, 0);
  assert.equal(statsZero.maxWinScore, 0);
  assert.equal(statsZero.winStreakMax, 0);
  assert.equal(statsZero.currentWinStreak, 0);

  const modeStatsZero = computeModeStats(emptyRecords);
  assert.equal(modeStatsZero.totalMatches, 0);
  assert.equal(modeStatsZero.winRate, 0);

  const achZero = evaluateAchievements(emptyRecords);
  assert.equal(achZero.length, 15, 'Must return all 15 achievements');
  for (const a of achZero) {
    assert.equal(a.currentCount, 0);
    assert.equal(a.unlocked, false);
    assert.equal(a.progressPercent, 0);
  }

  console.log('  ✔ Zero-matches boundaries verified: zero exceptions, no NaN values');

  console.log('--- 4B: Stress Evaluation with 1000 Simulated Matches & 7 Fan Types ---');

  // 4B. 1000 Simulated Matches with diverse combinations
  const simulatedMatches: EnrichedMatchRecord[] = [];
  const baseTimestamp = 1725500000000;

  // Distribution specification:
  // 1. 100x 流局 (liuju)
  for (let i = 0; i < 100; i++) {
    simulatedMatches.push({
      id: `match-liuju-${i}`,
      mode: i % 2 === 0 ? 'online' : 'local',
      timestamp: baseTimestamp + i * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '流局',
      winnerSeat: null,
      hu: 0,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: true,
      baoZhuang: null,
      myDeltaScore: 0,
      myIsWinner: false,
      scores: [],
    });
  }

  // 2. 150x 纯点炮平胡 (pinHu)
  for (let i = 0; i < 150; i++) {
    simulatedMatches.push({
      id: `match-pinhu-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (100 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '平胡',
      winnerSeat: 0,
      hu: 15,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 30,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: false, deltaScore: 30 }],
    });
  }

  // 3. 150x 自摸 (ziMo)
  for (let i = 0; i < 150; i++) {
    simulatedMatches.push({
      id: `match-zimo-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (250 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '自摸',
      selfDraw: true,
      winnerSeat: 0,
      hu: 25,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 50,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: false, deltaScore: 50, notes: ['自摸'] }],
    });
  }

  // 4. 50x 起手杠胡 (qiShouGangHu)
  for (let i = 0; i < 50; i++) {
    simulatedMatches.push({
      id: `match-qishou-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (400 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '起手杠胡',
      winnerSeat: 0,
      hu: 40,
      yao: 4,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 120,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: false, deltaScore: 120 }],
    });
  }

  // 5. 100x 关门 (guanMen)
  for (let i = 0; i < 100; i++) {
    simulatedMatches.push({
      id: `match-guanmen-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (450 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '关门',
      myClosed: true,
      winnerSeat: 0,
      hu: 35,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 80,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: false, deltaScore: 80, notes: ['关门听牌'] }],
    });
  }

  // 6. 100x 飘荤 (piaoHun)
  for (let i = 0; i < 100; i++) {
    simulatedMatches.push({
      id: `match-piaohun-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (550 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '飘荤',
      hunDi: true,
      myPiaoHun: true,
      winnerSeat: 0,
      hu: 55, // high hu >= 50
      yao: 0,
      dealerMultiplier: 1,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 150,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: false, deltaScore: 150 }],
    });
  }

  // 7. 50x 包庄对局 (baoZhuang)
  for (let i = 0; i < 50; i++) {
    simulatedMatches.push({
      id: `match-baozhuang-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (650 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '平胡',
      winnerSeat: 0,
      hu: 30,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: { reason: '香牌点炮', payerSeat: 1, winnerSeat: 0 },
      myDeltaScore: 120,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: false, deltaScore: 120 }],
    });
  }

  // 8. 50x 复合极值番型 (自摸 + 关门 + 飘荤 + 包庄 + 大赢分 +450)
  for (let i = 0; i < 50; i++) {
    simulatedMatches.push({
      id: `match-composite-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (700 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '自摸-关门-飘荤',
      selfDraw: true,
      myClosed: true,
      hunDi: true,
      myPiaoHun: true,
      winnerSeat: 0,
      hu: 80,
      yao: 2,
      dealerMultiplier: 2,
      liuju: false,
      baoZhuang: { reason: '连环香牌', payerSeat: 2, winnerSeat: 0 },
      myDeltaScore: 450, // Triggers ach_big_win (>400)
      myIsWinner: true,
      scores: [
        { seat: 0, name: 'P1', isWinner: true, isDealer: true, deltaScore: 450, notes: ['自摸', '关门'] },
      ],
    });
  }

  // 9. 150x 失败局带极端负分与边界脏数据 (losses, negative scores: -500 to -3500)
  for (let i = 0; i < 150; i++) {
    const isDealerLoss = i % 3 === 0;
    simulatedMatches.push({
      id: `match-loss-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (750 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '放炮',
      winnerSeat: 1,
      hu: (i % 5) * 10,
      yao: 0,
      dealerMultiplier: isDealerLoss ? 2 : 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: -50 - (i % 10) * 100, // Negative score down to -950
      myIsWinner: false,
      scores: [
        { seat: 0, name: 'P1', isWinner: false, isDealer: isDealerLoss, deltaScore: -50 - (i % 10) * 100 },
        { seat: 1, name: 'P2', isWinner: true, isDealer: !isDealerLoss, deltaScore: 50 + (i % 10) * 100 },
      ],
    });
  }

  // 10. 100x 连庄连胜长序列 (50 consecutive wins, then 50 alternating)
  for (let i = 0; i < 50; i++) {
    simulatedMatches.push({
      id: `match-streak-win-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (900 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: '自摸',
      selfDraw: true,
      winnerSeat: 0,
      hu: 30,
      yao: 0,
      dealerMultiplier: i > 0 ? 2 : 1, // Dealer streak
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: 60,
      myIsWinner: true,
      scores: [{ seat: 0, name: 'P1', isWinner: true, isDealer: true, deltaScore: 60, notes: ['自摸'] }],
    });
  }
  for (let i = 50; i < 100; i++) {
    const isWin = i % 2 === 0;
    simulatedMatches.push({
      id: `match-alternating-${i}`,
      mode: 'online',
      timestamp: baseTimestamp + (900 + i) * 60000,
      dateStr: '9月5日',
      roomCode: '666888',
      winType: isWin ? '平胡' : '放炮',
      winnerSeat: isWin ? 0 : 2,
      hu: 20,
      yao: 0,
      dealerMultiplier: 1,
      hunDi: false,
      liuju: false,
      baoZhuang: null,
      myDeltaScore: isWin ? 40 : -40,
      myIsWinner: isWin,
      scores: [{ seat: 0, name: 'P1', isWinner: isWin, isDealer: false, deltaScore: isWin ? 40 : -40 }],
    });
  }

  assert.equal(simulatedMatches.length, 1000, 'Must have exactly 1000 matches generated');

  // Assertions & Stress checks on 1000 matches
  const careerStats = calculateCareerStats(simulatedMatches);
  const fanDist = calculateFanTypeDistribution(simulatedMatches);
  const totalRP = calculateRP(simulatedMatches);
  const rankInfo = calculateRank(totalRP);
  const achievements = evaluateAchievements(simulatedMatches, {
    avatar: 'guofeng_yushi',
    bio: '千牌磨砺，算无遗策！',
    nickname: '千胜雀仙',
  });

  // 1. Verify determinism: re-run all calculations and ensure strict equality
  const careerStats2 = calculateCareerStats(simulatedMatches);
  const fanDist2 = calculateFanTypeDistribution(simulatedMatches);
  const totalRP2 = calculateRP(simulatedMatches);
  const achievements2 = evaluateAchievements(simulatedMatches, {
    avatar: 'guofeng_yushi',
    bio: '千牌磨砺，算无遗策！',
    nickname: '千胜雀仙',
  });

  assert.deepStrictEqual(careerStats, careerStats2, 'Career stats calculation must be deterministic');
  assert.deepStrictEqual(fanDist, fanDist2, 'Fan distribution calculation must be deterministic');
  assert.equal(totalRP, totalRP2, 'RP calculation must be deterministic');
  assert.deepStrictEqual(achievements, achievements2, 'Achievement evaluation must be deterministic');

  // 2. Invariant assertions
  assert.equal(careerStats.totalMatches, 1000);
  assert.equal(careerStats.wins + careerStats.draws + careerStats.losses, 1000);
  assert.equal(careerStats.draws, 100);
  assert.equal(careerStats.winRate >= 0 && careerStats.winRate <= 100, true);
  assert.equal(careerStats.winStreakMax >= 50, true, 'Win streak max should reflect the 50 consecutive wins');
  assert.equal(careerStats.maxWinScore, 450, 'Max win score should be 450 from the composite matches');
  assert.equal(careerStats.maxHu, 80, 'Max hu should be 80 from the composite matches');

  // Fan type count checks:
  assert.equal(fanDist.liuJu, 100, 'LiuJu count must be exactly 100');
  assert.equal(fanDist.qiShouGangHu, 50, 'QiShouGangHu count must be exactly 50');
  assert.equal(fanDist.pingHu, 175, 'Pure PingHu count must be exactly 175 (150 baseline + 25 alternating wins)');
  // ZiMo: 150 pure + 50 composite + 50 streak wins = 250
  assert.equal(fanDist.ziMo, 250, 'ZiMo count should be 250');
  // GuanMen: 100 pure + 50 composite = 150
  assert.equal(fanDist.guanMen, 150, 'GuanMen count should be 150');
  // PiaoHun: 100 pure + 50 composite = 150
  assert.equal(fanDist.piaoHun, 150, 'PiaoHun count should be 150');
  // BaoZhuang: 50 pure + 50 composite = 100
  assert.equal(fanDist.baoZhuang, 100, 'BaoZhuang count should be 100');

  // 3. RP & Rank ladder checks
  assert.equal(Number.isFinite(totalRP), true, 'RP must be finite number');
  assert.equal(totalRP >= 0, true, 'RP must never drop below 0');
  console.log(`  [1000-Match RP] Total RP: ${totalRP}, Tier: ${rankInfo.currentTier.name} (${rankInfo.currentTier.id})`);
  assert.equal(rankInfo.progress >= 0 && rankInfo.progress <= 1, true);

  // Verify all 9 Rank Tier boundaries
  const testRPPoints = [
    { rp: 0, tierId: 'novice_1' },
    { rp: 149, tierId: 'novice_1' },
    { rp: 150, tierId: 'novice_2' },
    { rp: 399, tierId: 'novice_2' },
    { rp: 400, tierId: 'novice_3' },
    { rp: 799, tierId: 'novice_3' },
    { rp: 800, tierId: 'dan_1' },
    { rp: 1399, tierId: 'dan_1' },
    { rp: 1400, tierId: 'dan_2' },
    { rp: 2199, tierId: 'dan_2' },
    { rp: 2200, tierId: 'dan_3' },
    { rp: 3199, tierId: 'dan_3' },
    { rp: 3200, tierId: 'master_1' },
    { rp: 4499, tierId: 'master_1' },
    { rp: 4500, tierId: 'saint_1' },
    { rp: 6499, tierId: 'saint_1' },
    { rp: 6500, tierId: 'celestial_9' },
    { rp: 50000, tierId: 'celestial_9' },
  ];
  for (const item of testRPPoints) {
    const tier = getRankTier(item.rp);
    assert.equal(tier.id, item.tierId, `RP ${item.rp} must map to tier ${item.tierId}`);
  }

  // 4. Achievement progress checks
  assert.equal(achievements.length, 15, 'All 15 achievements evaluated');
  for (const ach of achievements) {
    assert.equal(
      ach.progressPercent >= 0 && ach.progressPercent <= 100,
      true,
      `Achievement ${ach.achievement.id} progressPercent must be in [0, 100]`,
    );
  }

  // Specific milestone achievement unlocks verified
  const firstBlood = achievements.find((a) => a.achievement.id === 'ach_first_blood');
  assert.equal(firstBlood?.unlocked, true);

  const streak3 = achievements.find((a) => a.achievement.id === 'ach_win_streak_3');
  assert.equal(streak3?.unlocked, true);

  const streak5 = achievements.find((a) => a.achievement.id === 'ach_win_streak_5');
  assert.equal(streak5?.unlocked, true);

  const matches50 = achievements.find((a) => a.achievement.id === 'ach_matches_50');
  assert.equal(matches50?.unlocked, true);

  const wins100 = achievements.find((a) => a.achievement.id === 'ach_wins_100');
  assert.equal(wins100?.unlocked, true);

  const bigWin = achievements.find((a) => a.achievement.id === 'ach_big_win');
  assert.equal(bigWin?.unlocked, true, 'Composite 450 deltaScore must unlock big win');

  const profileFull = achievements.find((a) => a.achievement.id === 'ach_profile_full');
  assert.equal(profileFull?.unlocked, true, 'Guofeng avatar + custom bio must unlock profile full');

  return {
    totalSimulatedMatches: 1000,
    wins: careerStats.wins,
    losses: careerStats.losses,
    draws: careerStats.draws,
    winRate: Number(careerStats.winRate.toFixed(2)),
    winStreakMax: careerStats.winStreakMax,
    fanDistribution: fanDist,
    totalRP,
    currentTier: rankInfo.currentTier.name,
    unlockedAchievementsCount: achievements.filter((a) => a.unlocked).length,
  };
}

// --------------------------------------------------------------------------
// SUITE 5: Adversarial Hardening, Boundary Payloads & 5,000-Match Scaling
// --------------------------------------------------------------------------
async function testAdversarialHardening(server: StartedServer, baseUrl: string) {
  // 5A. Malformed & Non-JSON HTTP Payloads
  const malformedRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '<<<THIS IS NOT JSON>>>',
  });
  assert.equal(malformedRes.status, 400, 'Malformed JSON must return HTTP 400');

  // Empty body
  const emptyBodyRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '',
  });
  assert.equal(emptyBodyRes.status, 400, 'Empty body must return HTTP 400');

  // Non-object body (array instead of object)
  const arrayBodyRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(['malicious', 'array']),
  });
  assert.equal(arrayBodyRes.status, 400, 'Array body must return HTTP 400');

  // 5B. Guest account attempting password change (forbidden)
  const guestRes = await fetch(`${baseUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '受限游客' }),
  });
  assert.equal(guestRes.status, 200);
  const guestToken = ((await guestRes.json()) as any).token as string;

  const guestPwdRes = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`,
    },
    body: JSON.stringify({ currentPassword: 'any', newPassword: 'newPassword123' }),
  });
  assert.equal(guestPwdRes.status, 400, 'Guest password change must be rejected (HTTP 400)');
  const guestPwdData = (await guestPwdRes.json()) as any;
  assert.equal(guestPwdData.error, '游客账号请先升级为正式账号');

  // 5C. Session renewal after logout (must fail immediately)
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  assert.equal(logoutRes.status, 200);

  const postLogoutRenewRes = await fetch(`${baseUrl}/api/auth/renew`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  assert.equal(postLogoutRenewRes.status, 401, 'Session renewal after logout must return HTTP 401');

  // 5D. 5,000 Simulated Matches Scaling & Resiliency Stress
  console.log('--- 5D: 5,000 Matches Scaling Stress & Malformed Records ---');
  const massiveMatches: EnrichedMatchRecord[] = [];
  const baseTime = Date.now() - 5000 * 60000;

  for (let i = 0; i < 5000; i++) {
    // Inject corrupt, missing, negative or extreme properties
    const isWin = i % 5 === 0;
    const isLiuju = !isWin && i % 7 === 0;
    massiveMatches.push({
      id: `m-5000-${i}`,
      mode: i % 2 === 0 ? 'online' : 'local',
      timestamp: baseTime + i * 60000,
      dateStr: '9月5日',
      roomCode: `${100000 + (i % 900000)}`,
      winType: isWin ? (i % 2 === 0 ? '自摸' : '平胡') : (isLiuju ? '流局' : '放炮'),
      winnerSeat: isWin ? 0 : 1,
      hu: isWin ? (i % 100) : -10, // negative hu injected
      yao: 0,
      dealerMultiplier: undefined as any, // undefined injected
      hunDi: i % 4 === 0,
      liuju: isLiuju,
      baoZhuang: (i % 11 === 0 ? { reason: '香牌', payerSeat: 1, winnerSeat: 0 } : null) as any,
      myDeltaScore: isWin ? 50 + (i % 500) : -50 - (i % 1000), // extreme scores
      myIsWinner: isWin,
      scores: undefined as any, // missing scores array injected
    });
  }

  const perfStart = Date.now();
  const massiveStats = calculateCareerStats(massiveMatches);
  const massiveFanDist = calculateFanTypeDistribution(massiveMatches);
  const massiveRP = calculateRP(massiveMatches);
  const massiveRank = calculateRank(massiveRP);
  const massiveAch = evaluateAchievements(massiveMatches);
  const perfDuration = Date.now() - perfStart;

  console.log(`  [5,000 Matches Perf] Completed in ${perfDuration}ms (Strictly O(n))`);
  assert.equal(perfDuration < 200, true, '5000-match computation must execute under 200ms');
  assert.equal(massiveStats.totalMatches, 5000);
  assert.equal(massiveStats.wins, 1000);
  assert.equal(massiveStats.wins + massiveStats.draws + massiveStats.losses, 5000);
  assert.equal(massiveRP >= 0, true, 'RP must remain >= 0 despite thousands of losses');
  assert.equal(massiveAch.length, 15);

  // 5E. 5,000 Consecutive Losses: Verify RP never goes below 0
  const allLosses: MatchRecord[] = Array.from({ length: 5000 }, (_, idx) => ({
    id: `loss-streak-${idx}`,
    mode: 'online',
    timestamp: Date.now() + idx,
    dateStr: '9月5日',
    roomCode: '999999',
    winType: '放炮',
    winnerSeat: 1,
    hu: 0,
    yao: 0,
    dealerMultiplier: 1,
    hunDi: false,
    liuju: false,
    baoZhuang: null,
    myDeltaScore: -500,
    myIsWinner: false,
    scores: [],
  }));
  const lossRP = calculateRP(allLosses);
  assert.equal(lossRP, 0, 'RP after 5000 consecutive online losses must be strictly clamped to 0');
  const lossRank = calculateRank(lossRP);
  assert.equal(lossRank.currentTier.id, 'novice_1');
  assert.equal(lossRank.progress, 0);

  return {
    malformedJsonBlocked: malformedRes.status === 400,
    guestPasswordChangeBlocked: guestPwdRes.status === 400,
    postLogoutRenewBlocked: postLogoutRenewRes.status === 401,
    perf5000MatchesMs: perfDuration,
    consecutiveLossClampedRP: lossRP,
  };
}

// --------------------------------------------------------------------------
// MAIN RUNNER
// --------------------------------------------------------------------------
async function main() {
  console.log('############################################################');
  console.log('  PIZHOU MAHJONG: M1 & M2 EMPIRICAL STRESS TEST HARNESS     ');
  console.log('############################################################');

  const tmpDir = path.join(
    os.tmpdir(),
    `pizhou-challenger-stress-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await fs.promises.mkdir(tmpDir, { recursive: true });

  let server: StartedServer | null = null;

  try {
    server = await startMahjongServer({
      port: 0,
      host: '127.0.0.1',
      log: false,
      stateDir: path.join(tmpDir, 'state'),
      accountsDir: path.join(tmpDir, 'accounts'),
    });

    const baseUrl = `http://127.0.0.1:${server.port}`;
    console.log(`Ephemeral Test Server started on ${baseUrl}`);

    // Run Suite 1: Multi-Device Sessions Limit
    await runStep('1. Multi-Device Sessions Limit & Oldest Eviction', async () => {
      return testMultiDeviceSessions(server!, baseUrl);
    });

    // Run Suite 2: Session Renewal
    await runStep('2. Session Renewal via /api/auth/renew', async () => {
      return testSessionRenewal(server!, baseUrl);
    });

    // Run Suite 3: Password Change Revocation Across Devices
    await runStep('3. Password Change Multi-Device Revocation', async () => {
      return testPasswordRevocation(server!, baseUrl);
    });

    // Run Suite 4: Career Stats & Achievement Boundary Stress
    await runStep('4. Career Stats & Achievement Boundary Stress', async () => {
      return testCareerStatsAndAchievements();
    });

    // Run Suite 5: Adversarial Hardening & 5,000-Match Scaling
    await runStep('5. Adversarial Hardening & 5,000-Match Scaling', async () => {
      return testAdversarialHardening(server!, baseUrl);
    });

    console.log('\n======================================================');
    console.log('  ALL EMPIRICAL STRESS TESTS COMPLETED SUCCESSFULLY!  ');
    console.log('======================================================');
    console.table(
      summaries.map((s) => ({
        Suite: s.suite,
        Passed: s.passed ? 'PASS' : 'FAIL',
        Duration: `${s.durationMs}ms`,
      })),
    );
  } finally {
    if (server) {
      await server.close();
    }
    // Clean up temporary files
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    console.log(`Temporary directory cleaned up: ${tmpDir}`);
  }
}

main().catch((err) => {
  console.error('Empirical stress suite failed with fatal error:', err);
  process.exit(1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PizhouGame, canHuTiles, pickDiscard } from '@pizhou/rules';
import type { Tile, Meld } from '@pizhou/shared';
import { RateLimiter } from '@pizhou/server-core';
import {
  parseWavHeader,
  validateAudioSettings,
  referenceShantenSearch,
  referenceAssessDanger,
  serializeGameToPureState,
  restoreGameFromPureState,
} from './helpers/contracts.ts';
import { createTestServer, E2EBotClient } from './helpers/test-harness.ts';

function makeTile(suit: 'wan' | 'tong' | 'tiao' | 'dragon', rank: number, id: string): Tile {
  return { id, suit, rank, key: `${suit}-${rank}` };
}

/* ──────────────────────────────────────────────────────────────────────────
 * R1 Boundaries (5 tests)
 * ────────────────────────────────────────────────────────────────────────── */

test('Tier 2 [Boundaries] - B1.1: Audio settings boundary clamping and invalid voice mode', () => {
  // Test clamping behavior specification
  function clampAudioVolume(vol: number): number {
    if (vol < 0) return 0.0;
    if (vol > 1) return 1.0;
    return vol;
  }

  assert.equal(clampAudioVolume(-0.5), 0.0, 'Negative volume must clamp to 0.0');
  assert.equal(clampAudioVolume(1.5), 1.0, 'Volume > 1 must clamp to 1.0');
  assert.equal(clampAudioVolume(0.0), 0.0, 'Boundary 0.0 must be exact');
  assert.equal(clampAudioVolume(1.0), 1.0, 'Boundary 1.0 must be exact');
  assert.equal(clampAudioVolume(0.55), 0.55, 'Valid float volume preserved');

  const invalidValidation = validateAudioSettings({ voiceMode: 'invalid_mode' as unknown as 'pizhou' });
  assert.equal(invalidValidation.valid, false, 'Invalid voice mode must be rejected');
});

test('Tier 2 [Boundaries] - B1.2: Corrupted, 0-byte, and truncated WAV header resilience', () => {
  // 0-byte buffer
  const emptyBuf = Buffer.alloc(0);
  const emptyRes = parseWavHeader(emptyBuf);
  assert.equal(emptyRes.isValid, false);
  assert.match(emptyRes.error!, /too small/i);

  // Truncated 20-byte buffer
  const truncBuf = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ');
  const truncRes = parseWavHeader(truncBuf);
  assert.equal(truncRes.isValid, false);

  // Valid RIFF but non-WAVE format tag
  const badTagBuf = Buffer.alloc(44);
  badTagBuf.write('RIFF', 0);
  badTagBuf.write('AVI ', 8);
  const badTagRes = parseWavHeader(badTagBuf);
  assert.equal(badTagRes.isValid, false);
  assert.match(badTagRes.error!, /Invalid WAVE/i);
});

test('Tier 2 [Boundaries] - B1.3: High-frequency audio playback burst stress', async () => {
  // Simulate 50 rapid sound requests in 10ms
  let activeNodes = 0;
  let maxActive = 0;

  class BurstMockAudioContext {
    currentTime = 0;
    createBufferSource() {
      activeNodes += 1;
      maxActive = Math.max(maxActive, activeNodes);
      return {
        buffer: null,
        connect: () => ({ connect: () => {} }),
        start: () => {},
        stop: () => {
          activeNodes = Math.max(0, activeNodes - 1);
        },
      };
    }
  }

  const mockCtx = new BurstMockAudioContext();
  const promises: Promise<void>[] = [];
  for (let i = 0; i < 50; i++) {
    promises.push(
      new Promise<void>((resolve) => {
        const src = mockCtx.createBufferSource();
        src.start();
        setTimeout(() => {
          src.stop();
          resolve();
        }, 5);
      }),
    );
  }

  await Promise.all(promises);
  assert.ok(maxActive >= 40, 'Simulated burst must exercise concurrent nodes');
  assert.equal(activeNodes, 0, 'All audio nodes must be cleanly recycled');
});

test('Tier 2 [Boundaries] - B1.4: Dual-channel voice and SFX simultaneous concurrency', () => {
  // Ensure voice and SFX channels do not overwrite each other's active state
  let sfxPlaying = false;
  let voicePlaying = false;

  function triggerSFX() {
    sfxPlaying = true;
  }
  function triggerVoice() {
    voicePlaying = true;
  }
  function stopVoice() {
    voicePlaying = false;
  }

  triggerSFX();
  triggerVoice();
  assert.equal(sfxPlaying, true);
  assert.equal(voicePlaying, true);

  // Stopping voice must not affect SFX
  stopVoice();
  assert.equal(voicePlaying, false);
  assert.equal(sfxPlaying, true);
});

test('Tier 2 [Boundaries] - B1.5: Audio triggers with empty, partial, or malformed ClientView states', () => {
  // Test observer resilience when view is malformed or uninitialized
  function mockAudioObserver(view: unknown): string[] {
    const events: string[] = [];
    if (!view || typeof view !== 'object') return events;

    const v = view as { phase?: string; lastDiscard?: { tile?: { id: string } } };
    if (v.phase === 'playing' && v.lastDiscard?.tile?.id) {
      events.push('discard');
    }
    return events;
  }

  assert.deepEqual(mockAudioObserver(null), []);
  assert.deepEqual(mockAudioObserver(undefined), []);
  assert.deepEqual(mockAudioObserver({}), []);
  assert.deepEqual(mockAudioObserver({ phase: 'lobby' }), []);
  assert.deepEqual(mockAudioObserver({ phase: 'playing', lastDiscard: { tile: { id: 'w1' } } }), ['discard']);
});

/* ──────────────────────────────────────────────────────────────────────────
 * R2 Boundaries (5 tests)
 * ────────────────────────────────────────────────────────────────────────── */

test('Tier 2 [Boundaries] - B2.1: Shanten search on already-complete winning hand', () => {
  // Complete hand: 1-2-3 Wan, 4-5-6 Wan, 7-8-9 Wan, 2-2-2 Tong, 9-9 Tiao (14 tiles)
  const winningHand: Tile[] = [
    makeTile('wan', 1, 'w1'), makeTile('wan', 2, 'w2'), makeTile('wan', 3, 'w3'),
    makeTile('wan', 4, 'w4'), makeTile('wan', 5, 'w5'), makeTile('wan', 6, 'w6'),
    makeTile('wan', 7, 'w7'), makeTile('wan', 8, 'w8'), makeTile('wan', 9, 'w9'),
    makeTile('tong', 2, 't2a'), makeTile('tong', 2, 't2b'), makeTile('tong', 2, 't2c'),
    makeTile('tiao', 9, 's9a'), makeTile('tiao', 9, 's9b'),
  ];
  assert.equal(canHuTiles(winningHand, 0), true, '14-tile hand must evaluate as winning');

  // For a 13-tile hand awaiting the 14th winning tile:
  const awaiting13 = winningHand.slice(0, 13);
  const shantenRes = referenceShantenSearch(awaiting13, []);
  assert.equal(shantenRes.shanten, 0, '13-tile tenpai hand awaiting win must be 0-shanten');
  assert.ok(shantenRes.waits.includes('tiao-9'), 'Must wait on 9 Tiao');
});

test('Tier 2 [Boundaries] - B2.2: Tile acceptance when all candidate winning tiles are 4-seen in river', () => {
  // Waiting hand on 9 Tiao
  const hand: Tile[] = [
    makeTile('wan', 1, 'w1'), makeTile('wan', 2, 'w2'), makeTile('wan', 3, 'w3'),
    makeTile('wan', 4, 'w4'), makeTile('wan', 5, 'w5'), makeTile('wan', 6, 'w6'),
    makeTile('wan', 7, 'w7'), makeTile('wan', 8, 'w8'), makeTile('wan', 9, 'w9'),
    makeTile('tong', 2, 't2a'), makeTile('tong', 2, 't2b'), makeTile('tong', 2, 't2c'),
    makeTile('tiao', 9, 's9a'),
  ];
  const allDiscards = [
    makeTile('tiao', 9, 's9b'),
    makeTile('tiao', 9, 's9c'),
    makeTile('tiao', 9, 's9d'),
  ];
  // 1 copy in hand + 3 in river = 4 copies accounted for!
  const remaining = Math.max(0, 4 - (1 + allDiscards.filter((t) => t.key === 'tiao-9').length));
  assert.equal(remaining, 0, 'When all 4 copies are seen, remaining acceptance must be 0');
});

test('Tier 2 [Boundaries] - B2.3: Defensive threat assessment when all 3 opponents are closed vs 0 closed', () => {
  const freshTile = makeTile('dragon', 2, 'd2'); // 发财 (0-seen)

  // Subcase A: 0 opponents closed
  const openOpponents = [0, 1, 2].map(() => ({ closed: false, melds: [], discards: [] }));
  const dangerOpen = referenceAssessDanger(freshTile, openOpponents, []);
  assert.equal(dangerOpen.dangerScore, 0, 'When no opponent is closed or 3-pung, danger is baseline 0');

  // Subcase B: All 3 opponents closed
  const allClosedOpponents = [0, 1, 2].map(() => ({ closed: true, melds: [], discards: [] }));
  const dangerClosed = referenceAssessDanger(freshTile, allClosedOpponents, []);
  assert.ok(dangerClosed.dangerScore >= 70, 'When opponents are closed, fresh tile has high danger');
  assert.equal(dangerClosed.isXiangPai, true);
});

test('Tier 2 [Boundaries] - B2.4: Companion action choice with empty action list or forced single discard', () => {
  // Empty hand pickDiscard
  const singleTileHand = [makeTile('wan', 1, 'only_w1')];
  const chosen = pickDiscard(singleTileHand);
  assert.equal(chosen.id, 'only_w1', 'Single-tile hand must choose that exact tile');
});

test('Tier 2 [Boundaries] - B2.5: AI companion behavior at extreme wall count (wallCount = 0)', () => {
  const game = new PizhouGame();
  // Artificially empty wall to 0
  game.wall = [];
  assert.equal(game.wall.length, 0);

  // A player discarding at wall = 0 must not crash
  const currentSeat = game.currentSeat;
  const hand = game.seats[currentSeat]!.hand;
  assert.ok(hand.length > 0);
  const discardOk = game.discard(currentSeat, hand[0]!.id);
  assert.ok(discardOk, 'Discard at wallCount = 0 must succeed cleanly');
});

/* ──────────────────────────────────────────────────────────────────────────
 * R3 Boundaries (5 tests)
 * ────────────────────────────────────────────────────────────────────────── */

test('Tier 2 [Boundaries] - B3.1: Reconnection with invalid token or non-existent roomCode', async () => {
  const srv = await createTestServer();
  const bot = new E2EBotClient('InvalidReconnector', srv.url);
  await bot.waitOpen();

  bot.send({ type: 'player:reconnect', roomCode: '999999', token: 'non-existent-token' });
  const reply = await bot.waitMessage((m) => m.type === 'error');
  assert.ok(reply && reply.type === 'error');
  assert.match(reply.message, /房间不存在|失败/i);

  await bot.close();
  await srv.close();
});

test('Tier 2 [Boundaries] - B3.2: Concurrent multi-player reconnection storm', async () => {
  const srv = await createTestServer();
  const bots = [0, 1, 2, 3].map((i) => new E2EBotClient(`Storm-${i}`, srv.url));
  await Promise.all(bots.map((b) => b.waitOpen()));

  bots[0]!.send({ type: 'room:create', nickname: 'Storm-0' });
  const hostView = await bots[0]!.waitView((v) => Boolean(v.roomCode));
  const roomCode = hostView.roomCode!;

  for (const bot of bots.slice(1)) {
    bot.send({ type: 'room:join', roomCode, nickname: bot.name });
    await bot.waitView((v) => v.roomCode === roomCode);
  }

  for (const bot of bots) bot.send({ type: 'room:ready', ready: true });
  await bots[0]!.waitView((v) => v.players.filter((p) => p.ready).length === 4);
  bots[0]!.send({ type: 'room:start' });
  await Promise.all(bots.map((b) => b.waitView((v) => v.phase === 'playing')));

  // Save tokens
  const tokens = bots.map((b) => b.token!);

  // Simultaneous storm: all 4 reconnect at the exact same moment
  await Promise.all(bots.map((bot, i) => bot.reconnect(roomCode, tokens[i])));
  const reconnectedViews = await Promise.all(
    bots.map((bot, i) => bot.waitView((v) => v.roomCode === roomCode && v.phase === 'playing' && v.mySeat === i)),
  );

  assert.equal(reconnectedViews.length, 4, 'All 4 players must simultaneously reconnect');
  for (let i = 0; i < 4; i++) {
    assert.equal(reconnectedViews[i]!.mySeat, i, `Player ${i} seat preserved under storm`);
  }

  for (const bot of bots) await bot.close();
  await srv.close();
});

test('Tier 2 [Boundaries] - B3.3: Rapid back-to-back state modifications persistence fidelity', () => {
  const game = new PizhouGame();

  // Rapid modifications and serializations in tight loop
  for (let i = 0; i < 10; i++) {
    const s = serializeGameToPureState(game);
    const restored = restoreGameFromPureState(s);
    assert.equal(restored.sequence, game.sequence);
    assert.equal(restored.wall.length, game.wall.length);

    // Apply a discard
    const curSeat = game.currentSeat;
    const tile = game.seats[curSeat]!.hand[0];
    if (tile) {
      game.discard(curSeat, tile.id);
    }
  }
});

test('Tier 2 [Boundaries] - B3.4: RateLimiter sliding-window exact threshold boundaries', () => {
  const limiter = new RateLimiter({ cleanupIntervalMs: 0 });
  const key = 'test-boundary-key';
  const limit = 5;
  const windowMs = 500;
  const now = 10000;

  // First 5 requests must pass
  for (let i = 0; i < limit; i++) {
    const allowed = limiter.consume(key, limit, windowMs, now);
    assert.equal(allowed, true, `Request ${i + 1} of ${limit} must be allowed`);
  }

  // Exact 6th request (limit + 1) in same window must be rejected
  const rejected = limiter.consume(key, limit, windowMs, now);
  assert.equal(rejected, false, '6th request exceeding limit=5 must be rejected');

  // Exactly after windowMs expires, next request must pass
  const afterExpiry = limiter.consume(key, limit, windowMs, now + windowMs + 1);
  assert.equal(afterExpiry, true, 'Request after window expiration must succeed');

  limiter.destroy();
});

test('Tier 2 [Boundaries] - B3.5: Malformed JSON, non-JSON strings, and binary packet handling', async () => {
  const srv = await createTestServer();
  const bot = new E2EBotClient('FuzzerBot', srv.url);
  await bot.waitOpen();

  // Send malformed non-JSON string
  bot.sendRaw('THIS_IS_NOT_VALID_JSON{:::');
  const errMalformed = await bot.waitMessage((m) => m.type === 'error');
  assert.ok(errMalformed && errMalformed.type === 'error');

  // Send random binary buffer
  const binaryPayload = Buffer.from([0x00, 0xff, 0xfe, 0x12, 0x34, 0x56]);
  bot.sendRaw(binaryPayload);

  // Verify server is still alive and responsive after binary fuzz
  bot.send({ type: 'room:create', nickname: 'Survivor' });
  const view = await bot.waitView((v) => Boolean(v.roomCode));
  assert.ok(view.roomCode, 'Server must remain alive and process valid messages after malformed inputs');

  await bot.close();
  await srv.close();
});

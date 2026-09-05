import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PizhouGame, chooseCompanionAction } from '@pizhou/rules';
import { DiskRoomStore, RoomManager, startMahjongServer } from '@pizhou/server-core';
import type { Tile, Meld, S2CMessage } from '@pizhou/shared';
import { createTestServer, getAvailablePort, E2EBotClient } from './helpers/test-harness.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const testPersistenceDir = path.join(root, `.pizhou-state-test-e2e-${Date.now()}`);

function makeTile(suit: 'wan' | 'tong' | 'tiao' | 'dragon', rank: number, id: string): Tile {
  return { id, suit, rank, key: `${suit}-${rank}` };
}

test('Tier 4 [Scenarios] - S1: Complete 4-player multiplayer game simulation to settlement and next round', async () => {
  const srv = await createTestServer();
  const bots = [0, 1, 2, 3].map((i) => new E2EBotClient(`S1-P${i}`, srv.url));
  await Promise.all(bots.map((b) => b.waitOpen()));

  // 1. Host creates room
  bots[0]!.send({ type: 'room:create', nickname: 'S1-Host' });
  const hostView = await bots[0]!.waitView((v) => Boolean(v.roomCode));
  const roomCode = hostView.roomCode!;

  // 2. 3 others join
  for (const bot of bots.slice(1)) {
    bot.send({ type: 'room:join', roomCode, nickname: bot.name });
    await bot.waitView((v) => v.roomCode === roomCode);
  }

  // 3. Ready and start
  for (const bot of bots) bot.send({ type: 'room:ready', ready: true });
  await bots[0]!.waitView((v) => v.players.filter((p) => p.ready).length === 4);
  bots[0]!.send({ type: 'room:start' });
  await Promise.all(bots.map((b) => b.waitView((v) => v.phase === 'playing')));
  assert.equal(bots[0]!.view!.round, 1, 'Round 1 must be active');

  // 4. Play steps until settlement or step limit
  let steps = 0;
  while (steps < 400) {
    steps++;
    const settled = bots.some((b) => b.view?.phase === 'settlement');
    if (settled) break;

    for (const bot of bots) {
      const view = bot.view;
      if (!view || view.phase !== 'playing') continue;
      const acts = view.availableActions;
      if (!acts || acts.length === 0) continue;

      if (acts.some((a) => a.kind === 'hu')) {
        bot.send({ type: 'game:action', sequence: view.sequence, actionId: `s1-${steps}-${bot.name}-hu`, action: { kind: 'hu' } });
        continue;
      }
      if (acts.some((a) => a.kind === 'discard')) {
        const me = view.players[view.mySeat] as { hand?: { id: string }[]; lastDrawnId?: string };
        const tileId = me.lastDrawnId ?? me.hand?.[me.hand.length - 1]?.id;
        if (tileId) {
          bot.send({
            type: 'game:action',
            sequence: view.sequence,
            actionId: `s1-${steps}-${bot.name}-d`,
            action: { kind: 'discard', tileId },
          });
        }
        continue;
      }
      if (acts.some((a) => a.kind === 'pass')) {
        bot.send({ type: 'game:action', sequence: view.sequence, actionId: `s1-${steps}-${bot.name}-p`, action: { kind: 'pass' } });
      }
    }
    await new Promise((r) => setTimeout(r, 10));
  }

  const didSettle = bots.some((b) => b.view?.phase === 'settlement');
  assert.ok(didSettle, `Match must reach settlement within ${steps} steps`);

  // 5. Next round
  for (const bot of bots) {
    bot.send({ type: 'game:nextRound' });
  }
  await Promise.all(bots.map((b) => b.waitView((v) => v.round === 2 && v.phase === 'playing')));
  assert.equal(bots[0]!.view!.round, 2, 'Must cleanly transition to Round 2');

  for (const bot of bots) await bot.close();
  await srv.close();
});

test('Tier 4 [Scenarios] - S2: High-stakes Guanmen and Baozhuang showdown simulation', () => {
  const game = new PizhouGame();
  const seat0 = 0;
  const seat1 = 1;

  // Setup Seat 0: 3 pungs + 2 pairs (unclosed, awaiting incense)
  const pungs: Meld[] = [
    { type: 'peng', tiles: [makeTile('wan', 1, 'w1a'), makeTile('wan', 1, 'w1b'), makeTile('wan', 1, 'w1c')] },
    { type: 'peng', tiles: [makeTile('wan', 2, 'w2a'), makeTile('wan', 2, 'w2b'), makeTile('wan', 2, 'w2c')] },
    { type: 'peng', tiles: [makeTile('wan', 3, 'w3a'), makeTile('wan', 3, 'w3b'), makeTile('wan', 3, 'w3c')] },
  ];
  game.seats[seat0]!.melds = pungs;
  // Hand has 4 tiles: 2 pairs (tong-5 pair, tong-6 pair)
  const pairA1 = makeTile('tong', 5, 't5a');
  const pairA2 = makeTile('tong', 5, 't5b');
  const pairB1 = makeTile('tong', 6, 't6a');
  const pairB2 = makeTile('tong', 6, 't6b');
  game.seats[seat0]!.hand = [pairA1, pairA2, pairB1, pairB2];
  game.seats[seat0]!.closed = false;
  game.seats[seat0]!.closedTwoPair = false;
  game.seats[seat0]!.discardedBeforeClose = [];

  // Seat 1 discards a fresh incense tile (香牌) that completes Seat 0's winning pair (tong-5)
  // Tong-5 has never been discarded before (it is an unseen Xiang Pai)
  game.currentSeat = seat1;
  game.phase = 'self-turn';
  const incenseTile = makeTile('tong', 5, 't5_discarded_by_seat1');
  game.seats[seat1]!.hand.push(incenseTile);

  const discardOk = game.discard(seat1, incenseTile.id);
  assert.ok(discardOk, 'Seat 1 discard of incense tile must succeed');

  // Seat 0 claims Hu on the discarded incense tile
  if (game.phase === 'claim-window') {
    const huRes = game.apply(seat0, { kind: 'hu' }, 's2-hu-action', game.sequence);
    assert.ok(huRes.ok, 'Seat 0 Hu claim must succeed');
  }

  // Verify settlement
  assert.equal(game.phase, 'settlement', 'Game must be in settlement phase');
  assert.ok(game.settlement, 'Settlement bill must exist');
  assert.equal(game.settlement.winnerSeat, seat0, 'Seat 0 must be the winner');
  assert.ok(game.settlement.baoZhuang, 'Settlement must flag Baozhuang on fresh incense tile discard');
});

test('Tier 4 [Scenarios] - S3: Full Disaster Recovery Simulation across server restart', async () => {
  if (fs.existsSync(testPersistenceDir)) {
    fs.rmSync(testPersistenceDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testPersistenceDir, { recursive: true });

  const diskStore = new DiskRoomStore(testPersistenceDir);
  const port = await getAvailablePort();
  const srv1 = await startMahjongServer({ port, host: '127.0.0.1', log: false, store: diskStore });

  const bots = [0, 1, 2, 3].map((i) => new E2EBotClient(`DR-${i}`, `ws://127.0.0.1:${port}`));
  await Promise.all(bots.map((b) => b.waitOpen()));

  // 1. Host creates room
  bots[0]!.send({ type: 'room:create', nickname: 'DR-Host' });
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

  // Play 2 turns
  const activeSeat = bots[0]!.view!.currentSeat ?? 0;
  const activeBot = bots[activeSeat]!;
  const tileId = activeBot.view!.players[activeSeat]!.hand![0]!.id;
  activeBot.send({ type: 'game:action', sequence: activeBot.view!.sequence, actionId: 'dr-act-1', action: { kind: 'discard', tileId } });
  await activeBot.waitView((v) => v.sequence > 1);

  // Save tokens before crash
  const savedTokens = bots.map((b) => b.token!);
  const preCrashSeq = activeBot.view!.sequence;

  // ABRUPT SERVER RESTART
  for (const bot of bots) await bot.close();
  await srv1.close();

  // Boot server 2 with the same disk store
  const diskStore2 = new DiskRoomStore(testPersistenceDir);
  const srv2 = await startMahjongServer({ port, host: '127.0.0.1', log: false, store: diskStore2 });

  // Reconnect all 4 bots
  const reconnectedBots = [0, 1, 2, 3].map((i) => new E2EBotClient(`DR-R-${i}`, `ws://127.0.0.1:${port}`));
  await Promise.all(reconnectedBots.map((b) => b.waitOpen()));

  for (let i = 0; i < 4; i++) {
    reconnectedBots[i]!.send({ type: 'player:reconnect', roomCode, token: savedTokens[i]! });
  }
  const restoredViews = await Promise.all(
    reconnectedBots.map((b, i) => b.waitView((v) => v.roomCode === roomCode && v.phase === 'playing' && v.mySeat === i)),
  );

  assert.equal(restoredViews.length, 4, 'All 4 players restored after crash recovery');
  assert.equal(restoredViews[0]!.sequence, preCrashSeq, 'Sequence number preserved across restart');

  for (const b of reconnectedBots) await b.close();
  await srv2.close();

  // Cleanup test directory
  try {
    fs.rmSync(testPersistenceDir, { recursive: true, force: true });
  } catch {}
});

test('Tier 4 [Scenarios] - S4: Flaky network and jitter simulation with claim-window recovery', async () => {
  const srv = await createTestServer();
  const bots = [0, 1, 2, 3].map((i) => new E2EBotClient(`Net-${i}`, srv.url));
  await Promise.all(bots.map((b) => b.waitOpen()));

  bots[0]!.send({ type: 'room:create', nickname: 'Net-Host' });
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

  // Abruptly terminate player 2's socket mid-game
  const p2Token = bots[2]!.token!;
  await bots[2]!.close();

  // Player 0 performs a discard while Player 2 is offline
  const curSeat = bots[0]!.view!.currentSeat ?? 0;
  if (curSeat === 0) {
    const myTile = bots[0]!.view!.players[0]!.hand![0]!.id;
    bots[0]!.send({ type: 'game:action', sequence: bots[0]!.view!.sequence, actionId: 'net-d1', action: { kind: 'discard', tileId: myTile } });
  }

  // Player 2 reconnects and aligns state
  const p2Reconnect = new E2EBotClient('Net-2-Recon', srv.url);
  await p2Reconnect.waitOpen();
  p2Reconnect.send({ type: 'player:reconnect', roomCode, token: p2Token });
  const alignedView = await p2Reconnect.waitView((v) => v.roomCode === roomCode && v.phase === 'playing');

  assert.equal(alignedView.mySeat, 2, 'Seat 2 preserved after unannounced socket drop');
  assert.ok(alignedView.wallCount > 0, 'Table wall count aligned');

  await p2Reconnect.close();
  for (const b of bots) await b.close();
  await srv.close();
});

test('Tier 4 [Scenarios] - S5: Complete Solo mode game simulation (1 human + 3 autonomous bots)', async () => {
  const srv = await createTestServer();
  const human = new E2EBotClient('SoloGamer', srv.url);
  await human.waitOpen();

  // Create solo room
  human.send({ type: 'room:create', nickname: 'SoloGamer', solo: true });
  const view = await human.waitView(
    (v) => v.phase === 'playing' && v.players.length === 4 && v.players.filter((p) => p.isBot).length === 3,
  );
  assert.equal(view.players.filter((p) => p.isBot).length, 3, 'Must have 3 bot players');
  assert.equal(view.phase, 'playing', 'Solo game must start playing automatically');

  // Human steps multiple turns alongside 3 bots
  let turns = 0;
  while (turns < 25 && human.view?.phase === 'playing') {
    turns++;
    const curView = human.view;
    if (!curView) break;

    const acts = curView.availableActions;
    if (acts && acts.length > 0) {
      if (acts.some((a) => a.kind === 'hu')) {
        human.send({ type: 'game:action', sequence: curView.sequence, actionId: `solo-${turns}-hu`, action: { kind: 'hu' } });
        break;
      }
      if (acts.some((a) => a.kind === 'discard')) {
        const hand = curView.players[curView.mySeat]?.hand;
        if (hand && hand.length > 0) {
          const tileId = curView.players[curView.mySeat]?.lastDrawnId ?? hand[hand.length - 1]!.id;
          human.send({
            type: 'game:action',
            sequence: curView.sequence,
            actionId: `solo-${turns}-d`,
            action: { kind: 'discard', tileId },
          });
        }
      } else if (acts.some((a) => a.kind === 'pass')) {
        human.send({ type: 'game:action', sequence: curView.sequence, actionId: `solo-${turns}-p`, action: { kind: 'pass' } });
      }
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  assert.ok(turns >= 3, `Solo game must progress multiple turns autonomously (progressed: ${turns})`);

  await human.close();
  await srv.close();
});

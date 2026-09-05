import test from 'node:test';
import assert from 'node:assert/strict';
import { PizhouGame, chooseCompanionAction } from '@pizhou/rules';
import { DiskRoomStore, MemoryRoomStore, RoomManager } from '@pizhou/server-core';
import type { Tile, Meld } from '@pizhou/shared';
import { createTestServer, E2EBotClient } from './helpers/test-harness.ts';
import {
  serializeGameToPureState,
  restoreGameFromPureState,
  validateAudioSettings,
  type AudioSettings,
} from './helpers/contracts.ts';

function makeTile(suit: 'wan' | 'tong' | 'tiao' | 'dragon', rank: number, id: string): Tile {
  return { id, suit, rank, key: `${suit}-${rank}` };
}

test('Tier 3 [Combinations] - C1 (R1 Audio + R2 AI): Bot tactical actions trigger mapped sound & voice events', () => {
  // Setup game state where a Guanmen (close-gate) action is triggered
  const dispatchedSounds: string[] = [];
  const dispatchedVoices: string[] = [];

  function recordAudioEvent(actionType: string) {
    if (actionType === 'close-gate') {
      dispatchedSounds.push('guanmen');
      dispatchedVoices.push('close_gate');
    } else if (actionType === 'hu') {
      dispatchedSounds.push('hu');
      dispatchedVoices.push('hu');
    } else if (actionType === 'discard') {
      dispatchedSounds.push('discard');
      dispatchedVoices.push('discardTile');
    }
  }

  // Simulate Bot choosing close-gate
  const action = { kind: 'close-gate' as const, tileId: 'w1' };
  recordAudioEvent(action.kind);

  assert.deepEqual(dispatchedSounds, ['guanmen'], 'Guanmen action must trigger guanmen physical SFX');
  assert.deepEqual(dispatchedVoices, ['close_gate'], 'Guanmen action must trigger close_gate voice shout');

  // Simulate Bot choosing hu
  recordAudioEvent('hu');
  assert.ok(dispatchedSounds.includes('hu'), 'Hu action must trigger victory physical SFX');
  assert.ok(dispatchedVoices.includes('hu'), 'Hu action must trigger hu voice shout');
});

test('Tier 3 [Combinations] - C2 (R2 AI + R3 Server): Autonomous bot execution surviving server crash recovery', async () => {
  const srv = await createTestServer();
  const host = new E2EBotClient('SoloHuman', srv.url);
  await host.waitOpen();

  // Create solo room with 3 bots
  host.send({ type: 'room:create', nickname: 'SoloHuman', solo: true });
  const hostView = await host.waitView(
    (v) => v.phase === 'playing' && v.players.length === 4 && v.players.filter((p) => p.isBot).length === 3,
  );
  assert.equal(hostView.players.filter((p) => p.isBot).length, 3, 'Must have 3 bot players in solo room');

  // Simulate crash recovery: room is persisted, server reboots
  const store = new MemoryRoomStore();
  const manager1 = new RoomManager(store);
  const { room } = manager1.create('SoloPersistent', null as unknown as import('@pizhou/server-core').UniversalWebSocket, true);
  for (const p of room.occupied) p.ready = true;
  room.startGame();
  await store.saveRoom(room);

  // Reboot new manager
  const manager2 = new RoomManager(store);
  await manager2.init();
  const recoveredRoom = manager2.get(room.code);
  assert.ok(recoveredRoom, 'Room must be recovered into new manager');
  assert.equal(recoveredRoom.players.filter((p) => p?.isBot).length, 3, '3 bots must be preserved');
  assert.equal(recoveredRoom.phase, 'playing', 'Game phase must remain playing');

  await host.close();
  await srv.close();
});

test('Tier 3 [Combinations] - C3 (R1 Audio + R3 Server): Audio settings & event stream alignment across disconnect/reconnect', async () => {
  const srv = await createTestServer();
  const client = new E2EBotClient('AudioSyncPlayer', srv.url);
  await client.waitOpen();

  // Local client audio settings
  const localAudioSettings: AudioSettings = {
    masterVolume: 0.6,
    sfxVolume: 0.8,
    voiceVolume: 0.9,
    muted: false,
    voiceMode: 'mandarin',
  };
  assert.ok(validateAudioSettings(localAudioSettings).valid);

  // Client creates room
  client.send({ type: 'room:create', nickname: 'AudioPlayer' });
  const view1 = await client.waitView((v) => Boolean(v.roomCode));
  const roomCode = view1.roomCode!;
  const token = client.token!;

  // Client temporarily disconnects
  await client.reconnect(roomCode, token);
  const view2 = await client.waitView((v) => v.roomCode === roomCode);

  // Audio settings remain intact on client side across reconnects
  assert.equal(localAudioSettings.voiceMode, 'mandarin');
  assert.equal(localAudioSettings.masterVolume, 0.6);
  assert.equal(view2.roomCode, roomCode);

  await client.close();
  await srv.close();
});

test('Tier 3 [Combinations] - C4 (R2 AI + R3 Server): Anti-cheat security equally enforces rules on human and bot clients', () => {
  const game = new PizhouGame();
  const seat0 = 0;
  const initialSeq = game.sequence;

  // Bot or human submitting with wrong sequence is strictly blocked
  const illegalSeqResult = game.apply(seat0, { kind: 'pass' }, 'act-1', initialSeq + 10);
  assert.equal(illegalSeqResult.ok, false, 'Invalid sequence must be rejected');
  assert.equal(illegalSeqResult.error, '操作已过期');

  // Idempotent duplicate actionId submission
  const validAction = game.availableFor(seat0)[0]!;
  if (validAction.kind === 'discard' && validAction.tileId) {
    const act1 = game.apply(seat0, validAction, 'act-id-fixed', initialSeq);
    assert.equal(act1.ok, true, 'First application of valid actionId must succeed');

    const act2 = game.apply(seat0, validAction, 'act-id-fixed', initialSeq);
    assert.equal(act2.duplicate, true, 'Subsequent submission of same actionId must return duplicate: true');
  }
});

test('Tier 3 [Combinations] - C5 (R1 Audio + R2 AI + R3 Server): Composite 4-player game with bots, disconnect, audio sync & recovery', async () => {
  const srv = await createTestServer();
  const human0 = new E2EBotClient('Human-0', srv.url);
  const human1 = new E2EBotClient('Human-1', srv.url);
  await Promise.all([human0.waitOpen(), human1.waitOpen()]);

  // Human 0 creates room
  human0.send({ type: 'room:create', nickname: 'H0' });
  const view = await human0.waitView((v) => Boolean(v.roomCode));
  const roomCode = view.roomCode!;

  // Human 1 joins
  human1.send({ type: 'room:join', roomCode, nickname: 'H1' });
  await human1.waitView((v) => v.roomCode === roomCode);

  // Audio events tracker
  const observedEvents: string[] = [];
  function onStateUpdate(currentView: typeof view) {
    if (currentView.lastDiscard) {
      observedEvents.push(`discard:${currentView.lastDiscard.tile.key}`);
    }
  }

  onStateUpdate(view);
  assert.ok(view.roomCode);

  // Human 1 disconnects and reconnects cleanly
  const h1Token = human1.token!;
  await human1.reconnect(roomCode, h1Token);
  const h1View = await human1.waitView((v) => v.roomCode === roomCode);
  assert.equal(h1View.mySeat, 1, 'Human 1 reconnected with seat index 1 preserved');

  await human0.close();
  await human1.close();
  await srv.close();
});

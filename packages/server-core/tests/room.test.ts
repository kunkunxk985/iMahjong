import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WebSocket } from 'ws';
import { EMPTY_ROOM_TTL_MS, type Settlement } from '@pizhou/shared';
import { cancelBots, hasScheduledBots, scheduleBots } from '../src/bots.ts';
import { handleMessage } from '../src/messageHandler.ts';
import { RoomManager } from '../src/room.ts';

function socket(): WebSocket {
  return {
    OPEN: 1,
    readyState: 1,
    send() {},
  } as unknown as WebSocket;
}

function settlement(winnerSeat: number | null, liuju = false): Settlement {
  return {
    liuju,
    winnerSeat,
    winnerNickname: null,
    winType: liuju ? 'liuju' : 'ping-hu',
    hu: 0,
    huBeforeDealer: 0,
    yao: 0,
    dealerMultiplier: 1,
    selfDraw: false,
    breakdown: [],
    scores: [],
    transactions: [],
    hunDi: false,
    baoZhuang: null,
    drawReason: liuju ? 'wall' : null,
  };
}

test('创建六位数字房号，空昵称使用座位默认名', () => {
  const manager = new RoomManager();
  const { room, player } = manager.create('   ', socket());
  assert.match(room.code, /^\d{6}$/);
  assert.equal(player.nickname, '玩家1');
  assert.equal(manager.join('ABC123', '朋友', socket()), '房间号应为6位数字');
});

test('四人准备后开始牌局', () => {
  const manager = new RoomManager();
  const created = manager.create('东家', socket());
  const players = [created.player];
  for (const name of ['南家', '西家', '北家']) {
    const joined = manager.join(created.room.code, name, socket());
    assert.notEqual(typeof joined, 'string');
    if (typeof joined !== 'string') players.push(joined.player);
  }
  for (const player of players) player.ready = true;
  assert.equal(created.room.startGame(), null);
  assert.equal(created.room.phase, 'playing');
  assert.equal(created.room.round, 1);
  assert.ok(created.room.game);
});

test('房间换庄：流局和闲家胡换下一家，庄家胡才连庄', () => {
  const manager = new RoomManager();
  const created = manager.create('东家', socket());
  for (const name of ['南家', '西家', '北家']) {
    const joined = manager.join(created.room.code, name, socket());
    assert.notEqual(typeof joined, 'string');
  }

  for (const player of created.room.occupied) player.ready = true;
  assert.equal(created.room.startGame(), null);
  assert.equal(created.room.dealer, 0);

  created.room.game!.settlement = settlement(null, true);
  created.room.resetToLobbyForAgain();
  assert.equal(created.room.dealer, 1);

  for (const player of created.room.occupied) player.ready = true;
  assert.equal(created.room.startGame(), null);
  created.room.game!.settlement = settlement(1);
  created.room.resetToLobbyForAgain();
  assert.equal(created.room.dealer, 1);

  for (const player of created.room.occupied) player.ready = true;
  assert.equal(created.room.startGame(), null);
  created.room.game!.settlement = settlement(3);
  created.room.resetToLobbyForAgain();
  assert.equal(created.room.dealer, 2);
});

test('大厅房主离开后转移房主，最后一人离开后删除房间', () => {
  const manager = new RoomManager();
  const firstSocket = socket();
  const secondSocket = socket();
  const created = manager.create('房主', firstSocket);
  const joined = manager.join(created.room.code, '朋友', secondSocket);
  assert.notEqual(typeof joined, 'string');
  assert.equal(manager.leave(firstSocket)?.removed, true);
  assert.equal(created.room.hostSeat, 1);
  assert.equal(manager.leave(secondSocket)?.removed, true);
  assert.equal(manager.get(created.room.code), undefined);
});

test('断线后可凭 token 回到原座位', () => {
  const manager = new RoomManager();
  const firstSocket = socket();
  const created = manager.create('玩家', firstSocket);
  manager.dropSocket(firstSocket);
  const nextSocket = socket();
  const result = manager.reconnect(created.room.code, created.player.token, nextSocket);
  assert.notEqual(typeof result, 'string');
  if (typeof result !== 'string') {
    assert.equal(result.player.seat, created.player.seat);
    assert.equal(result.player.ws, nextSocket);
    assert.equal(result.player.offlineAt, null);
  }
});

test('空房超时清理会返回被删除的房号', () => {
  const manager = new RoomManager();
  const created = manager.create('玩家', socket());
  const offlineAt = Date.now();
  created.room.markOffline(created.player, offlineAt);
  const removed = manager.sweep(offlineAt + EMPTY_ROOM_TTL_MS + 1);
  assert.deepEqual(removed, [created.room.code]);
  assert.equal(manager.get(created.room.code), undefined);
});

test('机器人定时器可以按房间取消', () => {
  const manager = new RoomManager();
  const created = manager.create('玩家', socket(), true);
  assert.equal(created.room.startGame(), null);
  scheduleBots(created.room);
  assert.equal(hasScheduledBots(created.room.code), true);
  cancelBots(created.room.code);
  assert.equal(hasScheduledBots(created.room.code), false);
});

test('房主设置底分单价后同步到 ClientView', () => {
  const manager = new RoomManager();
  const created = manager.create('房主', socket(), false, 0.2);
  assert.equal(created.room.pointRate, 0.2);
  const view = created.room.viewFor(created.player);
  assert.equal(view.pointRate, 0.2);
});

test('房间 ClientView 会同步玩家自定义头像与网名', () => {
  const customAvatar = 'data:image/webp;base64,dGVzdC1hdmF0YXI=';
  const manager = new RoomManager();
  const created = manager.create('云端雀士', socket(), false, 0.1, customAvatar);
  const joined = manager.join(created.room.code, '朋友', socket(), '🐱');

  assert.notEqual(typeof joined, 'string');
  const view = created.room.viewFor(created.player);
  assert.equal(view.players[0]?.nickname, '云端雀士');
  assert.equal(view.players[0]?.avatar, customAvatar);
  assert.equal(view.players[1]?.avatar, '🐱');
});

test('游戏开始后底分单价固定，不可中途修改', () => {
  const manager = new RoomManager();
  const ws = socket();
  const created = manager.create('房主', ws, true, 0.2);
  assert.equal(created.room.startGame(), null);
  assert.equal(created.room.phase, 'playing');

  // Attempt to modify config mid-game should be rejected
  let lastMessage: any = null;
  const mockWs = {
    OPEN: 1,
    readyState: 1,
    send(data: string) {
      lastMessage = JSON.parse(data);
    },
  };
  (manager as any).bySocket = () => ({ room: created.room, player: created.player });
  handleMessage(manager, mockWs as any, { type: 'room:config', pointRate: 0.5 });
  assert.equal(created.room.pointRate, 0.2); // Still 0.2, unchanged!
  assert.equal(lastMessage?.type, 'error');
  assert.match(lastMessage?.message, /已固定/);
});

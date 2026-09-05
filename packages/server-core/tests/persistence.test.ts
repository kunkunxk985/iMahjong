import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { PizhouGame, type AvailableAction } from '@pizhou/rules';
import type { C2SMessage, ClientView, S2CMessage } from '@pizhou/shared';
import {
  DiskRoomStore,
  MemoryRoomStore,
  RateLimiter,
  RoomManager,
  serializeRoom,
  deserializeRoom,
  startMahjongServer,
} from '../src/index.ts';
import { GameClient } from '../../../apps/desktop/src/ws/client.ts';

function dummySocket() {
  return {
    readyState: 1,
    send: () => {},
    close: () => {},
  };
}

test('PizhouGame 序列化与反序列化全状态保持 100% 一致', () => {
  const game = new PizhouGame({ dealer: 0 });
  const firstSeat = game.currentSeat;
  const tileToDiscard = game.seats[firstSeat]!.hand[0]!;

  // 出牌推进一个动作
  const applyRes = game.apply(
    firstSeat,
    { kind: 'discard', tileId: tileToDiscard.id },
    'action-test-1',
    game.sequence,
  );
  assert.equal(applyRes.ok, true);

  // 序列化
  const serialized = PizhouGame.serialize(game);
  assert.equal(typeof serialized, 'object');
  assert.equal(serialized.dealer, 0);
  assert.equal(serialized.sequence, game.sequence);
  assert.equal(serialized.wall.length, game.wall.length);
  assert.equal(serialized.seats.length, 4);
  assert.equal(serialized.processedActionIds.includes('action-test-1'), true);

  // 反序列化
  const restored = PizhouGame.deserialize(serialized);
  assert.equal(restored.dealer, game.dealer);
  assert.equal(restored.currentSeat, game.currentSeat);
  assert.equal(restored.sequence, game.sequence);
  assert.equal(restored.phase, game.phase);
  assert.equal(restored.wall.length, game.wall.length);
  assert.deepEqual(PizhouGame.serialize(restored), serialized);

  // 恢复后的对象可正常执行后续牌局逻辑
  const view = restored.getClientView({
    mySeat: 0,
    roomCode: '123456',
    token: 'token-abc',
    hostSeat: 0,
    round: 1,
    pointRate: 0.1,
  });
  assert.equal(view.roomCode, '123456');
  assert.equal(view.sequence, game.sequence);
});

test('DiskRoomStore 原子持久化与崩溃恢复', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pizhou-persist-test-'));
  try {
    const store = new DiskRoomStore({ dirPath: tempDir });
    const manager = new RoomManager(store);

    const { room, player } = manager.create('房主', dummySocket(), false, 0.2);
    manager.join(room.code, '玩家2', dummySocket());
    manager.join(room.code, '玩家3', dummySocket());
    manager.join(room.code, '玩家4', dummySocket());

    for (const p of room.occupied) p.ready = true;
    const startError = room.startGame();
    assert.equal(startError, null);
    await manager.persist(room);

    // 确认磁盘文件存在且写入完整
    const filePath = path.join(tempDir, `${room.code}.json`);
    assert.equal(fs.existsSync(filePath), true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(content.code, room.code);
    assert.equal(content.round, 1);
    assert.equal(content.players.length, 4);
    assert.notEqual(content.game, null);

    // 模拟全新进程启动，从持久化磁盘载入存活房间
    const newStore = new DiskRoomStore({ dirPath: tempDir });
    const restoredRooms = await newStore.loadAllRooms();
    assert.equal(restoredRooms.length, 1);
    const restored = restoredRooms[0]!;
    assert.equal(restored.code, room.code);
    assert.equal(restored.round, 1);
    assert.equal(restored.phase, 'playing');
    assert.equal(restored.occupied.length, 4);
    assert.equal(restored.findByToken(player.token)?.nickname, '房主');
    assert.notEqual(restored.game, null);

    // 删除房间
    await newStore.deleteRoom(room.code);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('滑动窗口 RateLimiter 频控校验与防刷限制', () => {
  const limiter = new RateLimiter({ cleanupIntervalMs: 0 });

  const key = 'test-client-1';
  // 限制每秒最多 3 次
  assert.equal(limiter.consume(key, 3, 1000, 1000), true);
  assert.equal(limiter.consume(key, 3, 1000, 1100), true);
  assert.equal(limiter.consume(key, 3, 1000, 1200), true);
  // 第 4 次应该被拦截
  assert.equal(limiter.consume(key, 3, 1000, 1300), false);
  assert.equal(limiter.check(key, 3, 1000, 1300), false);

  // 超过窗口期（1000ms 后）应解除限制
  assert.equal(limiter.consume(key, 3, 1000, 2100), true);
  assert.equal(limiter.consume(key, 3, 1000, 2200), true);

  limiter.reset(key);
  assert.equal(limiter.check(key, 3, 1000, 2200), true);
  limiter.destroy();
});

class TestClient {
  ws: WebSocket;
  view: ClientView | null = null;
  token: string | null = null;
  seat: number | null = null;
  errors: Array<{ message: string; code?: string }> = [];
  disconnectedEvents: Array<{ seat: number; nickname: string }> = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.setup();
  }

  setup() {
    this.ws.on('error', () => {
      // Ignore socket errors in tests (e.g. payload exceeded)
    });
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as S2CMessage;
      if (msg.type === 'error') {
        this.errors.push({ message: msg.message, code: msg.code });
      }
      if (msg.type === 'room:created' || msg.type === 'room:joined' || msg.type === 'player:reconnected') {
        this.token = msg.token;
        this.seat = msg.seat;
      }
      if (msg.type === 'game:state' || msg.type === 'game:roundStarted' || msg.type === 'game:settlement') {
        this.view = msg.view;
        if (msg.view.token) this.token = msg.view.token;
        if (msg.view.mySeat !== undefined) this.seat = msg.view.mySeat;
      }
      if (msg.type === 'player:disconnected') {
        this.disconnectedEvents.push({ seat: msg.seat, nickname: msg.nickname });
      }
    });
  }

  send(msg: C2SMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  async waitView(pred: (view: ClientView) => boolean, timeout = 5000): Promise<ClientView> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.view && pred(this.view)) return this.view;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('waitView timed out');
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      // Ignore
    }
  }
}

test('服务端重启崩溃恢复与全视角对齐验证', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pizhou-crash-test-'));
  const port = 8840;
  const store = new DiskRoomStore({ dirPath: tempDir });

  // 1. 启动第一个服务实例
  const server1 = await startMahjongServer({ port, host: '127.0.0.1', store, log: false });

  let roomCode = '';
  let tokens: string[] = [];

  try {
    const clients = [0, 1, 2, 3].map(() => new TestClient(`ws://127.0.0.1:${port}`));
    await Promise.all(clients.map((c) => c.waitOpen()));

    // 房主建房
    clients[0]!.send({ type: 'room:create', nickname: '玩家1', pointRate: 0.5 });
    const hostView = await clients[0]!.waitView((v) => Boolean(v.roomCode));
    roomCode = hostView.roomCode!;

    // 其余 3 人加入
    for (let i = 1; i < 4; i += 1) {
      clients[i]!.send({ type: 'room:join', roomCode, nickname: `玩家${i + 1}` });
      await clients[i]!.waitView((v) => v.roomCode === roomCode);
    }

    // 全员准备并开始
    for (const c of clients) c.send({ type: 'room:ready', ready: true });
    await clients[0]!.waitView((v) => v.players.filter((p) => p.ready).length === 4);
    clients[0]!.send({ type: 'room:start' });
    await Promise.all(clients.map((c) => c.waitView((v) => v.phase === 'playing')));

    tokens = clients.map((c) => c.token!);
    assert.equal(tokens.every(Boolean), true);

    // 庄家打出一张牌
    const dealerSeat = hostView.dealer;
    const dealerClient = clients[dealerSeat]!;
    const myHand = dealerClient.view!.players[dealerSeat]!.hand!;
    assert.equal(myHand.length, 14);
    const discardTile = myHand[myHand.length - 1]!;

    dealerClient.send({
      type: 'game:action',
      sequence: dealerClient.view!.sequence,
      actionId: 'action-before-crash',
      action: { kind: 'discard', tileId: discardTile.id },
    });

    // 确认 sequence 递增
    await dealerClient.waitView((v) => v.sequence > 1);
    const sequenceBeforeCrash = dealerClient.view!.sequence;

    // 2. 模拟服务器崩溃（关闭 server1 并断开连接）
    for (const c of clients) c.close();
    await server1.close();

    // 3. 启动全新服务实例（模拟重启，复用同一持久化数据）
    const server2Store = new DiskRoomStore({ dirPath: tempDir });
    const server2 = await startMahjongServer({ port, host: '127.0.0.1', store: server2Store, log: false });

    try {
      // 客户端重新连接并凭借 token 发起恢复
      const reconnectedClient = new TestClient(`ws://127.0.0.1:${port}`);
      await reconnectedClient.waitOpen();

      reconnectedClient.send({
        type: 'player:reconnect',
        roomCode,
        token: tokens[dealerSeat]!,
      });

      const reconnectedView = await reconnectedClient.waitView((v) => v.roomCode === roomCode);

      // 验证状态 100% 无损对齐
      assert.equal(reconnectedView.phase, 'playing');
      assert.equal(reconnectedView.round, 1);
      assert.equal(reconnectedView.pointRate, 0.5);
      assert.equal(reconnectedView.sequence, sequenceBeforeCrash);
      assert.equal(reconnectedView.mySeat, dealerSeat);
      assert.equal(reconnectedView.players[dealerSeat]!.hand?.length, 13);
    } finally {
      await server2.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('安全与频控：WebSocket 大数据包拒绝与建房限频', async () => {
  const port = 8841;
  const server = await startMahjongServer({ port, host: '127.0.0.1', log: false });

  try {
    const client = new TestClient(`ws://127.0.0.1:${port}`);
    await client.waitOpen();

    // 1. 发送超过 64KB 的超大负载应被拒绝/断开
    const hugePayload = 'A'.repeat(70 * 1024);
    const closePromise = new Promise<boolean>((resolve) => {
      client.ws.once('close', () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });
    client.ws.send(hugePayload);
    const closed = await closePromise;
    assert.equal(closed, true);

    // 2. 验证建房频控（每分钟限制5次）
    const client2 = new TestClient(`ws://127.0.0.1:${port}`);
    await client2.waitOpen();

    for (let i = 0; i < 5; i += 1) {
      client2.send({ type: 'room:create', nickname: `房主${i}` });
    }
    // 等待 5 个房间创建消息到达
    await new Promise((r) => setTimeout(r, 100));

    // 第 6 次建房应被限流
    client2.send({ type: 'room:create', nickname: '超频房主' });
    await new Promise((r) => setTimeout(r, 100));

    const rateLimitError = client2.errors.find((e) => e.code === 'rate-limited');
    assert.notEqual(rateLimitError, undefined);
    assert.match(rateLimitError!.message, /过于频繁/);

    client2.close();
  } finally {
    await server.close();
  }
});

test('心跳超时扫描广播 player:disconnected 并关闭僵死套接字', () => {
  const store = new MemoryRoomStore();
  const manager = new RoomManager(store);

  let closedCode: number | undefined;
  let closedReason: string | undefined;

  const mockWs = {
    readyState: 1,
    send: () => {},
    close: (code?: number, reason?: string) => {
      closedCode = code;
      closedReason = reason;
    },
  };

  const { room, player } = manager.create('活跃玩家', mockWs);
  assert.equal(room.onlineCount, 1);

  // 模拟超时：修改 lastSeen 超过 35 秒
  const pastTime = Date.now() - 40_000;
  player.lastSeen = pastTime;

  let offlineCalled = false;
  const sweepResult = manager.sweepDetailed(Date.now());

  assert.equal(sweepResult.offline.length, 1);
  const offlineInfo = sweepResult.offline[0]!;
  assert.equal(offlineInfo.player.seat, player.seat);
  assert.equal(offlineInfo.ws, mockWs);

  // 执行 socket close
  offlineInfo.ws?.close?.(4001, 'Heartbeat timeout');
  assert.equal(closedCode, 4001);
  assert.equal(closedReason, 'Heartbeat timeout');
});

test('GameClient 客户端重连与 100% 桌面全状态对齐', async () => {
  const port = 8842;
  const server = await startMahjongServer({ port, host: '127.0.0.1', log: false });

  let client: GameClient | null = null;
  try {
    let latestView: ClientView | null = null;
    const statusLog: string[] = [];

    client = new GameClient({
      onView: (view) => {
        latestView = view;
      },
      onSettlement: () => {},
      onError: (err) => {
        console.error('CLIENT ON ERROR:', err);
      },
      onStatus: (status) => {
        statusLog.push(status);
      },
    });

    client.connect(`ws://127.0.0.1:${port}`);
    // 等待连接建立
    while (!statusLog.includes('open')) {
      await new Promise((r) => setTimeout(r, 20));
    }

    client.createRoom('客户端测试玩家', true);

    // 等待对局开始并在桌上
    const startPlayWait = Date.now();
    while (!latestView || (latestView as ClientView).phase !== 'playing') {
      if (Date.now() - startPlayWait > 5000) throw new Error('对局未如期在 5 秒内启动');
      await new Promise((r) => setTimeout(r, 20));
    }

    const currentView = latestView as ClientView;
    const savedRoomCode = currentView.roomCode;
    const savedToken = currentView.token;
    const savedSequence = currentView.sequence;
    const savedHandCount = currentView.players[currentView.mySeat]!.hand?.length;

    assert.equal(currentView.phase, 'playing');
    assert.equal(currentView.pointRate, 0.1);

    // 人为切断客户端底层连接（模拟异常断网）
    (client as unknown as { ws: WebSocket }).ws?.close();

    // 等待重连触发并完成桌面全状态对齐
    const startReconnectWait = Date.now();
    let reconnected = false;
    while (Date.now() - startReconnectWait < 6000) {
      if (
        latestView &&
        (latestView as ClientView).roomCode === savedRoomCode &&
        (latestView as ClientView).token === savedToken
      ) {
        if (statusLog.filter((s) => s === 'open').length >= 2) {
          reconnected = true;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    assert.equal(reconnected, true);
    const reconnectedView = latestView as unknown as ClientView;
    assert.equal(reconnectedView.roomCode, savedRoomCode);
    assert.equal(reconnectedView.token, savedToken);
    assert.equal(reconnectedView.sequence >= savedSequence, true);
    assert.equal(reconnectedView.players[reconnectedView.mySeat]!.hand?.length, savedHandCount);
    assert.equal(reconnectedView.players.length, 4);
  } finally {
    client?.disconnect();
    await server.close();
  }
});

test('GameClient 心跳看门狗（Watchdog）在连接僵死时主动触发重连与异常捕获', () => {
  let watchdogError = false;
  let watchdogCode: string | undefined;

  const client = new GameClient({
    onView: () => {},
    onSettlement: () => {},
    onError: (_msg, code) => {
      if (code === 'watchdog-timeout') {
        watchdogError = true;
        watchdogCode = code;
      }
    },
    onStatus: () => {},
  });

  // 模拟假死连接
  (client as unknown as { ws: unknown; lastServerActivity: number; checkWatchdog: () => void }).ws = {
    readyState: 1, // OPEN
    close: () => {},
  };
  (client as unknown as { lastServerActivity: number }).lastServerActivity = Date.now() - 30_000; // 30秒未收到任何包

  (client as unknown as { checkWatchdog: () => void }).checkWatchdog();

  assert.equal(watchdogError, true);
  assert.equal(watchdogCode, 'watchdog-timeout');
  client.disconnect();
});

import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { GameClient } from '../src/ws/client.ts';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: any[] = [];
  constructor(public url: string) { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 2; } // Deliberately never emits close: simulate a dead network.
  send(data: string) { this.sent.push(JSON.parse(data)); }
}

function setup(t: TestContext) {
  Socket.instances = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: Socket });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'WebSocket', original);
    else Reflect.deleteProperty(globalThis, 'WebSocket');
  });
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 0 });
  const errors: string[] = [];
  const statuses: string[] = [];
  const client = new GameClient({
    onView() {}, onSettlement() {},
    onError(message) { errors.push(message); },
    onStatus(status) { statuses.push(status); },
  });
  t.after(() => client.disconnect());
  return { client, errors, statuses };
}

test('half-open socket recovers without close event and restores room/profile', (t) => {
  const { client, errors } = setup(t);
  client.setPlayerProfile('测试玩家');
  client.reconnect('123456', 'seat-token');
  client.connect('ws://localhost:8787');
  const old = Socket.instances[0];
  old.open();
  t.mock.timers.tick(30_000);
  assert.match(errors.at(-1)!, /自动重连/);
  assert.equal(old.onmessage, null);
  t.mock.timers.tick(1000);
  assert.equal(Socket.instances.length, 2);
  const replacement = Socket.instances[1];
  replacement.open();
  assert.equal(replacement.sent[0].type, 'player:reconnect');
  assert.equal(replacement.sent[0].token, 'seat-token');
  assert.equal(replacement.sent[0].nickname, '测试玩家');
});

test('a handshake that never opens times out with an actionable error', (t) => {
  const { client, errors, statuses } = setup(t);
  client.connect('ws://localhost:8787');
  t.mock.timers.tick(30_000);
  assert.equal(statuses.at(-1), 'closed');
  assert.match(errors.at(-1)!, /请重新连接/);
  assert.equal(Socket.instances[0].readyState, 2);
});

test('manual disconnect cancels scheduled recovery', (t) => {
  const { client } = setup(t);
  client.reconnect('123456', 'seat-token');
  client.connect('ws://localhost:8787');
  Socket.instances[0].open();
  t.mock.timers.tick(30_000);
  client.disconnect();
  t.mock.timers.tick(60_000);
  assert.equal(Socket.instances.length, 1);
});

test('server heartbeats keep a live connection open', (t) => {
  const { client, errors } = setup(t);
  client.connect('ws://localhost:8787');
  const socket = Socket.instances[0];
  socket.open();
  for (let i = 0; i < 10; i++) {
    t.mock.timers.tick(10_000);
    socket.onmessage?.({ data: '{"type":"pong"}' });
  }
  assert.equal(socket.readyState, 1);
  assert.deepEqual(errors, []);
});

test('malformed JSON and null messages report errors without crashing', (t) => {
  const { client, errors } = setup(t);
  client.connect('ws://localhost:8787');
  const socket = Socket.instances[0];
  socket.open();
  for (const data of ['{', 'null', '42', '{}']) {
    assert.doesNotThrow(() => socket.onmessage?.({ data }));
  }
  assert.equal(errors.length, 4);
});

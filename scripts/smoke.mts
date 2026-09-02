import WebSocket from 'ws';
import type { C2SMessage, ClientView, S2CMessage } from '@pizhou/shared';
import { startMahjongServer } from '@pizhou/server-core';

const server = await startMahjongServer({ port: 8799, host: '127.0.0.1', log: false });

class Bot {
  ws: WebSocket;
  view: ClientView | null = null;
  name: string;
  token: string | null = null;
  serverUrl: string;

  constructor(name: string, serverUrl = 'ws://127.0.0.1:8799') {
    this.name = name;
    this.serverUrl = serverUrl;
    this.ws = new WebSocket(serverUrl);
    this.setupWs(this.ws);
  }

  setupWs(ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as S2CMessage;
      if (msg.type === 'error') {
        console.error(this.name, 'error', msg.message);
        return;
      }
      if (msg.type === 'room:created' || msg.type === 'room:joined' || msg.type === 'player:reconnected') {
        this.token = msg.token;
      }
      if (msg.type === 'game:state' || msg.type === 'game:settlement' || msg.type === 'game:roundStarted') {
        this.view = msg.view;
        if (msg.view.token) this.token = msg.view.token;
      }
    });
  }

  send(message: C2SMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  waitOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  async waitView(pred: (view: ClientView) => boolean, timeout = 15000): Promise<ClientView> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.view && pred(this.view)) return this.view;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error(`${this.name} waitView timeout`);
  }

  reconnect(roomCode: string) {
    this.ws.close();
    this.ws = new WebSocket(this.serverUrl);
    this.setupWs(this.ws);
    return new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => {
        this.send({ type: 'player:reconnect', roomCode, token: this.token! });
        resolve();
      });
      this.ws.once('error', reject);
    });
  }
}

console.log('--- 启动四人联机全流程测试 ---');
const bots = [0, 1, 2, 3].map((i) => new Bot(`玩家${i + 1}`));
await Promise.all(bots.map((bot) => bot.waitOpen()));

// 1. 创建房间
bots[0]!.send({ type: 'room:create', nickname: '房主' });
const hostView = await bots[0]!.waitView((view) => Boolean(view.roomCode));
const roomCode = hostView.roomCode!;
console.log('✔ 房主创建房间成功，房间号:', roomCode);

// 2. 另外3人加入
for (const bot of bots.slice(1)) {
  bot.send({ type: 'room:join', roomCode, nickname: bot.name });
  await bot.waitView((view) => view.roomCode === roomCode);
}
console.log('✔ 4名玩家全部加入房间');

// 3. 全员准备并开局
for (const bot of bots) bot.send({ type: 'room:ready', ready: true });
await bots[0]!.waitView((view) => view.players.filter((p) => p.ready).length === 4);
bots[0]!.send({ type: 'room:start' });
await Promise.all(bots.map((bot) => bot.waitView((view) => view.phase === 'playing')));
console.log('✔ 对局第1局已开始，牌墙余牌:', bots[0]!.view?.wallCount);

// 4. 断线重连测试 (玩家2短暂断开并重连)
console.log('--- 测试断线重连 ---');
await bots[1]!.reconnect(roomCode);
const reconnectedView = await bots[1]!.waitView((view) => view.roomCode === roomCode && view.phase === 'playing');
if (reconnectedView.mySeat === 1) {
  console.log('✔ 玩家2重连成功，座位与手牌恢复正常');
} else {
  throw new Error('玩家2重连后座位错误');
}

// 5. 模拟打牌直至本局结算
let steps = 0;
while (steps < 1000) {
  steps += 1;
  const settled = bots.some((bot) => bot.view?.phase === 'settlement');
  if (settled) break;
  for (const bot of bots) {
    const view = bot.view;
    if (!view || view.phase !== 'playing') continue;
    const acts = view.availableActions;
    if (acts.length === 0) continue;
    if (acts.some((a) => a.kind === 'hu')) {
      bot.send({ type: 'game:action', sequence: view.sequence, actionId: `s${steps}-${bot.name}-hu`, action: { kind: 'hu' } });
      continue;
    }
    if (acts.some((a) => a.kind === 'discard')) {
      const me = view.players.find((p) => p.seat === view.mySeat) as { hand?: { id: string }[]; lastDrawnId?: string };
      const tileId = me.lastDrawnId ?? me.hand?.[me.hand.length - 1]?.id;
      if (tileId) {
        bot.send({
          type: 'game:action',
          sequence: view.sequence,
          actionId: `s${steps}-${bot.name}-d`,
          action: { kind: 'discard', tileId },
        });
      }
      continue;
    }
    if (acts.some((a) => a.kind === 'pass')) {
      bot.send({ type: 'game:action', sequence: view.sequence, actionId: `s${steps}-${bot.name}-p`, action: { kind: 'pass' } });
    }
  }
  await new Promise((r) => setTimeout(r, 15));
}

if (!bots.some((bot) => bot.view?.phase === 'settlement')) {
  throw new Error(`牌局在 ${steps} 步内未能完成结算`);
}

const round1Settlement = bots[0]!.view?.settlement;
console.log('✔ 第1局对局结束，结算类型:', round1Settlement?.winType, '胡数:', round1Settlement?.hu);

// 6. 再来一局 (所有玩家点击再来一局进入第2局)
console.log('--- 测试再来一局 ---');
for (const bot of bots) {
  bot.send({ type: 'game:nextRound' });
}
await Promise.all(bots.map((bot) => bot.waitView((view) => view.round === 2 && view.phase === 'playing')));
console.log('✔ 顺利开启第2局，庄家座位:', bots[0]!.view?.dealer);

console.log('--- 测试单机统一服务流程 ---');
const solo = new Bot('单机玩家');
await solo.waitOpen();
solo.send({ type: 'room:create', nickname: solo.name, solo: true });
const soloView = await solo.waitView(
  (view) => view.phase === 'playing' && view.players.length === 4 && view.players.filter((player) => player.isBot).length === 3,
);
console.log('✔ 单机通过同一服务核心启动，陪练数:', soloView.players.filter((player) => player.isBot).length);

for (const bot of bots) bot.ws.close();
solo.ws.close();
await server.close();
console.log('✔ 全部全流程测试通过！');
process.exit(0);

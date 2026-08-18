import WebSocket from 'ws';
import type { C2SMessage, ClientView, S2CMessage } from '@pizhou/shared';

class Bot {
  ws: WebSocket;
  view: ClientView | null = null;
  name: string;
  ready = Promise.withResolvers<void>();

  constructor(name: string) {
    this.name = name;
    this.ws = new WebSocket('ws://127.0.0.1:8787');
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as S2CMessage;
      if (msg.type === 'error') {
        console.error(this.name, 'error', msg.message);
        return;
      }
      if (msg.type === 'game:state' || msg.type === 'game:settlement') {
        this.view = msg.view;
        this.ready.resolve();
      }
    });
  }

  send(message: C2SMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  waitOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  async waitView(pred: (view: ClientView) => boolean, timeout = 8000): Promise<ClientView> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.view && pred(this.view)) return this.view;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`${this.name} waitView timeout`);
  }
}

const bots = [0, 1, 2, 3].map((i) => new Bot(`玩家${i + 1}`));
await Promise.all(bots.map((bot) => bot.waitOpen()));
bots[0]!.send({ type: 'room:create', nickname: '房主' });
const hostView = await bots[0]!.waitView((view) => Boolean(view.roomCode));
const roomCode = hostView.roomCode;
console.log('room', roomCode);
for (const bot of bots.slice(1)) {
  bot.send({ type: 'room:join', roomCode, nickname: bot.name });
  await bot.waitView((view) => view.roomCode === roomCode);
}
for (const bot of bots) bot.send({ type: 'room:ready', ready: true });
await bots[0]!.waitView((view) => view.players.filter((p) => p.ready).length === 4);
bots[0]!.send({ type: 'room:start' });
await Promise.all(bots.map((bot) => bot.waitView((view) => view.phase === 'playing')));
console.log('started, wall', bots[0]!.view?.wallCount);

let steps = 0;
while (steps < 400) {
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
  await new Promise((r) => setTimeout(r, 30));
}

const end = bots[0]!.view;
console.log('phase', end?.phase, 'win', end?.settlement?.winType, 'hu', end?.settlement?.hu);
if (end?.phase !== 'settlement') {
  console.error('smoke failed');
  process.exit(1);
}
console.log('smoke ok');
for (const bot of bots) bot.ws.close();
process.exit(0);

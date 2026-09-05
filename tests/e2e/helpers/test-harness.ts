import net from 'node:net';
import WebSocket from 'ws';
import type { C2SMessage, ClientView, S2CMessage } from '@pizhou/shared';
import { startMahjongServer, type StartedServer } from '@pizhou/server-core';

/**
 * Finds a free TCP port dynamically on 127.0.0.1
 */
export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Failed to obtain port')));
        return;
      }
      const port = addr.port;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

/**
 * Creates and starts a test Mahjong server on an ephemeral port
 */
export async function createTestServer(customPort?: number): Promise<{
  server: StartedServer;
  port: number;
  url: string;
  close: () => Promise<void>;
}> {
  const port = customPort ?? (await getAvailablePort());
  const server = await startMahjongServer({ port, host: '127.0.0.1', log: false });
  const url = `ws://127.0.0.1:${port}`;

  return {
    server,
    port,
    url,
    close: async () => {
      await server.close();
    },
  };
}

/**
 * Test WebSocket Bot Client for E2E testing
 */
export class E2EBotClient {
  ws: WebSocket;
  view: ClientView | null = null;
  name: string;
  token: string | null = null;
  serverUrl: string;
  messages: S2CMessage[] = [];
  rawMessages: string[] = [];

  constructor(name: string, serverUrl: string) {
    this.name = name;
    this.serverUrl = serverUrl;
    this.ws = new WebSocket(serverUrl);
    this.setupWs(this.ws);
  }

  private setupWs(ws: WebSocket) {
    ws.on('message', (raw) => {
      const str = String(raw);
      this.rawMessages.push(str);
      try {
        const msg = JSON.parse(str) as S2CMessage;
        this.messages.push(msg);

        if (msg.type === 'room:created' || msg.type === 'room:joined' || msg.type === 'player:reconnected') {
          this.token = msg.token;
        }
        if (msg.type === 'game:state' || msg.type === 'game:settlement' || msg.type === 'game:roundStarted') {
          this.view = msg.view;
          if (msg.view.token) this.token = msg.view.token;
        }
      } catch {
        // Raw non-json messages kept in rawMessages
      }
    });
  }

  send(message: C2SMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  sendRaw(data: string | Buffer): void {
    this.ws.send(data);
  }

  waitOpen(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      const timer = setTimeout(() => reject(new Error(`${this.name} waitOpen timed out`)), timeout);
      this.ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async waitView(pred: (view: ClientView) => boolean, timeout = 10000): Promise<ClientView> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.view && pred(this.view)) return this.view;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${this.name} waitView timed out. view=${JSON.stringify(this.view)}, messages=${JSON.stringify(this.messages)}`);
  }

  async waitMessage(pred: (msg: S2CMessage) => boolean, timeout = 10000, startIndex = 0): Promise<S2CMessage> {
    const start = Date.now();
    let cursor = startIndex;
    while (Date.now() - start < timeout) {
      while (cursor < this.messages.length) {
        const msg = this.messages[cursor]!;
        cursor++;
        if (pred(msg)) return msg;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${this.name} waitMessage timed out`);
  }

  reconnect(roomCode: string, tokenOverride?: string): Promise<void> {
    const tokenToUse = tokenOverride ?? this.token;
    if (!tokenToUse) throw new Error(`${this.name} has no token for reconnect`);

    this.ws.close();
    this.ws = new WebSocket(this.serverUrl);
    this.setupWs(this.ws);

    return new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => {
        this.send({ type: 'player:reconnect', roomCode, token: tokenToUse });
        resolve();
      });
      this.ws.once('error', reject);
    });
  }

  close(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) return resolve();
      const timer = setTimeout(() => {
        try { this.ws.terminate(); } catch {}
        resolve();
      }, 500);
      this.ws.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      try {
        this.ws.terminate();
      } catch {
        resolve();
      }
    });
  }
}

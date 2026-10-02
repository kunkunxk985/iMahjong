import { SERVER_PORT } from '@pizhou/shared';
import { app } from 'electron';
import path from 'node:path';
import { probeMahjongServer, startMahjongServer } from '@pizhou/server-core';

const PORTS = [SERVER_PORT, 8788, 8789, 8790];

export interface LocalServer {
  url: string;
  owned: boolean;
  close: () => Promise<void>;
}

function attach(port: number, owned: boolean, close: () => Promise<void>): LocalServer {
  return {
    url: `ws://127.0.0.1:${port}`,
    owned,
    close,
  };
}

export async function ensureLocalServer(): Promise<LocalServer> {
  // Finder's working directory is /. Persist under the writable application
  // data directory instead of inheriting the CLI server's cwd-based defaults.
  const stateDir = path.join(app.getPath('userData'), 'local-server', 'rooms');
  const accountsDir = path.join(app.getPath('userData'), 'local-server', 'accounts');
  for (const port of PORTS) {
    if (await probeMahjongServer(port)) {
      return attach(port, false, async () => undefined);
    }
    try {
      const started = await startMahjongServer({ port, host: '0.0.0.0', log: true, stateDir, accountsDir });
      return attach(started.port, true, started.close);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : '';
      if (code === 'EADDRINUSE') {
        if (await probeMahjongServer(port)) {
          return attach(port, false, async () => undefined);
        }
        continue;
      }
      throw error;
    }
  }
  // Other applications may occupy every preferred port. Solo play can use an
  // OS-assigned loopback port without asking the player to close them.
  const started = await startMahjongServer({ port: 0, host: '127.0.0.1', log: true, stateDir, accountsDir });
  return attach(started.port, true, started.close);
}

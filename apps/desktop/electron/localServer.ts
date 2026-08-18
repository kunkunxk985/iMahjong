import { SERVER_PORT } from '@pizhou/shared';
import { probeMahjongServer, startMahjongServer } from '@pizhou/server-core';

const PORTS = [SERVER_PORT, 8788, 8789, 8790];

export interface LocalServer {
  url: string;
  owned: boolean;
  close: () => Promise<void>;
}

export async function ensureLocalServer(): Promise<LocalServer> {
  for (const port of PORTS) {
    if (await probeMahjongServer(port)) {
      return {
        url: `ws://127.0.0.1:${port}`,
        owned: false,
        close: async () => undefined,
      };
    }
    try {
      const started = await startMahjongServer({ port, host: '0.0.0.0', log: true });
      return {
        url: `ws://127.0.0.1:${started.port}`,
        owned: true,
        close: started.close,
      };
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : '';
      if (code === 'EADDRINUSE') continue;
      throw error;
    }
  }
  throw new Error('无法启动本机牌局服务');
}

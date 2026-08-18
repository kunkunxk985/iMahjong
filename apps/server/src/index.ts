import { SERVER_PORT } from '@pizhou/shared';
import { startMahjongServer } from './createServer.ts';

const port = Number(process.env.PORT ?? SERVER_PORT);
const started = await startMahjongServer({ port, host: '0.0.0.0', log: true });
console.log('同一 Wi-Fi 下，其他电脑请填写上面的局域网地址。');

const shutdown = async () => {
  await started.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

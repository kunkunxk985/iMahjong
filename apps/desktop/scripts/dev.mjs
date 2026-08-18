import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { bundleElectron } from './bundle-electron.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
});
await server.listen();
const viteUrl = server.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:5173/';
await bundleElectron();
console.log(`renderer ${viteUrl}`);

let child = null;
let stopping = false;

function startElectron() {
  child = spawn(electronPath, [root], {
    cwd: root,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: viteUrl,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    stdio: 'inherit',
    windowsHide: false,
  });
  child.on('exit', (code) => {
    if (stopping) return;
    if (code === 0) {
      void shutdown(0);
      return;
    }
    console.log(`electron exited ${code}, restarting...`);
    setTimeout(() => {
      if (!stopping) startElectron();
    }, 500);
  });
}

const shutdown = async (code = 0) => {
  stopping = true;
  if (child && !child.killed) child.kill();
  await server.close();
  process.exit(code);
};

startElectron();
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

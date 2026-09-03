import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { createServer } from 'vite';
import { startMahjongServer } from '@pizhou/server-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const desktopRoot = path.join(projectRoot, 'apps/desktop');

console.log('1. Starting Mahjong Server on port 8799...');
const mahjongServer = await startMahjongServer({ port: 8799, host: '127.0.0.1', log: false });

console.log('2. Starting Vite Dev Server on port 5173...');
const vite = await createServer({
  root: desktopRoot,
  configFile: path.join(desktopRoot, 'vite.config.ts'),
  define: {
    'import.meta.env.VITE_WS_URL': JSON.stringify('ws://127.0.0.1:8799'),
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
await vite.listen();
console.log('Vite server running on http://127.0.0.1:5173');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9225;

console.log('3. Launching Google Chrome headless...');
const chrome = spawn(
  CHROME_PATH,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome-hd-test',
    '--window-size=1920,1080',
    '--hide-scrollbars',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:5173/',
  ],
  { stdio: 'pipe' }
);

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wait for Chrome debugging port to be ready
let wsUrl = '';
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
    const data = (await res.json()) as { webSocketDebuggerUrl?: string; type?: string }[];
    const page = data.find((d) => d.type === 'page') || data[0];
    if (page?.webSocketDebuggerUrl) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {}
  await wait(200);
}

if (!wsUrl) {
  throw new Error('Failed to connect to headless Chrome remote debugging port');
}

console.log('4. Connected to Chrome CDP:', wsUrl);
const ws = new WebSocket(wsUrl);
await new Promise<void>((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});

let msgId = 1;
function sendCommand(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    const handler = (raw: WebSocket.RawData) => {
      const resp = JSON.parse(String(raw));
      if (resp.id === id) {
        ws.off('message', handler);
        if (resp.error) reject(resp.error);
        else resolve(resp.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await sendCommand('Page.enable');
await sendCommand('Runtime.enable');
await sendCommand('Emulation.setDeviceMetricsOverride', {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: false,
});

console.log('5. Navigating to http://127.0.0.1:5173/...');
await sendCommand('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await wait(800);

// Set stored auth and reload so we land directly in the Lobby
console.log('Setting stored auth credentials...');
await sendCommand('Runtime.evaluate', {
  expression: `(() => {
    localStorage.setItem('pizhou.auth_token_v1', 'guest-mock-token');
    localStorage.setItem('pizhou.auth_user_v1', JSON.stringify({
      userId: 'user-guest-linfeng',
      username: 'linfeng',
      nickname: '林枫',
      avatar: '中',
      title: '雀士',
      createdAt: Date.now(),
    }));
    localStorage.setItem('pizhou.nickname', '林枫');
    localStorage.setItem('pizhou.serverUrl', 'ws://127.0.0.1:8799');
    location.reload();
  })()`,
});
await wait(1500);

// Click .solo-card to enter practice mode
console.log('6. Clicking solo card to enter practice mode...');
let entered = false;
for (let i = 0; i < 40; i++) {
  const res = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.solo-card');
      if (card && !card.classList.contains('disabled')) {
        card.click();
        return true;
      }
      return false;
    })()`,
  });
  if (res.result?.value) {
    entered = true;
    console.log('✔ Clicked solo practice button');
    break;
  }
  await wait(300);
}

// Wait for mahjong-board to appear
console.log('7. Waiting for mahjong table to load...');
let boardReady = false;
for (let i = 0; i < 50; i++) {
  const res = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const board = document.querySelector('.mahjong-board');
      const handTiles = document.querySelectorAll('.board-own-hand .tile');
      return Boolean(board && handTiles.length >= 13);
    })()`,
  });
  if (res.result?.value) {
    boardReady = true;
    console.log('✔ Mahjong table and hand tiles ready');
    break;
  }
  await wait(300);
}

// Wait a bit for initial deal animations and AI turns to settle
await wait(3000);

// Ensure action bar displays Hu, Peng and Discard for comprehensive visual inspection
await sendCommand('Runtime.evaluate', {
  expression: `(() => {
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) {
      if (!actionBar.querySelector('.action-hu')) {
        const huBtn = document.createElement('button');
        huBtn.className = 'btn-action action-hu primary';
        huBtn.innerText = '胡';
        actionBar.prepend(huBtn);
      }
      if (!actionBar.querySelector('.action-peng')) {
        const pengBtn = document.createElement('button');
        pengBtn.className = 'btn-action action-peng';
        pengBtn.innerText = '碰';
        const discardBtn = actionBar.querySelector('.action-discard');
        if (discardBtn) actionBar.insertBefore(pengBtn, discardBtn);
        else actionBar.appendChild(pengBtn);
      }
      const discard = actionBar.querySelector('.action-discard');
      if (discard) discard.classList.add('is-ready');
    }
  })()`,
});
await wait(500);

// Capture screenshot
console.log('8. Capturing 1920x1080 screenshot...');
const screenshotResult = await sendCommand('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
});

const outputPath = '/tmp/current_table_render.png';
fs.writeFileSync(outputPath, Buffer.from(screenshotResult.data, 'base64'));
console.log(`✔ Screenshot saved successfully to ${outputPath}`);

// Cleanup
ws.close();
chrome.kill();
await vite.close();
await mahjongServer.close();
console.log('✔ All resources closed cleanly');
process.exit(0);

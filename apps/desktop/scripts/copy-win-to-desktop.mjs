import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(__dirname, '../release');
const desktopDir = path.join(os.homedir(), 'Desktop');
const winZip = fs.readdirSync(releaseDir).find((item) => /^iMahjong-.*-win-x64\.zip$/.test(item));

if (!winZip) {
  throw new Error('未找到最新 Windows 压缩包，请先运行 electron-builder --win zip --x64');
}

const destination = path.join(desktopDir, 'iMahjong-Windows版.zip');
fs.copyFileSync(path.join(releaseDir, winZip), destination);
console.log(`✓ 已成功将最新 Windows 独立压缩包生成到桌面: ${destination}`);

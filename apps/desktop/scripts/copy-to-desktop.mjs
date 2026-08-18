import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(__dirname, '../release');
const desktopDir = path.join(os.homedir(), 'Desktop');

if (fs.existsSync(releaseDir) && fs.existsSync(desktopDir)) {
  // 1. Copy only the current architecture's app. The release folder can also
  // contain stale universal-build temp folders from previous packaging runs.
  const currentDir = path.join(releaseDir, `mac-${process.arch}`);
  if (fs.existsSync(currentDir)) {
    const appFile = fs.readdirSync(currentDir).find((item) => item.endsWith('.app'));
    if (appFile) {
      const srcApp = path.join(currentDir, appFile);
      const destApp = path.join(desktopDir, appFile);
      execSync(`rm -rf "${destApp}" && cp -R "${srcApp}" "${destApp}"`);
      console.log(`✓ 已成功将最新 .app 应用覆盖生成到桌面: ${destApp}`);
    }
  }

  // 2. Clean up any obsolete .dmg on desktop if present
  const desktopFiles = fs.readdirSync(desktopDir);
  for (const file of desktopFiles) {
    if (file.startsWith('邳州麻将') && file.endsWith('.dmg')) {
      try {
        fs.unlinkSync(path.join(desktopDir, file));
        console.log(`✓ 已清理旧的 DMG 文件: ${file}`);
      } catch {}
    }
  }
}

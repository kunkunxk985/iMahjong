import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(__dirname, '../release');
const desktopDir = path.join(os.homedir(), 'Desktop');

if (fs.existsSync(releaseDir) && fs.existsSync(desktopDir)) {
  // 1. Copy Mac .app to Desktop (no zip — only the .app bundle is needed)
  const macDir = path.join(releaseDir, `mac-${process.arch}`);
  if (fs.existsSync(macDir)) {
    const appFile = fs.readdirSync(macDir).find((item) => item.endsWith('.app'));
    if (appFile) {
      const srcApp = path.join(macDir, appFile);
      const destApp = path.join(desktopDir, appFile);
      execSync(`rm -rf "${destApp}" && cp -R "${srcApp}" "${destApp}"`);
      console.log(`✓ 已成功将最新 .app 应用覆盖生成到桌面: ${destApp}`);
    }
  }

  // Clean up any obsolete .dmg or leftover .zip on desktop from older builds
  const desktopFiles = fs.readdirSync(desktopDir);
  for (const file of desktopFiles) {
    if (file.startsWith('iMahjong') && (file.endsWith('.dmg') || file.endsWith('.zip'))) {
      try {
        fs.unlinkSync(path.join(desktopDir, file));
        console.log(`✓ 已清理旧的安装包: ${file}`);
      } catch {}
    }
  }
}

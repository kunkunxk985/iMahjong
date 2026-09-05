import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(__dirname, '../release');
const desktopDir = path.join(os.homedir(), 'Desktop');

if (fs.existsSync(releaseDir) && fs.existsSync(desktopDir)) {
  // 1. Copy Mac .app and create Mac .zip
  const macDir = path.join(releaseDir, `mac-${process.arch}`);
  if (fs.existsSync(macDir)) {
    const appFile = fs.readdirSync(macDir).find((item) => item.endsWith('.app'));
    if (appFile) {
      const srcApp = path.join(macDir, appFile);
      const destApp = path.join(desktopDir, appFile);
      execSync(`rm -rf "${destApp}" && cp -R "${srcApp}" "${destApp}"`);
      console.log(`✓ 已成功将最新 .app 应用覆盖生成到桌面: ${destApp}`);

      const destMacZip = path.join(desktopDir, 'iMahjong-Mac版.zip');
      execSync(`rm -f "${destMacZip}" && cd "${macDir}" && zip -r -q -y "${destMacZip}" "${appFile}"`);
      console.log(`✓ 已成功将 Mac 独立压缩包生成到桌面: ${destMacZip}`);
    }
  }

  // 2. Copy Windows package if present
  const winZip = fs.readdirSync(releaseDir).find((item) => item.includes('win') && item.endsWith('.zip'));
  if (winZip) {
    const srcWinZip = path.join(releaseDir, winZip);
    const destWinZip = path.join(desktopDir, 'iMahjong-Windows版.zip');
    fs.copyFileSync(srcWinZip, destWinZip);
    console.log(`✓ 已成功将 Windows 独立免安装版压缩包生成到桌面: ${destWinZip}`);
  }

  // 3. Clean up any obsolete .dmg on desktop if present
  const desktopFiles = fs.readdirSync(desktopDir);
  for (const file of desktopFiles) {
    if (file.startsWith('iMahjong') && file.endsWith('.dmg')) {
      try {
        fs.unlinkSync(path.join(desktopDir, file));
        console.log(`✓ 已清理旧的 DMG 文件: ${file}`);
      } catch {}
    }
  }
}

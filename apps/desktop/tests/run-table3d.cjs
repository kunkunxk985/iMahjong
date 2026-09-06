const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const deadline = setTimeout(() => { console.error('3D regression timed out'); app.exit(1); }, 45000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 720, useContentSize: true, show: false,
    webPreferences: { backgroundThrottling: false } });
  try {
    await win.loadURL(process.argv[2]);
    const result = await win.webContents.executeJavaScript('window.runTable3DChecks()');
    console.log(JSON.stringify(result));
    if (process.env.TABLE3D_SCREENSHOT_DIR) {
      const output = process.env.TABLE3D_SCREENSHOT_DIR;
      fs.mkdirSync(output, { recursive: true });
      for (const [width, height] of [[1280, 720], [1024, 768]]) {
        win.setContentSize(width, height);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const shot = await win.webContents.capturePage();
        fs.writeFileSync(path.join(output, `table3d-${width}x${height}.png`), shot.toPNG());
      }
      await win.webContents.executeJavaScript('window.showClassic()');
      const shot = await win.webContents.capturePage();
      fs.writeFileSync(path.join(output, 'table2d-1024x768.png'), shot.toPNG());
    }
    clearTimeout(deadline);
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(deadline);
    app.exit(1);
  }
});

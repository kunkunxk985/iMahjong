const { app, BrowserWindow } = require('electron');
const deadline = setTimeout(() => { console.error('Table interaction regression timed out'); app.exit(1); }, 45000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 720, show: false, webPreferences: { backgroundThrottling: false } });
  try {
    await win.loadURL(process.argv[2]);
    console.log(JSON.stringify(await win.webContents.executeJavaScript('window.runTableInteractionChecks()')));
    clearTimeout(deadline);
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(deadline);
    app.exit(1);
  }
});

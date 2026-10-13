const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.setPath('userData', process.env.SETTLEMENT_TEST_USER_DATA);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadFile(process.env.SETTLEMENT_TEST_HTML);
    const result = await win.webContents.executeJavaScript('window.runSettlementBrowser()');
    fs.writeFileSync(process.env.SETTLEMENT_TEST_RESULT, JSON.stringify(result));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});

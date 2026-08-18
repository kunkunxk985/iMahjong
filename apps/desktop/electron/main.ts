import { app, BrowserWindow, ipcMain } from 'electron';
import { ensureLocalServer, type LocalServer } from './localServer';
import { createWindow } from './window';

app.setName('邳州麻将');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.pizhou.mahjong.demo');
}

app.commandLine.appendSwitch('high-dpi-support', '1');

let localServer: LocalServer | null = null;

app.whenReady().then(async () => {
  try {
    localServer = await ensureLocalServer();
  } catch (error) {
    // The renderer can still connect to a manually configured remote server.
    console.error('本机牌局服务启动失败，仍可使用远程服务器：', error);
  }

  ipcMain.handle('local-server:url', () => localServer?.url ?? null);
  ipcMain.handle('window:new', () => {
    createWindow();
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (localServer?.owned) void localServer.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

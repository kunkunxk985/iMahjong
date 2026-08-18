import { app, BrowserWindow, ipcMain } from 'electron';
import { createWindow } from './window';

app.setName('邳州麻将');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.pizhou.mahjong.demo');
}

app.commandLine.appendSwitch('high-dpi-support', '1');

app.whenReady().then(() => {
  ipcMain.handle('window:new', () => {
    createWindow();
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

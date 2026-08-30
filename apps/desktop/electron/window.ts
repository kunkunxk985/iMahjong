import { BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const WINDOW_DEFAULT_WIDTH = 1280;
const WINDOW_DEFAULT_HEIGHT = 720;
const WINDOW_MIN_WIDTH = 1024;
const WINDOW_MIN_HEIGHT = 576;

function iconPath(): string | undefined {
  const icns = path.join(__dirname, '../build/icon.icns');
  const ico = path.join(__dirname, '../build/icon.ico');
  const png = path.join(__dirname, '../build/icon.png');
  if (process.platform === 'darwin' && fs.existsSync(icns)) return icns;
  if (fs.existsSync(ico)) return ico;
  if (fs.existsSync(png)) return png;
  return undefined;
}

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_DEFAULT_WIDTH,
    height: WINDOW_DEFAULT_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    backgroundColor: '#0b3d32',
    title: '邳州麻将',
    icon: iconPath(),
    autoHideMenuBar: true,
    useContentSize: true,
    // Show immediately so a slow local server or renderer readiness event
    // cannot leave the user staring at an apparently hung launch.
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      zoomFactor: 1,
    },
  });

  // Lock strict 16:9 aspect ratio on macOS and supported platforms
  win.setAspectRatio(16 / 9);

  win.once('ready-to-show', () => {
    win.webContents.setZoomFactor(1);
    win.setAspectRatio(16 / 9);
    win.show();
  });
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  return win;
}

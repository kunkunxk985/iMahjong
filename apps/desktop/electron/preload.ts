import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pizhou', {
  newWindow: () => ipcRenderer.invoke('window:new'),
});

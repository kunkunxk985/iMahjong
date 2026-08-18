import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pizhou', {
  newWindow: () => ipcRenderer.invoke('window:new'),
  getLocalServerUrl: () => ipcRenderer.invoke('local-server:url') as Promise<string | null>,
});

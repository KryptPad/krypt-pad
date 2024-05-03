import { contextBridge, ipcRenderer } from 'electron';

// Expose some render function to our app
const api = {
  invoke(channel: string, ...args: any[]): Promise<any> {
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel: string, ...args: any[]) {
    ipcRenderer.send(channel, ...args);
  },
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): Electron.IpcRenderer {
    return ipcRenderer.on(channel, listener);
  }
};

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', api);

console.info("Successfully loaded the IPC renderer.")
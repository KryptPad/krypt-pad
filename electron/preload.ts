import { contextBridge, ipcRenderer } from 'electron'

type AppEventChannel = 'handle-shortcut' | 'unmaximize' | 'maximize' | 'blur' | 'focus'

const validEventChannels = new Set<AppEventChannel>(['handle-shortcut', 'unmaximize', 'maximize', 'blur', 'focus'])

// Expose a narrow renderer API.
const api = {
    openProfile(fileName: string, passphrase: string): Promise<any> {
        return ipcRenderer.invoke('open-profile', fileName, passphrase)
    },
    saveProfile(fileName: string, profileData: string): Promise<any> {
        return ipcRenderer.invoke('save-profile', fileName, profileData)
    },
    setSessionPassphrase(passphrase: string): Promise<any> {
        return ipcRenderer.invoke('set-session-passphrase', passphrase)
    },
    lockProfile(): Promise<any> {
        return ipcRenderer.invoke('lock-profile')
    },
    saveConfig(data: string): Promise<any> {
        return ipcRenderer.invoke('save-config', data)
    },
    loadConfig(): Promise<any> {
        return ipcRenderer.invoke('load-config')
    },
    showOpenFileDialog(): Promise<any> {
        return ipcRenderer.invoke('show-open-file-dialog')
    },
    showSaveFileDialog(): Promise<any> {
        return ipcRenderer.invoke('show-save-file-dialog')
    },
    getIsMaximized(): Promise<any> {
        return ipcRenderer.invoke('is-maximized')
    },
    toggleMaximizeRestore() {
        ipcRenderer.send('toggle-maximize-restore')
    },
    minimize() {
        ipcRenderer.send('minimize')
    },
    close() {
        ipcRenderer.send('close')
    },
    getPlatform(): Promise<any> {
        return ipcRenderer.invoke('get-platform')
    },
    onAppEvent(channel: AppEventChannel, listener: (...args: any[]) => void) {
        if (!validEventChannels.has(channel)) {
            throw new Error(`Unsupported app event channel: ${channel}`)
        }

        const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: any[]) => listener(...args)
        ipcRenderer.on(channel, wrappedListener)
    }
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('kryptPad', api)

console.info('Successfully loaded the IPC renderer.')

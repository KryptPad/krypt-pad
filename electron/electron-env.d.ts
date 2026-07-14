/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
    interface ProcessEnv {
        /**
         * The built directory structure
         *
         * ```tree
         * ├─┬─┬ dist
         * │ │ └── index.html
         * │ │
         * │ ├─┬ dist-electron
         * │ │ ├── main.js
         * │ │ └── preload.js
         * │
         * ```
         */
        DIST: string
        /** /dist/ or /public/ */
        VITE_PUBLIC: string
    }
}

type KryptPadEventChannel = 'handle-shortcut' | 'unmaximize' | 'maximize' | 'blur' | 'focus'

interface KryptPadDesktopApi {
    openProfile(fileName: string, passphrase: string): Promise<any>
    saveProfile(fileName: string, profileData: string): Promise<any>
    setSessionPassphrase(passphrase: string): Promise<any>
    lockProfile(): Promise<any>
    saveConfig(data: string): Promise<any>
    loadConfig(): Promise<any>
    showOpenFileDialog(): Promise<any>
    showSaveFileDialog(): Promise<any>
    getIsMaximized(): Promise<any>
    toggleMaximizeRestore(): void
    minimize(): void
    close(): void
    getPlatform(): Promise<any>
    onAppEvent(channel: KryptPadEventChannel, listener: (...args: any[]) => void): void
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
    kryptPad: KryptPadDesktopApi
}

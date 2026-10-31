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

type KryptPadEventChannel = 'handle-shortcut' | 'unmaximize' | 'maximize' | 'blur' | 'focus' | 'flush-before-close' | 'vault-changed-externally'

interface KryptPadDesktopApi {
    openProfile(fileName: string, passphrase: string): Promise<any>
    saveProfile(fileName: string, profileData: string, options?: { force?: boolean; hasAttachments?: boolean }): Promise<any>
    saveConflictCopy(fileName: string, profileData: string, attachmentIds: string[]): Promise<any>
    reloadProfile(fileName: string): Promise<any>
    addAttachments(vaultFileName: string): Promise<any>
    saveAttachmentAs(vaultFileName: string, attachment: { id: string; name: string; key: string }): Promise<any>
    copyAttachments(fromVaultFileName: string, toVaultFileName: string, attachmentIds: string[]): Promise<any>
    compactAttachments(vaultFileName: string, referencedIds: string[]): Promise<any>
    setSessionPassphrase(passphrase: string): Promise<any>
    lockProfile(): Promise<any>
    flushComplete(): Promise<any>
    appReady(): void
    saveConfig(data: string): Promise<any>
    loadConfig(): Promise<any>
    showOpenFileDialog(defaultPath?: string): Promise<any>
    showSaveFileDialog(defaultPath?: string): Promise<any>
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

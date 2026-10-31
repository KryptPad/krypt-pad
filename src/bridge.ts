import { KryptPadError } from '../common/error-utils'
import { IPCData } from '../electron/ipc'
import { SettingsManager } from './app-settings'
import { IAddAttachmentsResult, ISaveProfileOptions } from './interfaces'

/**
 * New experimental bridge using ipcRenderer directly
 */
class IPCBridge {
    desktopApi = window.kryptPad

    constructor() {}

    /**
     * Reads the profile data from the file
     * @param fileName Name of the file to open and decrypt
     * @param passphrase The decryption passphrase
     * @returns A string containing the decrypted data
     */
    async openProfile(fileName: string, passphrase: string): Promise<string | undefined> {
        const response = <IPCData<string>>await this.desktopApi.openProfile(fileName, passphrase)
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error)
        }

        return response.data
    }

    /**
     * Encrypts and saves the profile to a file. Unless force is set, the save
     * is refused with VAULT_CHANGED or VAULT_MISSING when the file on disk is
     * no longer the version this session last read or wrote.
     * @param {string} fileName
     * @param {*} plainText
     * @param options force overwrites changes made elsewhere; hasAttachments marks the file so older app versions refuse it
     * @returns
     */
    async saveProfile(fileName: string, profileData: string, options?: ISaveProfileOptions): Promise<void> {
        const response = <IPCData<string>>await this.desktopApi.saveProfile(fileName, profileData, options)
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error)
        }
    }

    /**
     * Writes the profile to a new conflicted copy next to the vault.
     * @returns The path of the copy
     */
    async saveConflictCopy(fileName: string, profileData: string, attachmentIds: string[]): Promise<string> {
        const response = <IPCData<string>>await this.desktopApi.saveConflictCopy(fileName, profileData, attachmentIds)
        if (response.error || !response.data) {
            throw KryptPadError.fromError(response.error)
        }

        return response.data
    }

    /**
     * Re-reads the profile with the session key, without asking for the
     * passphrase. Throws DECRYPT_ERROR when the file was re-keyed elsewhere.
     * @param fileName The vault to read
     * @returns A string containing the decrypted data
     */
    async reloadProfile(fileName: string): Promise<string | undefined> {
        const response = <IPCData<string>>await this.desktopApi.reloadProfile(fileName)
        if (response.error) {
            throw KryptPadError.fromError(response.error)
        }

        return response.data
    }

    /**
     * Lets the user pick files and encrypts them into the vault's attachment folder.
     * @param vaultFileName The vault the files are added to
     * @returns The new attachments and any per-file errors, or undefined if canceled
     */
    async addAttachments(vaultFileName: string): Promise<IAddAttachmentsResult | undefined> {
        const response = <IPCData<IAddAttachmentsResult>>await this.desktopApi.addAttachments(vaultFileName)
        if (response.error) {
            throw KryptPadError.fromError(response.error)
        }

        return response.data
    }

    /**
     * Decrypts an attachment to a location the user picks.
     * @returns Whether the file was saved (false if the user canceled)
     */
    async saveAttachmentAs(vaultFileName: string, attachment: { id: string; name: string; key: string }): Promise<boolean> {
        const response = <IPCData<boolean>>await this.desktopApi.saveAttachmentAs(vaultFileName, attachment)
        if (response.error) {
            throw KryptPadError.fromError(response.error)
        }

        return response.data === true
    }

    /**
     * Copies encrypted attachments from one vault's folder to another's.
     * @returns The ids whose files were not found on this device
     */
    async copyAttachments(fromVaultFileName: string, toVaultFileName: string, attachmentIds: string[]): Promise<string[]> {
        const response = <IPCData<string[]>>await this.desktopApi.copyAttachments(fromVaultFileName, toVaultFileName, attachmentIds)
        if (response.error) {
            throw KryptPadError.fromError(response.error)
        }

        return response.data ?? []
    }

    /**
     * Removes old attachment files the profile no longer references.
     * @returns The number of files removed
     */
    async compactAttachments(vaultFileName: string, referencedIds: string[]): Promise<number> {
        const response = <IPCData<number>>await this.desktopApi.compactAttachments(vaultFileName, referencedIds)
        if (response.error) {
            throw KryptPadError.fromError(response.error)
        }

        return response.data ?? 0
    }

    async setSessionPassphrase(passphrase: string): Promise<void> {
        const response = <IPCData<string>>await this.desktopApi.setSessionPassphrase(passphrase)
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error)
        }
    }

    async lockProfile(): Promise<void> {
        await this.desktopApi.lockProfile()
    }

    /**
     * Tells the main process that pending edits have been written and the
     * window it held open for the flush may now close.
     */
    async flushComplete(): Promise<void> {
        await this.desktopApi.flushComplete()
    }

    /**
     * Tells the main process that the app has mounted, so it can close the
     * splash screen and show the main window.
     */
    appReady() {
        this.desktopApi.appReady()
    }

    onAppEvent(channel: KryptPadEventChannel, listener: (...args: any[]) => void) {
        this.desktopApi.onAppEvent(channel, listener)
    }

    /**
     * Saves the user's application settings
     * @param config An AppSettings object to save
     */
    async saveConfigFile(config: SettingsManager) {
        const response = <IPCData<string>>await this.desktopApi.saveConfig(config.toString())
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error)
        }
    }

    /**
     * Loads the user's application settings
     * @returns the user's application settings
     */
    async loadConfigFile(): Promise<SettingsManager | undefined> {
        const response = <IPCData<string>>await this.desktopApi.loadConfig()
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error)
        } else if (response.data) {
            // Serialize the AppSettings and return it
            const appSettings = new SettingsManager(JSON.parse(response.data))
            return appSettings
        }

        return undefined
    }

    /**
     * Shows the open file dialog.
     * @param defaultPath The default path to show in the dialog
     * @returns Promise
     */
    async showOpenFileDialogAsync(defaultPath?: string): Promise<Electron.OpenDialogReturnValue> {
        // Send message to main process to open the dialog.
        return <Electron.OpenDialogReturnValue>await this.desktopApi.showOpenFileDialog(defaultPath)
    }

    /**
     * Shows the save file dialog.
     * @param defaultPath The default path to show in the dialog
     * @returns Promise
     */
    async showSaveFileDialogAsync(defaultPath?: string): Promise<Electron.SaveDialogReturnValue> {
        // Send message to main process to open the dialog.
        return <Electron.SaveDialogReturnValue>await this.desktopApi.showSaveFileDialog(defaultPath)
    }

    /**
     * Gets whether the window is maximized
     * @returns Promise<any>
     */
    async getIsMaximized() {
        return await this.desktopApi.getIsMaximized()
    }

    /**
     * Toggles the window maximize and restore
     */
    toggleMaximizeRestore() {
        this.desktopApi.toggleMaximizeRestore()
    }

    /**
     * Minimizes the window
     */
    minimize() {
        this.desktopApi.minimize()
    }

    /**
     * Closes the app
     */
    close() {
        this.desktopApi.close()
    }

    // invoke get-platform
    async getPlatform(): Promise<string> {
        return await this.desktopApi.getPlatform()
    }
}

export { IPCBridge }

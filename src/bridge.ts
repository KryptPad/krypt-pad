import { KryptPadError } from '../common/error-utils'
import { IPCData } from '../electron/ipc'
import { SettingsManager } from './app-settings'

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
     * Encrypts and saves the profile to a file
     * @param {string} fileName
     * @param {*} plainText
     * @returns
     */
    async saveProfile(fileName: string, profileData: string): Promise<void> {
        const response = <IPCData<string>>await this.desktopApi.saveProfile(fileName, profileData)
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error)
        }
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
     * @returns Promise
     */
    async showOpenFileDialogAsync(): Promise<Electron.OpenDialogReturnValue> {
        // Send message to main process to open the dialog.
        return <Electron.OpenDialogReturnValue>await this.desktopApi.showOpenFileDialog()
    }

    /**
     * Shows the save file dialog
     * @returns Promise
     */
    async showSaveFileDialogAsync(): Promise<Electron.SaveDialogReturnValue> {
        // Send message to main process to open the dialog.
        return <Electron.SaveDialogReturnValue>await this.desktopApi.showSaveFileDialog()
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

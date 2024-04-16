import { KryptPadError } from "../common/error-utils";
import { IPCData } from "../electron/ipc";
import { AppSettings } from "./app-settings";

/**
 * New experimental bridge using ipcRenderer directly
 */
class IPCBridge {

    ipcRenderer = window.ipcRenderer;

    constructor() {

    }

    /**
     * 
     * @param fileName Name of the file to open and decrypt
     * @param passphrase The decryption passphrase
     * @returns A string containing the decrypted data
     */
    async readFile(fileName: string, passphrase: string): Promise<string | undefined> {
        const response = <IPCData<string>>await this.ipcRenderer.invoke('read-file', fileName, passphrase);
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error);

        }

        return response.data;

    }

    /**
     * Encrypts and saves the profile to a file
     * @param {string} fileName 
     * @param {*} plainText 
     * @returns 
     */
    async writeFile(fileName: string, plainText: any, passphrase: string): Promise<void> {
        const response = <IPCData<string>>await this.ipcRenderer.invoke('write-file', fileName, plainText, passphrase);
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error);

        }
    }

    /**
     * Saves the user's application settings
     * @param config An AppSettings object to save
     */
    async saveConfigFile(config: AppSettings) {
        const response = <IPCData<string>>await this.ipcRenderer.invoke('save-config', JSON.stringify(config));
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error);

        }

        console.info("Configuration file written successfully.");

    }

    /**
     * Loads the user's application settings
     * @returns the user's application settings
     */
    async loadConfigFile(): Promise<AppSettings | undefined> {
        const response = <IPCData<string>>await this.ipcRenderer.invoke('load-config');
        if (response.error) {
            // Throw the error
            throw KryptPadError.fromError(response.error);

        } else if (response.data) {
            // Serialize the AppSettings and return it
            const appSettings = Object.assign(new AppSettings(), JSON.parse(response.data));
            return appSettings;

        }

        return undefined;
    }

    /**
     * Shows the open file dialog.
     * @returns Promise
     */
    async showOpenFileDialogAsync(): Promise<Electron.OpenDialogReturnValue> {
        // Send message to main process to open the dialog.
        return <Electron.OpenDialogReturnValue>await this.ipcRenderer.invoke('show-open-file-dialog');

    }

    /**
     * Shows the save file dialog
     * @returns Promise
     */
    async showSaveFileDialogAsync(): Promise<Electron.SaveDialogReturnValue> {
        // Send message to main process to open the dialog.
        return <Electron.SaveDialogReturnValue>await this.ipcRenderer.invoke('show-save-file-dialog');

    }

    /**
     * Gets whether the window is maximized
     * @returns Promise<any>
     */
    async getIsMaximized() {
        return await this.ipcRenderer.invoke("is-maximized");
    }

    /**
     * Toggles the window maximize and restore
     */
    toggleMaximizeRestore() {
        this.ipcRenderer.send('toggle-maximize-restore');
    }

    /**
     * Minimizes the window
     */
    minimize() {
        this.ipcRenderer.send('minimize');
    }

    /**
     * Closes the app
     */
    close() {
        this.ipcRenderer.send('close');
    }
}

export { IPCBridge };
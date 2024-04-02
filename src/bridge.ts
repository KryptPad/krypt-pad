import { KryptPadError } from "../common/error-utils";
import { IPCData } from "../electron/ipc";
import { AppSettings } from "./app-settings";

// interface IBridge {
// }

// declare global {
//     interface Window { bridge: IBridge; }
// }

// /**
//  * This script gets the context bridge between main process and render process via IPC.
//  */
// const bridge = window.bridge;


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
        this.ipcRenderer.send('show-open-file-dialog');
        // Create a promise that waits for the message coming back that the user has selected a file
        return new Promise((resolve) => {
            this.ipcRenderer.once('file-selected', (_, response: Electron.OpenDialogReturnValue) => {
                resolve(response);
            });
        });

    }

    /**
     * Shows the save file dialog
     * @returns Promise
     */
    async showSaveFileDialogAsync(): Promise<Electron.SaveDialogReturnValue> {
        // Send message to main process to open the dialog.
        this.ipcRenderer.send('show-save-file-dialog');
        // Create a promise that waits for the message coming back that the user has selected a file
        return new Promise((resolve) => {
            this.ipcRenderer.once('file-selected', (_, response: Electron.SaveDialogReturnValue) => {
                resolve(response);
            });
        });

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
    toggleMaximizeRestore() { this.ipcRenderer.send('toggle-maximize-restore'); }

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
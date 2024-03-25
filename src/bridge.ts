import { IPCDataContract } from "../electron/ipc";
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

    constructor(){
        
    }
    

    /**
     * 
     * @param fileName Name of the file to open and decrypt
     * @param passphrase The decryption passphrase
     * @returns An IPCDataContract object containing the decrypted data or an error
     */
    readFileAsync(fileName: string, passphrase: string): Promise<IPCDataContract<string>> {
        this.ipcRenderer.send('read-file', fileName, passphrase);
        // Create a promise that waits for the message coming back that the file has been read
        return new Promise((resolve, reject) => {
            try {
                // Listen for the data to be sent from the main process
                this.ipcRenderer.once('file-read', (_, response: IPCDataContract<string>) => {
                    const ipcData = IPCDataContract.load(response);
                    resolve(ipcData);

                });

            } catch {
                reject();

            }

        });
    }

    /**
     * Encrypts and saves the profile to a file
     * @param {string} fileName 
     * @param {*} plainText 
     * @returns 
     */
    saveFileAsync(fileName: string, plainText: any, passphrase: string): Promise<IPCDataContract<string>> {
        this.ipcRenderer.send('write-file', fileName, plainText, passphrase);
        // Create a promise that waits for the message coming back that the file has been written
        return new Promise((resolve) => {
            // Listen for the data to be sent from the main process
            this.ipcRenderer.once('file-written', (_, response: IPCDataContract<string>) => {
                const ipcData = IPCDataContract.load(response);
                resolve(ipcData);

            });

        });
    }


async saveConfigFile(config: any){
    const response = await this.ipcRenderer.invoke('save-config', JSON.stringify(config));
    const ipcData = IPCDataContract.load(response);
    return ipcData;
}

async loadConfigFile() :Promise<IPCDataContract<AppSettings>> {
    const response = await this.ipcRenderer.invoke('load-config');
    if (response?.data)
    {
        const appSettings = JSON.parse(response.data)
        return IPCDataContract.load<AppSettings>(appSettings);
    }
    return response;
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
import { IPCDataContract } from "../electron/ipc";

interface IBridge {
    readFileAsync(fileName: string, passphrase: string): Promise<IPCDataContract<string>>,
    saveFileAsync(fileName: string, plainText: string, passphrase: string): Promise<IPCDataContract<string>>,
    showSaveFileDialogAsync(): Promise<Electron.SaveDialogReturnValue>,
    showOpenFileDialogAsync(): Promise<Electron.OpenDialogReturnValue>
}

declare global {
    interface Window { bridge: IBridge; }
}

/**
 * This script gets the context bridge between main process and render process via IPC.
 */
const bridge = window.bridge;


/**
 * New experimental bridge using ipcRenderer directly
 */
class IPCBridge {

    private _ipcRenderer = window.ipcRenderer;

    /**
     * 
     * @param fileName Name of the file to open and decrypt
     * @param passphrase The decryption passphrase
     * @returns An IPCDataContract object containing the decrypted data or an error
     */
    readFileAsync(fileName: string, passphrase: string): Promise<IPCDataContract<string>> {
        this._ipcRenderer.send('read-file', fileName, passphrase);
        // Create a promise that waits for the message coming back that the file has been read
        return new Promise((resolve, reject) => {
            try {
                // Listen for the data to be sent from the main process
                this._ipcRenderer.once('file-read', (_, response: IPCDataContract<string>) => {
                    const ipcData = IPCDataContract.load(response);
                    resolve(ipcData);

                });

            } catch {
                reject();

            }

        });
    }
}

export { bridge, IPCBridge };
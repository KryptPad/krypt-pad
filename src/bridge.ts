import { IPCDataContract } from "../electron/ipc";

interface IBridge {
    readFileAsync(fileName: string, passphrase: string): Promise<IPCDataContract<string | undefined>>,
    saveFileAsync(fileName: string, plainText: string, passphrase: string): Promise<IPCDataContract<string | undefined>>,
    showSaveFileDialogAsync(): Promise<Electron.SaveDialogReturnValue>,
    showOpenFileDialogAsync(): Promise<Electron.OpenDialogReturnValue>
}

declare global {
    interface Window { bridge: IBridge; }
}

//window.bridge = window.bridge || {};

/**
 * This script gets the context bridge between main process and render process via IPC.
 */
const bridge = window.bridge;

export { bridge };
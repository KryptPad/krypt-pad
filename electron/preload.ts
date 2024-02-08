//window.global ||= window;

import { contextBridge, ipcRenderer } from 'electron';
import { IPCDataContract } from './ipc';

// Shortcut handlers
let _onHandleShortcut: Function | null = null;
// Called when window is restored
let _onUnmaximize: Function | null = null
// Called when window is maximized
let _onMaximize: Function | null = null
// Called when the window loses focus
let _onBlur: Function | null = null
// Called when the window gains focus
let _onFocus: Function | null = null

// Window states
let _isMaximized = false;

// Set up the context bridge and expose this object in the window object (main world)
contextBridge.exposeInMainWorld('bridge', {
    toggleMaximizeRestore: () => ipcRenderer.send('toggle-maximize-restore'),
    minimize: () => ipcRenderer.send('minimize'),
    close: () => ipcRenderer.send('close'),
    onHandleShortcut: (callback: Function) => { _onHandleShortcut = callback },
    onUnmaximize: (callback: Function) => { _onUnmaximize = callback },
    onMaximize: (callback: Function) => { _onMaximize = callback },
    onBlur: (callback: Function) => { _onBlur = callback },
    onFocus: (callback: Function) => { _onFocus = callback },
    getIsMaximized: () => { return _isMaximized; },
    /**
     * Shows the open file dialog.
     * @returns Promise
     */
    showOpenFileDialogAsync: async (): Promise<Electron.OpenDialogReturnValue> => {
        // Send message to main process to open the dialog.
        ipcRenderer.send('show-open-file-dialog');
        // Create a promise that waits for the message coming back that the user has selected a file
        return new Promise((resolve) => {
            ipcRenderer.once('file-selected', (_, response: Electron.OpenDialogReturnValue) => {
                resolve(response);
            });
        });

    },
    /**
     * Shows the save file dialog
     * @returns Promise
     */
    showSaveFileDialogAsync: async (): Promise<Electron.SaveDialogReturnValue> => {
        // Send message to main process to open the dialog.
        ipcRenderer.send('show-save-file-dialog');
        // Create a promise that waits for the message coming back that the user has selected a file
        return new Promise((resolve) => {
            ipcRenderer.once('file-selected', (_, response: Electron.SaveDialogReturnValue) => {
                resolve(response);
            });
        });

    },
    /**
     * Reads the contents of a file and returns it
     * @param {string} fileName 
     * @returns 
     */
    readFileAsync: (fileName: string, passphrase: string): Promise<IPCDataContract<string | undefined>> => {
        ipcRenderer.send('read-file', fileName, passphrase);
        // Create a promise that waits for the message coming back that the file has been read
        return new Promise((resolve, reject) => {
            try {
                // Listen for the data to be sent from the main process
                ipcRenderer.once('file-read', (_, response) => {
                    resolve(response);

                });

            } catch {
                reject();

            }

        });
    },
    /**
     * Encrypts and saves the profile to a file
     * @param {String} fileName 
     * @param {*} plainText 
     * @returns 
     */
    saveFileAsync: (fileName: string, plainText: any, passphrase: string) => {
        ipcRenderer.send('write-file', fileName, plainText, passphrase);
        // Create a promise that waits for the message coming back that the file has been written
        return new Promise((resolve, reject) => {
            try {
                // Listen for the data to be sent from the main process
                ipcRenderer.once('file-written', (_, err) => {
                    console.log("file written")
                    if (err) { throw err; }

                    resolve(true);

                });

            } catch {
                reject();

            }

        });
    }
})

// When the window is unmaximized, an event in the main process is raised that sends a message
// via IPC. This handler processes that message and raises a registered callback from the vue app.
ipcRenderer.on('unmaximize', () => {
    _isMaximized = false;
    _onUnmaximize?.()
})

// When the window is maximized, an event in the main process is raised that sends a message
// via IPC. This handler processes that message and raises a registered callback from the vue app.
ipcRenderer.on('maximize', () => {
    _isMaximized = true;
    _onMaximize?.()
})

// When the window loses focus, blur is fired from main process. This handler invokes a callback.
ipcRenderer.on('blur', () => { _onBlur?.() })

// When the window loses focus, blur is fired from main process. This handler invokes a callback.
ipcRenderer.on('focus', () => { _onFocus?.() })

// Handle global shortcuts sent from the main process
ipcRenderer.on('handle-shortcut', (_, args) => {
    console.log(args)
    _onHandleShortcut?.(args)
})


console.log("preload.js loaded ok")
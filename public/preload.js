const { contextBridge, ipcRenderer } = require('electron')

// Shortcut handlers
let _onHandleShortcut = null;
// Called when window is restored
let _onUnmaximize = null
// Called when window is maximized
let _onMaximize = null
// Called when the window loses focus
let _onBlur = null
// Called when the window gains focus
let _onFocus = null

// Window states
let _isMaximized = false;

// Set up the context bridge and expose this object in the window object (main world)
contextBridge.exposeInMainWorld('bridge', {
    toggleMaximizeRestore: () => ipcRenderer.send('toggle-maximize-restore'),
    minimize: () => ipcRenderer.send('minimize'),
    close: () => ipcRenderer.send('close'),
    onHandleShortcut: (callback) => { _onHandleShortcut = callback },
    onUnmaximize: (callback) => { _onUnmaximize = callback },
    onMaximize: (callback) => { _onMaximize = callback },
    onBlur: (callback) => { _onBlur = callback },
    onFocus: (callback) => { _onFocus = callback },
    getIsMaximized: () => { return _isMaximized; },
    /**
     * Shows the open file dialog.
     * @returns Promise
     */
    showOpenFileDialogAsync: async () => {
        // Send message to main process to open the dialog.
        ipcRenderer.send('show-open-file-dialog');
        // Create a promise that waits for the message coming back that the user has selected a file
        return new Promise((resolve) => {
            ipcRenderer.once('file-selected', (e, response) => {
                resolve(response);
            });
        });

    },
    /**
     * Shows the save file dialog
     * @returns Promise
     */
    showSaveFileDialogAsync: async () => {
        // Send message to main process to open the dialog.
        ipcRenderer.send('show-save-file-dialog');
        // Create a promise that waits for the message coming back that the user has selected a file
        return new Promise((resolve) => {
            ipcRenderer.once('file-selected', (e, response) => {
                console.log(e, response);
                resolve(response);
            });
        });

    },
    /**
     * Reads the contents of a file and returns it
     * @param {String} fileName 
     * @returns 
     */
    readFileAsync: (fileName) => {
        ipcRenderer.send('read-file', fileName);
        // Create a promise that waits for the message coming back that the file has been read
        return new Promise((resolve) => {
            try {
                // Listen for the data to be sent from the main process
                ipcRenderer.once('file-read', (e, response) => {
                    resolve(response);

                });

            } catch {
                reject();

            }

        });
    },
    /**
     * Saves contents to a file
     * @param {String} fileName 
     * @param {*} contents 
     * @returns 
     */
    saveFileAsync: (fileName, contents) => {
        ipcRenderer.send('write-file', fileName, contents);
        // Create a promise that waits for the message coming back that the file has been written
        return new Promise((resolve) => {
            try {
                // Listen for the data to be sent from the main process
                ipcRenderer.once('file-written', (e, err) => {
                    console.log("file written")
                    if (err) { throw err; }

                    resolve();

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
ipcRenderer.on('handle-shortcut', (sender, args) => {
    console.log(args)
    _onHandleShortcut?.(args)
})


console.log("preload.js loaded ok")
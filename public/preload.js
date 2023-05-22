const { contextBridge, ipcRenderer } = require('electron')

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
contextBridge.exposeInMainWorld('electronAPI', {
    toggleMaximizeRestore: () => ipcRenderer.send('toggle-maximize-restore'),
    minimize: () => ipcRenderer.send('minimize'),
    close: () => ipcRenderer.send('close'),
    onUnmaximize: (callback) => { _onUnmaximize = callback },
    onMaximize: (callback) => { _onMaximize = callback },
    onBlur: (callback) => { _onBlur = callback },
    onFocus: (callback) => { _onFocus = callback },
    getIsMaximized:() => {        return _isMaximized;    }
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


console.log("preload.js loaded ok")
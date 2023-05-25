'use strict'

const { app, protocol, BrowserWindow, ipcMain, dialog } = require('electron')
const windowStateKeeper = require('electron-window-state')
const { default: installExtension, VUEJS3_DEVTOOLS } = require('electron-devtools-installer')
const path = require('path')
const { createProtocol } = require('vue-cli-plugin-electron-builder/lib')
const { createReadStream } = require('fs')

const isDevelopment = process.env.NODE_ENV !== 'production'

// Filters for open/save file dialog
const filters = [
  { name: 'Krypt Pad File', extensions: ['kpf'] },
  { name: 'All Files', extensions: ['*'] }
];

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

let win = null;

/**
 * Creates the main browser window
 */
async function createWindow() {

  let mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  });

  console.log(path.join(__static, "safe.ico"))

  // Create the browser window.
  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    isMaximized: mainWindowState.isMaximized,
    titleBarStyle: "hidden",
    icon: path.join(__static, "safe.ico"),
    webPreferences: {

      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__static, 'preload.js')
    }
  })

  // Register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(win);

  if (mainWindowState.isMaximized){
    win.webContents.send("maximize")
  }

  // Open the dev tools in dev mode and load the main html file
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')

  }

  win.on("unmaximize", () => { win.webContents.send("unmaximize") })

  win.on("maximize", () => { win.webContents.send("maximize") })

  win.on("blur", () => { win.webContents.send("blur") })

  win.on("focus", () => { win.webContents.send("focus") })

}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }

  // Process IPC messages
  ipcMain.on('toggle-maximize-restore', (e) => {
    //if (!validateSender(e.senderFrame)) { return; }

    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // Minimize or restore the window
    win.isMaximized() ? win.restore() : win.maximize()

  });

  ipcMain.on('minimize', (e) => {
    //if (!validateSender(e.senderFrame)) { return; }

    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // Minimize or restore the window
    win.minimize()

  });

  ipcMain.on('close', (e) => {
    //if (!validateSender(e.senderFrame)) { return; }

    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // Minimize or restore the window
    win.close()

  });

  // Listen for message to show the open file dialog
  ipcMain.on('show-open-file-dialog', async (e) => {

    const options = {
      properties: ['openFile'],
      filters,
    };

    const response = await dialog.showOpenDialog(options);
    win.webContents.send("file-selected", response);

  });

  // Listen for message to show the save file dialog
  ipcMain.on('show-save-file-dialog', async (e) => {

    const options = {
      properties: ['showOverwriteConfirmation'],
      filters,
    };

    const response = await dialog.showSaveDialog(options);
    win.webContents.send("file-selected", response);
    
  });

  ipcMain.on('read-file', async (e, fileName) => {
    
    const fileStream = createReadStream(fileName);
    fileStream.on('readable', () => {
      let chunk;
      while( null !== ( chunk = fileStream.read(16) ) ) {
          // Handle the chunk
          console.log("Bytes:", chunk);
      }
      
      
    });
    
    
  });

  // function validateSender(frame) {
  //   // Value the host of the URL using an actual URL parser and an allowlist
  //   if ((new URL(frame.url)).host === 'electronjs.org') return true;
  //   return false;
  // }



  createWindow()

})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}


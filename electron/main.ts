// Main electron api.
import { app, protocol, BrowserWindow, ipcMain, dialog, shell, Menu, MenuItem, SaveDialogOptions, OpenDialogOptions } from 'electron'
// Library for working with directory paths.
import path from 'node:path'
// Library to keep track of the electron window state between uses.
import windowStateKeeper from 'electron-window-state';
import { writeFile, readFile } from 'fs/promises';
import { SHORTCUT_NEW, SHORTCUT_OPEN, SHORTCUT_CLOSE } from '../src/constants.ts';
import { decryptAsync, encryptAsync } from './krypto';
import { IPCDataContract, IPCData } from './ipc.ts';
import { KryptPadError } from '../common/error-utils';
import { AppSettings } from '@/app-settings.ts';

// Installs electron dev tools in the Developer Tools window.
//const { default: installExtension, VUEJS3_DEVTOOLS } = require('electron-devtools-installer');

//const { createProtocol } = require('vue-cli-plugin-electron-builder/lib');


// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']


const isDevelopment = process.env.NODE_ENV !== 'production'

// Filters for open/save file dialog
const filters: Electron.FileFilter[] = [
  { name: 'Krypt Pad File', extensions: ['kpf'] },
  { name: 'All Files', extensions: ['*'] }
];

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

const menu = new Menu();

/**
 * Creates the main browser window
 */
async function createWindow() {

  let mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  });

  // Create the browser window.
  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    //isMaximized: mainWindowState.isMaximized,
    titleBarStyle: "hidden",
    frame: false,
    icon: path.join(process.env.VITE_PUBLIC, "safe.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.webContents.openDevTools()


  if (mainWindowState.isMaximized) {
    win.maximize();

  }

  // Register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(win);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  // Register listeners to window events. These will send a request to the bridge process through IPC.
  win.on("unmaximize", () => { win?.webContents.send("unmaximize") })
  win.on("maximize", () => { win?.webContents.send("maximize") })
  win.on("blur", () => { win?.webContents.send("blur") })
  win.on("focus", () => { win?.webContents.send("focus") })

  //
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Create menu structure
menu.append(new MenuItem({
  label: 'File',
  submenu: [{
    label: 'New File',
    accelerator: SHORTCUT_NEW,
    click: () => { win?.webContents.send('handle-shortcut', SHORTCUT_NEW); }
  },
  {
    label: 'Open File',
    accelerator: SHORTCUT_OPEN,
    click: () => { win?.webContents.send('handle-shortcut', SHORTCUT_OPEN); }
  },
  {
    role: 'close',
    label: 'Close File',
    accelerator: SHORTCUT_CLOSE,
    click: () => { win?.webContents.send('handle-shortcut', SHORTCUT_CLOSE); }
  }]
}));

Menu.setApplicationMenu(menu);

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
  // if (isDevelopment && !process.env.IS_TEST) {
  //   // Install Vue Devtools
  //   try {
  //     await installExtension(VUEJS3_DEVTOOLS)
  //   } catch (e) {
  //     console.error('Vue Devtools failed to install:', e.toString())
  //   }
  // }

  // Register global shortcuts



  // Process IPC messages
  ipcMain.on('toggle-maximize-restore', (e) => {
    //if (!validateSender(e.senderFrame)) { return; }

    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // Minimize or restore the window
    win?.isMaximized() ? win?.restore() : win?.maximize()

  });

  // Return whether the window is maximized
  ipcMain.handle('is-maximized', () => {
    return win?.isMaximized();
  });

  ipcMain.on('minimize', (e) => {
    //if (!validateSender(e.senderFrame)) { return; }

    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // Minimize or restore the window
    win?.minimize()

  });

  ipcMain.on('close', (e) => {
    //if (!validateSender(e.senderFrame)) { return; }

    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // Minimize or restore the window
    win?.close()

  });

  // Listen for message to show the open file dialog
  ipcMain.on('show-open-file-dialog', async () => {
    if (!win) { return; }

    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters,
    };

    const response = await dialog.showOpenDialog(win, options);
    win?.webContents.send("file-selected", response);

  });

  // Listen for message to show the save file dialog
  ipcMain.on('show-save-file-dialog', async () => {
    if (!win) { return; }

    const options: SaveDialogOptions = {
      properties: ['showOverwriteConfirmation'],
      filters,
    };

    const response = await dialog.showSaveDialog(win, options);
    win.webContents.send("file-selected", response);

  });

  // Listens to the read-file message and opens the file. The file is read and the contents
  // are sent to the renderer process.
  ipcMain.handle('read-file', async (_, fileName, passphrase) => {

    const ipcData: IPCData<string> = {};

    try {
      // Open the file for reading
      const encryptedData = await readFile(fileName);
      // Decrypt the file data
      ipcData.data = await decryptAsync(encryptedData, passphrase);

    }
    catch (ex) {
      ipcData.error = KryptPadError.fromError(ex);

      console.error(ex);

    }

    return ipcData;

  });

  // Listen to the message to write the contents to the file 
  ipcMain.on('write-file', async (_, fileName, plainText, passphrase) => {

    const ipcData = new IPCDataContract<string>();
    try {
      // Encrypt the data
      const encryptedData = await encryptAsync(plainText, passphrase);

      await writeFile(fileName, encryptedData);

    }
    catch (ex) {
      ipcData.error = KryptPadError.fromError(ex);

      console.error(ipcData.error);

    }

    // Tell the renderer that the main process has written the file.
    win?.webContents.send("file-written", ipcData);

  });


  // Handles saving the application configuration
  ipcMain.handle('save-config', async (_, data: string) => {

    const ipcData: IPCData<string> = {};
    try {
      // Get the user data location
      const userDataDirectory = app.getPath('userData');
      await writeFile(path.join(userDataDirectory, 'settings.json'), data);

    }
    catch (ex) {
      ipcData.error = KryptPadError.fromError(ex);

      console.error(ipcData.error);

    }

    return ipcData;
  });

  // Handles loading the config file
  ipcMain.handle('load-config', async () => {

    const ipcData: IPCData<string> = {};
    try {
      // Get the user data location
      const userDataDirectory = app.getPath('userData');
      ipcData.data = await readFile(path.join(userDataDirectory, 'settings.json'), { encoding: 'utf-8' });

    }
    catch (ex) {
      ipcData.error = KryptPadError.fromError(ex);

      console.error(ipcData.error);

    }

    return ipcData;
  });


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

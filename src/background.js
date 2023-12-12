'use strict'

const { app, protocol, BrowserWindow, ipcMain, dialog, shell, Menu, MenuItem } = require('electron');
const windowStateKeeper = require('electron-window-state');
const { default: installExtension, VUEJS3_DEVTOOLS } = require('electron-devtools-installer');
const path = require('path');
const { createProtocol } = require('vue-cli-plugin-electron-builder/lib');
const { readFile, writeFile } = require('fs');
const { encrypt, decrypt } = require('./krypto');
const constants = require('@/constants');
//const cloneDeep = require('clonedeep');

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
const menu = new Menu();

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
    frame: false,
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

  if (mainWindowState.isMaximized) {
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

  // Register listeners to window events. These will send a request to the bridge process through IPC.
  win.on("unmaximize", () => { win.webContents.send("unmaximize") })
  win.on("maximize", () => { win.webContents.send("maximize") })
  win.on("blur", () => { win.webContents.send("blur") })
  win.on("focus", () => { win.webContents.send("focus") })

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
    role: '',
    label: 'New File',
    accelerator: constants.SHORTCUT_NEW,
    click: () => { win.webContents.send('handle-shortcut', constants.SHORTCUT_NEW); }
  },
  {
    role: '',
    label: 'Open File',
    accelerator: constants.SHORTCUT_OPEN,
    click: () => { win.webContents.send('handle-shortcut', constants.SHORTCUT_OPEN); }
  },
  {
    role: '',
    label: 'Close File',
    accelerator: constants.SHORTCUT_CLOSE,
    click: () => { win.webContents.send('handle-shortcut', constants.SHORTCUT_CLOSE); }
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
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }

  // Register global shortcuts



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

    const response = await dialog.showOpenDialog(win, options);
    win.webContents.send("file-selected", response);

  });

  // Listen for message to show the save file dialog
  ipcMain.on('show-save-file-dialog', async (e) => {

    const options = {
      properties: ['showOverwriteConfirmation'],
      filters,
    };

    const response = await dialog.showSaveDialog(win, options);
    win.webContents.send("file-selected", response);

  });

  // Listens to the read-file message and opens the file. The file is read and the contents
  // are sent to the renderer process.
  ipcMain.on('read-file', async (e, fileName) => {
    // Open the file for reading
    const fileContents = readFile(fileName, (err, data) => {
      if (err) { throw err; }
      // Send the data to the render process
      win.webContents.send("file-read", data);

    });

  });

  // Listen to the message to write the contents to the file 
  ipcMain.on('write-file', async (e, fileName, contents) => {
    writeFile(fileName, contents, (err) => {
      // Tell the renderer that the main process has written the file.
      win.webContents.send("file-written", err);
    });

  });

  // // Listen to the message to provide the menu structure to the app
  // ipcMain.on('get-menu', async () => {
  //   // Provide the menu to the app
  //   const menuItems = [];
  //   for (const item of menu.items) {
  //     const itemCopy = { label: item.label };
  //     buildSubmenu(itemCopy, item)
  //     menuItems.push(itemCopy);
  //   }

  //   win.webContents.send('menu', menuItems);
  // });

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

// function buildSubmenu(itemCopy, item) {
//   // Add the sub menu items
//   itemCopy.submenu = [];
//   console.log(item)
//   if (item.submenu?.items) {
//     for (const submenuItem of item.submenu?.items) {
//       // Create a submenuItemCopy object. This will store the submenu items of the parent File > [item1, item2, item3]
//       const submenuItemCopy = { label: submenuItem.label, userAccelerator: item.userAccelerator };
//       itemCopy.submenu.push(submenuItemCopy);

//       // Each item can have a submenu too, so add any submenu items under this submenu item
//       buildSubmenu(submenuItemCopy, submenuItem);

//     }
//   }

// }
"use strict";
const electron = require("electron");
const path = require("node:path");
const SHORTCUT_NEW = "CommandOrControl+N";
const SHORTCUT_OPEN = "CommandOrControl+O";
const SHORTCUT_CLOSE = "CommandOrControl+F4";
const windowStateKeeper = require("electron-window-state");
const { readFile, writeFile } = require("fs");
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const isDevelopment = process.env.NODE_ENV !== "production";
const filters = [
  { name: "Krypt Pad File", extensions: ["kpf"] },
  { name: "All Files", extensions: ["*"] }
];
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } }
]);
const menu = new electron.Menu();
async function createWindow() {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  });
  win = new electron.BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    //isMaximized: mainWindowState.isMaximized,
    titleBarStyle: "hidden",
    frame: false,
    icon: path.join(process.env.VITE_PUBLIC, "safe.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.webContents.openDevTools();
  mainWindowState.manage(win);
  if (mainWindowState.isMaximized) {
    win.webContents.send("maximize");
  }
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
  }
  win.on("unmaximize", () => {
    win == null ? void 0 : win.webContents.send("unmaximize");
  });
  win.on("maximize", () => {
    win == null ? void 0 : win.webContents.send("maximize");
  });
  win.on("blur", () => {
    win == null ? void 0 : win.webContents.send("blur");
  });
  win.on("focus", () => {
    win == null ? void 0 : win.webContents.send("focus");
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
menu.append(new electron.MenuItem({
  label: "File",
  submenu: [
    {
      role: "",
      label: "New File",
      accelerator: SHORTCUT_NEW,
      click: () => {
        win == null ? void 0 : win.webContents.send("handle-shortcut", SHORTCUT_NEW);
      }
    },
    {
      role: "",
      label: "Open File",
      accelerator: SHORTCUT_OPEN,
      click: () => {
        win == null ? void 0 : win.webContents.send("handle-shortcut", SHORTCUT_OPEN);
      }
    },
    {
      role: "",
      label: "Close File",
      accelerator: SHORTCUT_CLOSE,
      click: () => {
        win == null ? void 0 : win.webContents.send("handle-shortcut", SHORTCUT_CLOSE);
      }
    }
  ]
}));
electron.Menu.setApplicationMenu(menu);
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0)
    createWindow();
});
electron.app.whenReady().then(async () => {
  electron.ipcMain.on("toggle-maximize-restore", (e) => {
    const webContents = e.sender;
    const win2 = electron.BrowserWindow.fromWebContents(webContents);
    (win2 == null ? void 0 : win2.isMaximized()) ? win2 == null ? void 0 : win2.restore() : win2 == null ? void 0 : win2.maximize();
  });
  electron.ipcMain.on("minimize", (e) => {
    const webContents = e.sender;
    const win2 = electron.BrowserWindow.fromWebContents(webContents);
    win2 == null ? void 0 : win2.minimize();
  });
  electron.ipcMain.on("close", (e) => {
    const webContents = e.sender;
    const win2 = electron.BrowserWindow.fromWebContents(webContents);
    win2 == null ? void 0 : win2.close();
  });
  electron.ipcMain.on("show-open-file-dialog", async (e) => {
    const options = {
      properties: ["openFile"],
      filters
    };
    const response = await electron.dialog.showOpenDialog(win, options);
    win == null ? void 0 : win.webContents.send("file-selected", response);
  });
  electron.ipcMain.on("show-save-file-dialog", async (e) => {
    const options = {
      properties: ["showOverwriteConfirmation"],
      filters
    };
    const response = await electron.dialog.showSaveDialog(win, options);
    win.webContents.send("file-selected", response);
  });
  electron.ipcMain.on("read-file", async (e, fileName) => {
    readFile(fileName, (err, data) => {
      if (err) {
        throw err;
      }
      win.webContents.send("file-read", data);
    });
  });
  electron.ipcMain.on("write-file", async (e, fileName, contents) => {
    writeFile(fileName, contents, (err) => {
      win.webContents.send("file-written", err);
    });
  });
  createWindow();
});
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        electron.app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      electron.app.quit();
    });
  }
}

"use strict";
window.global || (window.global = window);
const { contextBridge, ipcRenderer } = require("electron");
let _onHandleShortcut = null;
let _onUnmaximize = null;
let _onMaximize = null;
let _onBlur = null;
let _onFocus = null;
let _isMaximized = false;
contextBridge.exposeInMainWorld("bridge", {
  toggleMaximizeRestore: () => ipcRenderer.send("toggle-maximize-restore"),
  minimize: () => ipcRenderer.send("minimize"),
  close: () => ipcRenderer.send("close"),
  onHandleShortcut: (callback) => {
    _onHandleShortcut = callback;
  },
  onUnmaximize: (callback) => {
    _onUnmaximize = callback;
  },
  onMaximize: (callback) => {
    _onMaximize = callback;
  },
  onBlur: (callback) => {
    _onBlur = callback;
  },
  onFocus: (callback) => {
    _onFocus = callback;
  },
  getIsMaximized: () => {
    return _isMaximized;
  },
  /**
   * Shows the open file dialog.
   * @returns Promise
   */
  showOpenFileDialogAsync: async () => {
    ipcRenderer.send("show-open-file-dialog");
    return new Promise((resolve) => {
      ipcRenderer.once("file-selected", (e, response) => {
        resolve(response);
      });
    });
  },
  /**
   * Shows the save file dialog
   * @returns Promise
   */
  showSaveFileDialogAsync: async () => {
    ipcRenderer.send("show-save-file-dialog");
    return new Promise((resolve) => {
      ipcRenderer.once("file-selected", (e, response) => {
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
    ipcRenderer.send("read-file", fileName);
    return new Promise((resolve) => {
      try {
        ipcRenderer.once("file-read", (e, response) => {
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
    ipcRenderer.send("write-file", fileName, contents);
    return new Promise((resolve) => {
      try {
        ipcRenderer.once("file-written", (e, err) => {
          console.log("file written");
          if (err) {
            throw err;
          }
          resolve();
        });
      } catch {
        reject();
      }
    });
  }
});
ipcRenderer.on("unmaximize", () => {
  _isMaximized = false;
  _onUnmaximize == null ? void 0 : _onUnmaximize();
});
ipcRenderer.on("maximize", () => {
  _isMaximized = true;
  _onMaximize == null ? void 0 : _onMaximize();
});
ipcRenderer.on("blur", () => {
  _onBlur == null ? void 0 : _onBlur();
});
ipcRenderer.on("focus", () => {
  _onFocus == null ? void 0 : _onFocus();
});
ipcRenderer.on("handle-shortcut", (sender, args) => {
  console.log(args);
  _onHandleShortcut == null ? void 0 : _onHandleShortcut(args);
});
console.log("preload.js loaded ok");

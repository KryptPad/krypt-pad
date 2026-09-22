// Main electron api.
import {
    app,
    protocol,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    Menu,
    MenuItem,
    SaveDialogOptions,
    OpenDialogOptions,
    IpcMainEvent,
    IpcMainInvokeEvent
} from 'electron'
// Library for working with directory paths.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
// Library to keep track of the electron window state between uses.
import windowStateKeeper from 'electron-window-state'
import { writeFile, readFile, open, rename, unlink } from 'fs/promises'
import crypto from 'node:crypto'
import { SHORTCUT_NEW, SHORTCUT_OPEN, SHORTCUT_CLOSE } from '../src/constants.ts'
import { ensureExtension } from '../src/utils.ts'
import { decryptFilePayloadAsync, encryptFilePayloadAsync } from './krypto'
import { IPCData } from './ipc.ts'
import { KryptPadError } from '../common/error-utils'

// Set app name
app.setName('Krypt Pad')

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

// Log the platform
console.log('Platform detected as ' + process.platform)

enum OSType {
    Windows,
    MacOS,
    Linux
}

const osType: OSType = process.platform === 'win32' ? OSType.Windows : process.platform === 'darwin' ? OSType.MacOS : OSType.Linux

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Filters for open/save file dialog
const filters: Electron.FileFilter[] = [
    { name: 'Krypt Pad File', extensions: ['kpf'] },
    { name: 'All Files', extensions: ['*'] }
]

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }])

let unlockedProfilePassphrase: string | null = null

/**
 * Files the user picked in an open or save dialog this session. Profiles can
 * only be read from or written to these paths, so a compromised renderer can't
 * use the unlocked passphrase to overwrite arbitrary files.
 */
const userSelectedPaths = new Set<string>()

/**
 * Records a path the user picked in a file dialog. The renderer adds the .kpf
 * extension when a name has none, so the same is done here to match.
 * @param filePath The path returned by the dialog
 */
function rememberUserSelectedPath(filePath: string) {
    userSelectedPaths.add(path.resolve(ensureExtension(filePath, 'kpf')))
}

/**
 * Throws unless the path is one the user picked in a file dialog.
 * @param filePath The path the renderer asked to use
 */
function assertUserSelectedPath(filePath: string) {
    if (typeof filePath !== 'string' || !userSelectedPaths.has(path.resolve(filePath))) {
        throw new Error('The file was not selected by the user.')
    }
}

/**
 * The URL the packaged app's page is loaded from.
 */
const appFileUrl = pathToFileURL(path.join(process.env.DIST, 'index.html')).href

/**
 * Whether a URL belongs to the app itself rather than to outside content.
 * @param url The URL to check
 */
function isAppUrl(url: string): boolean {
    if (VITE_DEV_SERVER_URL) {
        try {
            return new URL(url).origin === new URL(VITE_DEV_SERVER_URL).origin
        } catch {
            return false
        }
    }

    return url === appFileUrl || url.startsWith(appFileUrl + '#')
}

/**
 * Opens a link in the user's browser. Only https links are allowed, so a link
 * can't be used to launch local files or other protocol handlers.
 * @param url The URL to open
 */
function openExternalIfSafe(url: string) {
    try {
        if (new URL(url).protocol === 'https:') {
            void shell.openExternal(url)
        }
    } catch {
        // Not a valid URL, so there is nothing to open
    }
}

/**
 * Whether an IPC message came from the app's own page in the main window.
 * @param e The IPC event
 */
function isTrustedSender(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
    const frame = e.senderFrame
    if (!frame || !win || win.isDestroyed() || e.sender !== win.webContents || frame !== win.webContents.mainFrame) {
        return false
    }

    return isAppUrl(frame.url)
}

/**
 * Registers an invoke handler that rejects calls from untrusted senders.
 */
function handleTrusted(channel: string, listener: (e: IpcMainInvokeEvent, ...args: any[]) => any) {
    ipcMain.handle(channel, (e, ...args) => {
        if (!isTrustedSender(e)) {
            throw new Error(`Rejected ${channel} from an untrusted sender.`)
        }

        return listener(e, ...args)
    })
}

/**
 * Registers a message listener that ignores messages from untrusted senders.
 */
function onTrusted(channel: string, listener: (e: IpcMainEvent, ...args: any[]) => void) {
    ipcMain.on(channel, (e, ...args) => {
        if (!isTrustedSender(e)) {
            return
        }

        listener(e, ...args)
    })
}

/**
 * Whether the renderer has finished writing any pending edits and the window
 * is free to close. Until this is set, a close request is deferred so the
 * debounced autosave can't be discarded along with the window.
 */
let pendingEditsFlushed = false

/**
 * Whether the user asked to quit the whole app rather than just close the
 * window. On macOS the quit is deferred while edits are flushed, so it has to
 * be resumed once the window is actually gone.
 */
let quitRequested = false

/**
 * How long to wait for the renderer to report back before closing anyway. A
 * hung or crashed renderer must never leave the user unable to quit.
 */
const FLUSH_BEFORE_CLOSE_TIMEOUT = 3000

/**
 * Closes the main window now that pending edits are safely on disk, resuming
 * a quit if that is what the user originally asked for.
 */
function closeAfterFlush() {
    if (pendingEditsFlushed) {
        return
    }

    pendingEditsFlushed = true
    win?.close()

    if (quitRequested) {
        app.quit()
    }
}

/**
 * Atomically writes data to a file by writing to a temporary file in the same
 * directory, flushing it to disk, then renaming it over the target. This
 * prevents a crash or power loss mid-write from corrupting the destination.
 *
 * The temporary file name is unique per process and per call. A shared name
 * would let a second writer truncate the temp file this one is midway through,
 * so the rename could publish a partial file over a perfectly good profile.
 * @param filePath The path of the file to write
 * @param data The data to write
 */
async function writeFileAtomic(filePath: string, data: Uint8Array): Promise<void> {
    const directory = path.dirname(filePath)
    const uniqueSuffix = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`
    const tempFilePath = path.join(directory, `.${path.basename(filePath)}.${uniqueSuffix}.tmp`)

    try {
        // Write to a temporary file in the same directory as the target
        const fileHandle = await open(tempFilePath, 'w')
        try {
            await fileHandle.writeFile(data)
            // Ensure the data is durably written to disk before replacing the target
            await fileHandle.sync()
        } finally {
            await fileHandle.close()
        }

        // Atomically replace the destination with the fully-written temp file
        await rename(tempFilePath, filePath)
    } catch (ex) {
        // Clean up the temporary file if it was created
        await unlink(tempFilePath).catch(() => {})
        throw ex
    }
}

/**
 * Creates the main browser window
 */
function createWindow() {
    // A window reopened from the dock on macOS needs its own flush handshake,
    // so clear the state left behind by the previous one.
    pendingEditsFlushed = false
    quitRequested = false

    const mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 800
    })

    // Create the browser window.
    win = new BrowserWindow({
        title: 'Krypt Pad',
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        titleBarStyle: 'hidden',
        //...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
        icon: path.join(process.env.VITE_PUBLIC, 'safe.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // These match Electron's defaults, but are pinned so a dependency
            // or config change can't weaken the renderer that holds the vault.
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true
        }
    })

    // Open dev tools if the app is in development mode
    if (!app.isPackaged) {
        win.webContents.openDevTools()
    }

    if (mainWindowState.isMaximized) {
        win.maximize()
    }

    // Register listeners on the window, so we can update the state
    // automatically (the listeners will be removed when the window is closed)
    // and restore the maximized or full screen state
    mainWindowState.manage(win)

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }

    // Register listeners to window events. These will send a request to the bridge process through IPC.
    win.on('unmaximize', () => {
        win?.webContents.send('unmaximize')
    })
    win.on('maximize', () => {
        win?.webContents.send('maximize')
    })
    win.on('blur', () => {
        win?.webContents.send('blur')
    })
    win.on('focus', () => {
        win?.webContents.send('focus')
    })

    // Give the renderer a chance to write any debounced edits before the window
    // goes away. Without this, closing the window discards up to the length of
    // the autosave debounce worth of the user's typing.
    win.on('close', (e) => {
        if (pendingEditsFlushed) {
            return
        }

        e.preventDefault()
        win?.webContents.send('flush-before-close')

        // Don't let a hung renderer trap the user in the app
        setTimeout(closeAfterFlush, FLUSH_BEFORE_CLOSE_TIMEOUT)
    })

    // Links that open a new window go to the user's browser instead
    win.webContents.setWindowOpenHandler(({ url }) => {
        openExternalIfSafe(url)
        return { action: 'deny' }
    })

    // The window must only ever show the app itself
    win.webContents.on('will-navigate', (e, url) => {
        if (isAppUrl(url)) {
            return
        }

        e.preventDefault()
        openExternalIfSafe(url)
    })
}

const menu = new Menu()

// macOS App menu
if (osType === OSType.MacOS) {
    menu.append(
        new MenuItem({
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        })
    )
}

// File menu
menu.append(
    new MenuItem({
        label: 'File',
        submenu: [
            {
                label: 'New File',
                accelerator: SHORTCUT_NEW,
                click: () => win?.webContents.send('handle-shortcut', SHORTCUT_NEW)
            },
            {
                label: 'Open File',
                accelerator: SHORTCUT_OPEN,
                click: () => win?.webContents.send('handle-shortcut', SHORTCUT_OPEN)
            },
            { type: 'separator' },
            {
                label: 'Close File',
                accelerator: SHORTCUT_CLOSE,
                click: () => win?.webContents.send('handle-shortcut', SHORTCUT_CLOSE)
            }
        ]
    })
)

menu.append(new MenuItem({ role: 'editMenu' }))

Menu.setApplicationMenu(menu)

// Only one instance may run at a time. Two instances sharing a profile would
// race each other's saves and could leave the file unopenable.
if (!app.requestSingleInstanceLock()) {
    app.quit()
} else {
    app.on('second-instance', () => {
        // Surface the window the user already has rather than opening another
        if (win) {
            if (win.isMinimized()) {
                win.restore()
            }
            win.focus()
        }
    })
}

// On macOS, Cmd+Q quits without going through the window close path, so the
// pending-edit flush has to be requested here too.
app.on('before-quit', (e) => {
    if (pendingEditsFlushed || !win || win.isDestroyed()) {
        return
    }

    quitRequested = true
    e.preventDefault()
    win.close()
})

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
    // Process IPC messages
    onTrusted('toggle-maximize-restore', (e) => {
        const webContents = e.sender
        const win = BrowserWindow.fromWebContents(webContents)

        // Minimize or restore the window
        win?.isMaximized() ? win?.restore() : win?.maximize()
    })

    // Return whether the window is maximized
    handleTrusted('is-maximized', () => {
        return win?.isMaximized()
    })

    onTrusted('minimize', (e) => {
        const webContents = e.sender
        const win = BrowserWindow.fromWebContents(webContents)

        // Minimize or restore the window
        win?.minimize()
    })

    onTrusted('close', (e) => {
        const webContents = e.sender
        const win = BrowserWindow.fromWebContents(webContents)

        // Minimize or restore the window
        win?.close()
    })

    // Listen for message to show the open file dialog
    handleTrusted('show-open-file-dialog', async (_, defaultPath?: string) => {
        if (!win) {
            return
        }

        const options: OpenDialogOptions = {
            defaultPath: defaultPath,
            properties: ['openFile'],
            filters
        }

        const result = await dialog.showOpenDialog(win, options)
        if (!result.canceled) {
            result.filePaths.forEach(rememberUserSelectedPath)
        }

        return result
    })

    // Listen for message to show the save file dialog
    handleTrusted('show-save-file-dialog', async (_, defaultPath?: string) => {
        if (!win) {
            return
        }

        const options: SaveDialogOptions = {
            defaultPath: defaultPath,
            properties: ['showOverwriteConfirmation'],
            filters
        }

        const result = await dialog.showSaveDialog(win, options)
        if (!result.canceled && result.filePath) {
            rememberUserSelectedPath(result.filePath)
        }

        return result
    })

    handleTrusted('open-profile', async (_, fileName: string, passphrase: string) => {
        const ipcData: IPCData<string> = {}

        try {
            assertUserSelectedPath(fileName)

            // Open the file for reading
            const encryptedData = await readFile(fileName)
            ipcData.data = await decryptFilePayloadAsync(encryptedData, passphrase)
            unlockedProfilePassphrase = passphrase
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ex)
        }

        return ipcData
    })

    handleTrusted('save-profile', async (_, fileName: string, profileData: string) => {
        const ipcData: IPCData<string> = {}

        try {
            assertUserSelectedPath(fileName)

            if (!unlockedProfilePassphrase) {
                throw new Error('No unlocked profile session is active.')
            }

            // Open file for writing
            const encryptedData = await encryptFilePayloadAsync(profileData, unlockedProfilePassphrase)
            // Write atomically so a crash mid-write can't corrupt the vault
            await writeFileAtomic(fileName, new Uint8Array(encryptedData))
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    handleTrusted('set-session-passphrase', async (_, passphrase: string) => {
        const ipcData: IPCData<string> = {}

        try {
            if (!passphrase) {
                throw new Error('Passphrase is required.')
            }

            unlockedProfilePassphrase = passphrase
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    handleTrusted('lock-profile', async () => {
        unlockedProfilePassphrase = null
    })

    // The renderer has finished persisting its pending edits, so the window
    // that was held open by the close handler can now go away.
    handleTrusted('flush-complete', () => {
        closeAfterFlush()
    })

    // Handles saving the application configuration
    handleTrusted('save-config', async (_, data: string) => {
        const ipcData: IPCData<string> = {}
        try {
            // Get the user data location
            const userDataDirectory = app.getPath('userData')
            await writeFile(path.join(userDataDirectory, 'settings.json'), data)
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    // Handles loading the config file
    handleTrusted('load-config', async () => {
        const ipcData: IPCData<string> = {}
        try {
            // Get the user data location
            const userDataDirectory = app.getPath('userData')
            ipcData.data = await readFile(path.join(userDataDirectory, 'settings.json'), { encoding: 'utf-8' })
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    // Handles getting the process platform
    handleTrusted('get-platform', () => {
        return process.platform
    })

    createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (!app.isPackaged) {
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

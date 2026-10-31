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
import { writeFile, readFile, mkdir, readdir, stat, unlink } from 'fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import crypto from 'node:crypto'
import { SHORTCUT_NEW, SHORTCUT_OPEN, SHORTCUT_CLOSE } from '../src/constants.ts'
import { ensureExtension } from '../src/utils.ts'
import {
    decryptFilePayloadAsync,
    decryptFilePayloadWithKey,
    deriveFileKeyAsync,
    destroyFileKey,
    encryptFilePayload,
    createAttachmentKey,
    encryptAttachmentFileAsync,
    decryptAttachmentFileAsync,
    type FileKey
} from './krypto'
import { writeFileAtomic, copyFileAtomic } from './fs-utils'
import { IPCData } from './ipc.ts'
import { KryptPadError, KryptPadErrorCodes } from '../common/error-utils'

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
// Shown while the main window loads, then closed once the app is ready
let splash: BrowserWindow | null = null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Filters for open/save file dialog
const filters: Electron.FileFilter[] = [
    { name: 'Krypt Pad File', extensions: ['kpf'] },
    { name: 'All Files', extensions: ['*'] }
]

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }])

/**
 * The derived key for the unlocked profile. The passphrase itself is never
 * kept: it is turned into a key once, when the profile is opened or a new
 * passphrase is set, and each save reuses that key.
 */
let unlockedFileKey: FileKey | null = null

/**
 * Bumped whenever the session key is replaced or cleared. A key derivation
 * still running when the session changes must not install its result, or a
 * lock or a newer passphrase could be undone by a slower, older request.
 */
let fileKeyGeneration = 0

/**
 * Replaces the session key, wiping the previous one.
 * @param fileKey The new key, or null to lock
 */
function setUnlockedFileKey(fileKey: FileKey | null) {
    fileKeyGeneration++
    if (unlockedFileKey !== fileKey) {
        destroyFileKey(unlockedFileKey)
    }
    unlockedFileKey = fileKey
}

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
 * How long to wait for the app to report that it is ready before showing the
 * main window anyway. The splash screen covers the wait, so this is only a
 * safety net for a renderer that never finishes loading.
 */
const SHOW_WINDOW_TIMEOUT = 60000

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
 * The vault file this session last read or wrote, and the SHA-256 of the
 * bytes it held then. Before each save the file on disk is hashed and compared
 * with this, so a vault changed by another device (e.g. through OneDrive or
 * Google Drive) is never silently overwritten.
 */
let vaultBaseline: { filePath: string; hash: string } | null = null

/**
 * Watches the vault's directory for changes made outside this session.
 */
let vaultWatcher: FSWatcher | null = null
let vaultWatchTimer: ReturnType<typeof setTimeout> | undefined
/**
 * The last external version the renderer was told about, so one change isn't
 * reported over and over while the user decides what to do.
 */
let lastReportedVaultHash: string | null = null

/**
 * How long to let a burst of file system events settle before checking the
 * vault. Sync clients often write a file in several steps.
 */
const VAULT_WATCH_DEBOUNCE = 500

/**
 * Unused attachment files are only removed once they are at least this old.
 * Another device's newer profile may reference an attachment this device's
 * profile does not know about yet.
 */
const ATTACHMENT_COMPACT_MIN_AGE = 30 * 24 * 60 * 60 * 1000

/**
 * Hashes vault file bytes for change detection.
 */
function hashVault(data: Uint8Array): string {
    return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Records the version of the vault this session now holds, and starts
 * watching it when it is a different file from before.
 * @param filePath The vault path
 * @param hash The hash of the vault bytes this session read or wrote
 */
function setVaultBaseline(filePath: string, hash: string) {
    const resolved = path.resolve(filePath)
    if (vaultBaseline?.filePath !== resolved) {
        watchVault(resolved)
    }

    vaultBaseline = { filePath: resolved, hash }
    lastReportedVaultHash = null
}

/**
 * Forgets the vault baseline and stops watching, e.g. when the vault is locked.
 */
function clearVaultBaseline() {
    vaultBaseline = null
    lastReportedVaultHash = null
    stopWatchingVault()
}

function stopWatchingVault() {
    clearTimeout(vaultWatchTimer)
    vaultWatcher?.close()
    vaultWatcher = null
}

/**
 * Watches a vault for changes made by something other than this session. The
 * directory is watched rather than the file, because an atomic save renames a
 * new file over the old one and a watch on the file itself would be lost.
 * @param filePath The resolved vault path
 */
function watchVault(filePath: string) {
    stopWatchingVault()

    const fileName = path.basename(filePath)
    try {
        vaultWatcher = watch(path.dirname(filePath), (_, changedName) => {
            // Some platforms don't report the name, so check anyway then
            if (changedName && changedName.toString() !== fileName) {
                return
            }

            clearTimeout(vaultWatchTimer)
            vaultWatchTimer = setTimeout(() => void checkVaultForExternalChange(filePath), VAULT_WATCH_DEBOUNCE)
        })
        vaultWatcher.on('error', (ex) => {
            console.error('Stopped watching the vault for changes.', ex)
            stopWatchingVault()
        })
    } catch (ex) {
        // Watching is a convenience; saves are still checked for conflicts
        console.error('Could not watch the vault for changes.', ex)
    }
}

/**
 * Tells the renderer when the vault on disk no longer matches what this
 * session last read or wrote.
 * @param filePath The resolved vault path being watched
 */
async function checkVaultForExternalChange(filePath: string) {
    let hash: string
    try {
        hash = hashVault(await readFile(filePath))
    } catch {
        // Missing or mid-replace; a later event or the next save will catch it
        return
    }

    if (!vaultBaseline || vaultBaseline.filePath !== filePath || hash === vaultBaseline.hash || hash === lastReportedVaultHash) {
        return
    }

    lastReportedVaultHash = hash
    win?.webContents.send('vault-changed-externally')
}

/**
 * Throws if the vault on disk was changed since this session last read or
 * wrote it. A save to a different path than the baseline (a new vault or Save
 * As, where the user already confirmed any overwrite) is not checked.
 * @param filePath The vault path about to be written
 */
async function assertVaultUnchanged(filePath: string) {
    if (!vaultBaseline || vaultBaseline.filePath !== path.resolve(filePath)) {
        return
    }

    let current: Buffer
    try {
        current = await readFile(filePath)
    } catch (ex) {
        if ((ex as NodeJS.ErrnoException)?.code === 'ENOENT') {
            throw new KryptPadError('The vault file was moved or deleted since it was opened.', KryptPadErrorCodes.VAULT_MISSING)
        }
        throw ex
    }

    if (hashVault(current) !== vaultBaseline.hash) {
        throw new KryptPadError('The vault was changed by someone else, possibly on another device.', KryptPadErrorCodes.VAULT_CHANGED)
    }
}

/**
 * The folder holding a vault's encrypted attachments.
 * @param vaultFileName The vault path
 */
function getAttachmentDirectory(vaultFileName: string): string {
    return `${path.resolve(vaultFileName)}.files`
}

const ATTACHMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * The path of one encrypted attachment. The id comes from the renderer, so it
 * must be a plain UUID and can't point outside the attachment folder.
 * @param vaultFileName The vault path
 * @param attachmentId The attachment's id
 */
function getAttachmentPath(vaultFileName: string, attachmentId: string): string {
    if (typeof attachmentId !== 'string' || !ATTACHMENT_ID_PATTERN.test(attachmentId)) {
        throw new Error('The attachment id is invalid.')
    }

    return path.join(getAttachmentDirectory(vaultFileName), `${attachmentId}.kpb`)
}

/**
 * Decodes an attachment key sent by the renderer.
 */
function decodeAttachmentKey(key: string): Buffer {
    if (typeof key !== 'string') {
        throw new Error('The attachment key is invalid.')
    }

    return Buffer.from(key, 'base64')
}

/**
 * Creates the splash screen window, which shows the logo while the main
 * window is still loading. It loads a static page with no script, so it opens
 * almost instantly.
 */
function createSplashWindow() {
    splash = new BrowserWindow({
        width: 450,
        height: 300,
        frame: false,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        center: true,
        show: false,
        backgroundColor: '#121212',
        title: 'Krypt Pad',
        icon: path.join(process.env.VITE_PUBLIC, 'safe.png'),
        webPreferences: {
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true
        }
    })

    splash.once('ready-to-show', () => splash?.show())
    splash.on('closed', () => {
        splash = null
    })

    // The splash screen never navigates or opens windows
    splash.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    splash.webContents.on('will-navigate', (e) => e.preventDefault())

    splash.loadFile(path.join(process.env.VITE_PUBLIC, 'splash.html'))
}

/**
 * Closes the splash screen, if it is still open.
 */
function closeSplashWindow() {
    if (splash && !splash.isDestroyed()) {
        splash.close()
    }
    splash = null
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
        // Stay hidden behind the splash screen until the app has loaded, and
        // match its background so the user never sees a blank white window.
        show: false,
        backgroundColor: '#121212',
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

    // Show the window once the app reports it has mounted, swapping it in for
    // the splash screen. Maximizing would show the window early, so it
    // happens here too.
    const mainWindow = win
    let windowShown = false
    const showWindow = () => {
        if (windowShown || mainWindow.isDestroyed()) {
            return
        }

        windowShown = true
        clearTimeout(showWindowTimer)
        ipcMain.removeListener('app-ready', onAppReady)

        if (mainWindowState.isMaximized) {
            mainWindow.maximize()
        }
        mainWindow.show()
        closeSplashWindow()
    }
    const onAppReady = (e: IpcMainEvent) => {
        if (e.sender === mainWindow.webContents && isTrustedSender(e)) {
            showWindow()
        }
    }
    ipcMain.on('app-ready', onAppReady)
    // Never leave the user staring at the splash screen if the app fails to load
    mainWindow.webContents.once('did-fail-load', showWindow)
    mainWindow.webContents.once('render-process-gone', showWindow)
    const showWindowTimer = setTimeout(showWindow, SHOW_WINDOW_TIMEOUT)
    mainWindow.on('closed', () => {
        clearTimeout(showWindowTimer)
        ipcMain.removeListener('app-ready', onAppReady)
        closeSplashWindow()
    })

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
        // Surface the window the user already has rather than opening another.
        // While the app is still loading, that is the splash screen.
        if (splash && !splash.isDestroyed()) {
            splash.focus()
        } else if (win) {
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
    if (BrowserWindow.getAllWindows().length === 0) {
        createSplashWindow()
        createWindow()
    }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    // Put the splash screen up first, so something is on screen while the
    // main window loads
    createSplashWindow()

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
            const generation = fileKeyGeneration
            const { data, fileKey } = await decryptFilePayloadAsync(encryptedData, passphrase)

            if (generation !== fileKeyGeneration) {
                // The session changed while the key was being derived
                destroyFileKey(fileKey)
                throw new Error('The profile session changed while the file was being opened.')
            }

            setUnlockedFileKey(fileKey)
            setVaultBaseline(fileName, hashVault(encryptedData))
            ipcData.data = data
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ex)
        }

        return ipcData
    })

    // Re-reads the vault with the session key, e.g. after another device saved it
    handleTrusted('reload-profile', async (_, fileName: string) => {
        const ipcData: IPCData<string> = {}

        try {
            assertUserSelectedPath(fileName)

            if (!unlockedFileKey) {
                throw new Error('No unlocked profile session is active.')
            }

            const encryptedData = await readFile(fileName)
            ipcData.data = decryptFilePayloadWithKey(encryptedData, unlockedFileKey)
            setVaultBaseline(fileName, hashVault(encryptedData))
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    handleTrusted('save-profile', async (_, fileName: string, profileData: string, options?: { force?: boolean; hasAttachments?: boolean }) => {
        const ipcData: IPCData<string> = {}

        try {
            assertUserSelectedPath(fileName)

            if (!unlockedFileKey) {
                throw new Error('No unlocked profile session is active.')
            }

            // Encrypt with the session key. This is synchronous, so a lock
            // arriving mid-save can't wipe the key out from under it.
            const encryptedData = encryptFilePayload(profileData, unlockedFileKey, options?.hasAttachments === true)

            // Refuse to overwrite changes made elsewhere unless the user chose to
            if (options?.force !== true) {
                await assertVaultUnchanged(fileName)
            }

            // Write atomically so a crash mid-write can't corrupt the vault
            await writeFileAtomic(fileName, new Uint8Array(encryptedData))
            setVaultBaseline(fileName, hashVault(encryptedData))
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    // Writes the session's edits to a new "conflicted copy" file next to the
    // vault, for when the vault was changed elsewhere and the session is being
    // closed before the user could decide. The copy uses the session key and
    // gets the attachments it references.
    handleTrusted('save-conflict-copy', async (_, fileName: string, profileData: string, attachmentIds: string[]) => {
        const ipcData: IPCData<string> = {}

        try {
            assertUserSelectedPath(fileName)

            if (!unlockedFileKey) {
                throw new Error('No unlocked profile session is active.')
            }

            const ids = Array.isArray(attachmentIds) ? attachmentIds : []
            const encryptedData = encryptFilePayload(profileData, unlockedFileKey, ids.length > 0)

            const parsed = path.parse(path.resolve(fileName))
            const stamp = new Date().toISOString().replace(/[:.]/g, '-')
            const copyPath = path.join(parsed.dir, `${parsed.name} (conflicted copy ${stamp})${parsed.ext}`)

            if (ids.length) {
                await mkdir(getAttachmentDirectory(copyPath), { recursive: true })
                for (const id of ids) {
                    await copyFileAtomic(getAttachmentPath(fileName, id), getAttachmentPath(copyPath, id)).catch((ex) => {
                        // An attachment still syncing shouldn't cost the user their edits
                        console.error(ex)
                    })
                }
            }

            await writeFileAtomic(copyPath, new Uint8Array(encryptedData))
            ipcData.data = copyPath
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

            const generation = fileKeyGeneration
            const fileKey = await deriveFileKeyAsync(passphrase)

            if (generation !== fileKeyGeneration) {
                // Locked or replaced while deriving; this key is stale
                destroyFileKey(fileKey)
                throw new Error('The profile session changed while the passphrase was being set.')
            }

            setUnlockedFileKey(fileKey)
            // A new passphrase starts a new vault, which has no version yet
            clearVaultBaseline()
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    handleTrusted('lock-profile', async () => {
        setUnlockedFileKey(null)
        clearVaultBaseline()
    })

    // Lets the user pick files, encrypts each into the vault's attachment
    // folder, and returns their metadata and keys for the profile. The source
    // paths never pass through the renderer.
    handleTrusted('add-attachments', async (_, vaultFileName: string) => {
        const ipcData: IPCData<{ attachments: object[]; errors: string[] } | undefined> = {}

        try {
            assertUserSelectedPath(vaultFileName)

            if (!unlockedFileKey || !win) {
                throw new Error('No unlocked profile session is active.')
            }

            const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
            if (result.canceled) {
                return ipcData
            }

            const attachments: object[] = []
            const errors: string[] = []
            await mkdir(getAttachmentDirectory(vaultFileName), { recursive: true })

            for (const sourcePath of result.filePaths) {
                const id = crypto.randomUUID()
                const key = createAttachmentKey()
                try {
                    const size = await encryptAttachmentFileAsync(sourcePath, getAttachmentPath(vaultFileName, id), id, key)
                    attachments.push({ id, name: path.basename(sourcePath), size, key: key.toString('base64'), added: new Date().toISOString() })
                } catch (ex) {
                    errors.push(`${path.basename(sourcePath)}: ${KryptPadError.fromError(ex).message}`)
                    console.error(ex)
                } finally {
                    key.fill(0)
                }
            }

            ipcData.data = { attachments, errors }
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    // Decrypts an attachment to a location the user picks
    handleTrusted('save-attachment-as', async (_, vaultFileName: string, attachment: { id: string; name: string; key: string }) => {
        const ipcData: IPCData<boolean> = {}

        try {
            assertUserSelectedPath(vaultFileName)

            if (!unlockedFileKey || !win) {
                throw new Error('No unlocked profile session is active.')
            }

            const sourcePath = getAttachmentPath(vaultFileName, attachment?.id)
            const key = decodeAttachmentKey(attachment.key)
            try {
                const defaultName = path.basename(String(attachment.name || 'attachment'))
                const result = await dialog.showSaveDialog(win, {
                    defaultPath: path.join(app.getPath('downloads'), defaultName),
                    properties: ['showOverwriteConfirmation']
                })
                if (result.canceled || !result.filePath) {
                    ipcData.data = false
                    return ipcData
                }

                await decryptAttachmentFileAsync(sourcePath, result.filePath, attachment.id, key)
                ipcData.data = true
            } finally {
                key.fill(0)
            }
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    // Copies encrypted attachments to another vault's folder, for Save As.
    // The keys live in the profile, so the files are copied as they are.
    handleTrusted('copy-attachments', async (_, fromVaultFileName: string, toVaultFileName: string, attachmentIds: string[]) => {
        const ipcData: IPCData<string[]> = {}

        try {
            assertUserSelectedPath(fromVaultFileName)
            assertUserSelectedPath(toVaultFileName)

            const missing: string[] = []
            if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
                await mkdir(getAttachmentDirectory(toVaultFileName), { recursive: true })

                for (const id of attachmentIds) {
                    const sourcePath = getAttachmentPath(fromVaultFileName, id)
                    const destPath = getAttachmentPath(toVaultFileName, id)
                    if (sourcePath === destPath) {
                        continue
                    }

                    try {
                        await copyFileAtomic(sourcePath, destPath)
                    } catch (ex) {
                        if ((ex as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                            throw ex
                        }
                        missing.push(id)
                    }
                }
            }

            // Ids whose files were not on this device, e.g. still syncing
            ipcData.data = missing
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
    })

    // Removes encrypted attachment files no longer referenced by the profile.
    // Only files older than the grace period are removed, because another
    // device may hold a newer profile that still references them.
    handleTrusted('compact-attachments', async (_, vaultFileName: string, referencedIds: string[]) => {
        const ipcData: IPCData<number> = {}

        try {
            assertUserSelectedPath(vaultFileName)

            if (!Array.isArray(referencedIds)) {
                throw new Error('The attachment list is invalid.')
            }

            const directory = getAttachmentDirectory(vaultFileName)
            const referenced = new Set(referencedIds)
            let removed = 0

            let entries: string[] = []
            try {
                entries = await readdir(directory)
            } catch (ex) {
                if ((ex as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                    throw ex
                }
            }

            for (const entry of entries) {
                const id = entry.endsWith('.kpb') ? entry.slice(0, -'.kpb'.length) : ''
                if (!ATTACHMENT_ID_PATTERN.test(id) || referenced.has(id)) {
                    continue
                }

                const filePath = path.join(directory, entry)
                if (Date.now() - (await stat(filePath)).mtimeMs >= ATTACHMENT_COMPACT_MIN_AGE) {
                    await unlink(filePath)
                    removed++
                }
            }

            ipcData.data = removed
        } catch (ex) {
            ipcData.error = KryptPadError.fromError(ex)

            console.error(ipcData.error)
        }

        return ipcData
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

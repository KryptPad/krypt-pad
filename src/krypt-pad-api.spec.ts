import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock state so the mock factory can reference it.
const { ipcBridgeMock } = vi.hoisted(() => ({
    ipcBridgeMock: {
        openProfile: vi.fn(),
        saveProfile: vi.fn(),
        setSessionPassphrase: vi.fn(),
        lockProfile: vi.fn(),
        saveConfigFile: vi.fn(),
        loadConfigFile: vi.fn(),
        showOpenFileDialogAsync: vi.fn(),
        showSaveFileDialogAsync: vi.fn(),
        getIsMaximized: vi.fn(),
        toggleMaximizeRestore: vi.fn(),
        minimize: vi.fn(),
        close: vi.fn(),
        getPlatform: vi.fn(),
        onAppEvent: vi.fn()
    }
}))

vi.mock('@/bridge', () => ({
    IPCBridge: vi.fn(function () {
        return ipcBridgeMock
    })
}))

// Mock the dialog components so they don't need Vuetify to be fully mounted.
vi.mock('@/components/ConfirmDialog.vue', () => ({ default: { name: 'ConfirmDialog' } }))
vi.mock('@/components/AlertDialog.vue', () => ({ default: { name: 'AlertDialog' } }))

import KryptPadAPI from '@/krypt-pad-api'
import { SettingsManager } from '@/app-settings'
import { Profile, Category, Item } from '@/krypt-pad-profile'
import { KryptPadError, KryptPadErrorCodes } from '../common/error-utils'

describe('KryptPadAPI', () => {
    let api: KryptPadAPI
    const settings = new SettingsManager()

    beforeEach(() => {
        vi.clearAllMocks()
        api = new KryptPadAPI({
            appSettings: settings,
            router: { push: vi.fn() } as any,
            route: {} as any
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('constructor', () => {
        it('initializes default state', () => {
            expect(api.fileOpened.value).toBe(false)
            expect(api.fileName.value).toBeUndefined()
            expect(api.profile.value).toBeNull()
            expect(api.saving.value).toBe(false)
        })
    })

    describe('redirectToStartWhenNoProfile', () => {
        it('redirects to start when there is no profile', () => {
            const push = vi.fn()
            api.router = { push } as any
            api.redirectToStartWhenNoProfile()
            expect(push).toHaveBeenCalledWith({ name: 'start' })
        })

        it('does not redirect when a profile exists', () => {
            const push = vi.fn()
            api.router = { push } as any
            api.profile.value = new Profile()
            api.redirectToStartWhenNoProfile()
            expect(push).not.toHaveBeenCalled()
        })
    })

    describe('commitProfileAsync', () => {
        it('saves the profile via saveProfile', async () => {
            api.fileName.value = 'vault.kpf'
            const profile = new Profile()
            const category = new Category('cat-1')
            category.name = 'General'
            profile.categories.push(category)
            api.profile.value = profile

            const plainText = await profile.toJSON()
            await api.commitProfileAsync()

            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledWith('vault.kpf', plainText)
            expect(api.saving.value).toBe(false)
        })

        it('does nothing when there is no file name', async () => {
            api.profile.value = new Profile()
            await api.commitProfileAsync()
            expect(ipcBridgeMock.saveProfile).not.toHaveBeenCalled()
        })

        it('shows an alert when saving fails', async () => {
            const alertError = vi.fn()
            api.alertDialog = { error: alertError } as any
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(new Error('disk full'))

            await api.commitProfileAsync()

            expect(alertError).toHaveBeenCalledWith('disk full')
            expect(api.saving.value).toBe(false)
        })

        it('keeps the edits pending when a save fails so the next flush retries', async () => {
            api.alertDialog = { error: vi.fn() } as any
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(new Error('disk full'))

            api.scheduleCommit()
            await api.flushPendingCommit()
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)

            // The failed write left the edits unsaved, so closing the file must
            // try again rather than discard them.
            await api.flushPendingCommit()
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(2)
        })
    })

    describe('scheduleCommit', () => {
        it('debounces commits with a 750ms timer', async () => {
            vi.useFakeTimers()
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()

            api.scheduleCommit()
            api.scheduleCommit()

            expect(ipcBridgeMock.saveProfile).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(750)

            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
        })
    })

    describe('flushPendingCommit', () => {
        it('flushes a pending commit immediately', async () => {
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()

            api.scheduleCommit()
            await api.flushPendingCommit()

            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
        })
    })

    describe('closeFile', () => {
        it('locks the profile and resets state', async () => {
            const push = vi.fn()
            api.router = { push } as any
            api.fileOpened.value = true
            api.profile.value = new Profile()

            await api.closeFile()

            expect(ipcBridgeMock.lockProfile).toHaveBeenCalled()
            expect(api.profile.value).toBeNull()
            expect(api.fileOpened.value).toBe(false)
            expect(push).toHaveBeenCalledWith({ name: 'start' })
        })
    })

    describe('deleteCategory', () => {
        it('deletes a category and clears matching item category ids when confirmed', async () => {
            const profile = new Profile()
            const category = new Category('cat-1')
            category.name = 'Banking'
            profile.categories.push(category)

            const item1 = new Item('item-1')
            item1.categoryId = 'cat-1'
            profile.items.push(item1)

            const item2 = new Item('item-2')
            item2.categoryId = 'other'
            profile.items.push(item2)

            api.profile.value = profile
            const confirm = vi.fn().mockResolvedValue(true)
            api.confirmDialog = { confirm } as any

            await api.deleteCategory(category)

            expect(profile.categories).toHaveLength(0)
            expect(item1.categoryId).toBeUndefined()
            expect(item2.categoryId).toBe('other')
            expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete this category?')
        })

        it('does not delete when the user cancels', async () => {
            const profile = new Profile()
            const category = new Category('cat-1')
            profile.categories.push(category)
            api.profile.value = profile
            api.confirmDialog = { confirm: vi.fn().mockResolvedValue(false) } as any

            await api.deleteCategory(category)

            expect(profile.categories).toHaveLength(1)
        })

        it('does nothing when there is no profile', async () => {
            const confirm = vi.fn()
            api.confirmDialog = { confirm } as any
            await api.deleteCategory(new Category('cat-1'))
            expect(confirm).not.toHaveBeenCalled()
        })
    })

    describe('openExistingFileAsync', () => {
        it('opens an existing file', async () => {
            const push = vi.fn()
            api.router = { push } as any
            api.onRequirePassphrase(vi.fn().mockResolvedValue('secret'))

            ipcBridgeMock.showOpenFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePaths: ['/data/vault.kpf']
            })
            const json = JSON.stringify({ categories: [], items: [] })
            ipcBridgeMock.openProfile.mockResolvedValueOnce(json)

            await api.openExistingFileAsync()

            expect(api.fileName.value).toBe('/data/vault.kpf')
            expect(api.fileOpened.value).toBe(true)
            expect(api.profile.value).not.toBeNull()
            expect(ipcBridgeMock.openProfile).toHaveBeenCalledWith('/data/vault.kpf', 'secret')
            expect(ipcBridgeMock.saveConfigFile).toHaveBeenCalled()
            expect(push).toHaveBeenCalledWith({ name: 'home' })
        })

        it('does nothing when the open dialog is canceled', async () => {
            ipcBridgeMock.showOpenFileDialogAsync.mockResolvedValueOnce({ canceled: true, filePaths: [] })
            await api.openExistingFileAsync()
            expect(ipcBridgeMock.openProfile).not.toHaveBeenCalled()
        })

        it('retries up to 3 times on decrypt errors', async () => {
            const push = vi.fn()
            api.router = { push } as any
            api.onRequirePassphrase(vi.fn().mockResolvedValue('secret'))

            ipcBridgeMock.showOpenFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePaths: ['/data/vault.kpf']
            })
            const json = JSON.stringify({ categories: [], items: [] })
            ipcBridgeMock.openProfile
                .mockRejectedValueOnce(new KryptPadError('bad pass', KryptPadErrorCodes.DECRYPT_ERROR))
                .mockRejectedValueOnce(new KryptPadError('bad pass', KryptPadErrorCodes.DECRYPT_ERROR))
                .mockResolvedValueOnce(json)

            await api.openExistingFileAsync()

            expect(ipcBridgeMock.openProfile).toHaveBeenCalledTimes(3)
            expect(api.fileOpened.value).toBe(true)
        })
    })

    describe('createNewFileAsync', () => {
        it('creates a new file', async () => {
            const push = vi.fn()
            api.router = { push } as any
            api.onRequirePassphrase(vi.fn().mockResolvedValue('newpass'))

            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePath: '/data/new.kpf'
            })

            await api.createNewFileAsync()

            expect(api.fileName.value).toBe('/data/new.kpf')
            expect(api.fileOpened.value).toBe(true)
            expect(api.profile.value).not.toBeNull()
            expect(ipcBridgeMock.setSessionPassphrase).toHaveBeenCalledWith('newpass')
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalled()
            expect(push).toHaveBeenCalledWith({ name: 'home' })
        })

        it('does nothing when the save dialog is canceled', async () => {
            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({ canceled: true, filePath: '' })
            await api.createNewFileAsync()
            expect(api.fileOpened.value).toBe(false)
            expect(ipcBridgeMock.setSessionPassphrase).not.toHaveBeenCalled()
        })

        it('does not adopt the new file when the passphrase prompt is canceled', async () => {
            api.onRequirePassphrase(vi.fn().mockResolvedValue(undefined))
            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePath: '/data/new.kpf'
            })

            await expect(api.createNewFileAsync()).resolves.toBeUndefined()

            expect(api.fileName.value).toBeUndefined()
            expect(api.fileOpened.value).toBe(false)
            expect(ipcBridgeMock.setSessionPassphrase).not.toHaveBeenCalled()
        })
    })

    describe('saveProfileAsAsync', () => {
        it('saves the profile as a new file', async () => {
            api.fileName.value = 'old.kpf'
            api.profile.value = new Profile()
            api.onRequirePassphrase(vi.fn().mockResolvedValue('pass'))

            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePath: '/data/new.kpf'
            })

            await api.saveProfileAsAsync()

            expect(api.fileName.value).toBe('/data/new.kpf')
            expect(ipcBridgeMock.setSessionPassphrase).toHaveBeenCalledWith('pass')
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalled()
        })

        it('keeps saving to the original file when the passphrase prompt is canceled', async () => {
            api.fileName.value = 'old.kpf'
            api.profile.value = new Profile()
            api.onRequirePassphrase(vi.fn().mockResolvedValue(undefined))

            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePath: '/data/new.kpf'
            })

            await api.saveProfileAsAsync()

            expect(api.fileName.value).toBe('old.kpf')
            expect(ipcBridgeMock.setSessionPassphrase).not.toHaveBeenCalled()
            expect(ipcBridgeMock.saveProfile).not.toHaveBeenCalled()
        })
    })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock state so the mock factory can reference it.
const { ipcBridgeMock } = vi.hoisted(() => ({
    ipcBridgeMock: {
        openProfile: vi.fn(),
        saveProfile: vi.fn(),
        reloadProfile: vi.fn(),
        saveConflictCopy: vi.fn(),
        addAttachments: vi.fn(),
        saveAttachmentAs: vi.fn(),
        copyAttachments: vi.fn(),
        compactAttachments: vi.fn(),
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
import { Profile, Category, Item, Attachment } from '@/krypt-pad-profile'
import { KryptPadError, KryptPadErrorCodes } from '../common/error-utils'

const ATTACHMENT_ID = '11111111-2222-4333-8444-555555555555'

const vaultChangedError = () => new KryptPadError('The vault was changed by someone else.', KryptPadErrorCodes.VAULT_CHANGED)

/**
 * Lets queued promise callbacks, such as a conflict being resolved outside
 * the save chain, run to completion.
 */
const settle = async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve()
    }
}

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

            await api.commitProfileAsync()

            // The category is new, so it is stamped as modified before saving
            expect(category.modified).toBeDefined()
            const plainText = await profile.toJSON()
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledWith('vault.kpf', plainText, { hasAttachments: false })
            expect(api.saving.value).toBe(false)
        })

        it('marks the file as having attachments when an item has one', async () => {
            api.fileName.value = 'vault.kpf'
            const profile = new Profile()
            const item = new Item('item-1')
            item.attachments.push(new Attachment(ATTACHMENT_ID, 'a.txt', 1, 'key'))
            profile.items.push(item)
            api.profile.value = profile

            await api.commitProfileAsync()

            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledWith('vault.kpf', expect.any(String), { hasAttachments: true })
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

        it('saves the profile after deleting', async () => {
            api.fileName.value = 'vault.kpf'
            const profile = new Profile()
            const category = new Category('cat-1')
            profile.categories.push(category)
            api.profile.value = profile
            api.confirmDialog = { confirm: vi.fn().mockResolvedValue(true) } as any

            await api.deleteCategory(category)

            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
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

        it('stops asking for the passphrase when the file itself is invalid', async () => {
            const requirePassphrase = vi.fn().mockResolvedValue('secret')
            api.onRequirePassphrase(requirePassphrase)
            api.alertDialog = { error: vi.fn() } as any

            ipcBridgeMock.showOpenFileDialogAsync.mockResolvedValueOnce({
                canceled: false,
                filePaths: ['/data/not-a-vault.kpf']
            })
            ipcBridgeMock.openProfile.mockRejectedValueOnce(
                new KryptPadError('The file format is invalid or unsupported.', KryptPadErrorCodes.INVALID_FILE)
            )

            await api.openExistingFileAsync()

            expect(requirePassphrase).toHaveBeenCalledTimes(1)
            expect(ipcBridgeMock.openProfile).toHaveBeenCalledTimes(1)
            expect(api.fileOpened.value).toBe(false)
            expect(api.fileName.value).toBeUndefined()
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

        it('copies attachments to the new vault', async () => {
            api.fileName.value = 'old.kpf'
            const profile = new Profile()
            const item = new Item('item-1')
            item.attachments.push(new Attachment(ATTACHMENT_ID, 'a.txt', 1, 'key'))
            profile.items.push(item)
            api.profile.value = profile
            api.onRequirePassphrase(vi.fn().mockResolvedValue('pass'))
            ipcBridgeMock.copyAttachments.mockResolvedValueOnce([])
            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({ canceled: false, filePath: '/data/new.kpf' })

            await api.saveProfileAsAsync()

            expect(ipcBridgeMock.copyAttachments).toHaveBeenCalledWith('old.kpf', '/data/new.kpf', [ATTACHMENT_ID])
        })
    })

    describe('unchanged profiles', () => {
        it('does not write a just-opened profile back when nothing changed', async () => {
            const json = JSON.stringify({ categories: [{ id: 'cat-1', name: 'General' }], items: [] })
            api.onRequirePassphrase(vi.fn().mockResolvedValue('secret'))
            ipcBridgeMock.showOpenFileDialogAsync.mockResolvedValueOnce({ canceled: false, filePaths: ['/data/vault.kpf'] })
            ipcBridgeMock.openProfile.mockResolvedValueOnce(json)
            await api.openExistingFileAsync()

            await api.commitProfileAsync()
            expect(ipcBridgeMock.saveProfile).not.toHaveBeenCalled()

            api.profile.value!.categories[0].name = 'Renamed'
            await api.commitProfileAsync()
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
            expect(api.profile.value!.categories[0].modified).toBeDefined()
        })
    })

    describe('conflicts', () => {
        let resolveConflict: ReturnType<typeof vi.fn>

        beforeEach(() => {
            resolveConflict = vi.fn().mockResolvedValue(null)
            api.conflictDialog = { resolve: resolveConflict, dismiss: vi.fn() } as any
            api.alertDialog = { error: vi.fn() } as any
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()
        })

        it('pauses autosave and asks the user when the vault was changed elsewhere', async () => {
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(vaultChangedError())

            await api.commitProfileAsync()
            await settle()

            expect(api.conflictPending.value).toBe(true)
            expect(resolveConflict).toHaveBeenCalledTimes(1)
            // A conflict is not reported as an ordinary save error
            expect(api.alertDialog!.error).not.toHaveBeenCalled()

            // Further saves are held back until the user decides
            await api.commitProfileAsync()
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
        })

        it('treats a missing vault file as a conflict', async () => {
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(new KryptPadError('gone', KryptPadErrorCodes.VAULT_MISSING))

            await api.commitProfileAsync()
            await settle()

            expect(api.conflictPending.value).toBe(true)
        })

        it('overwrites the vault when the user keeps their changes', async () => {
            resolveConflict.mockResolvedValueOnce('keep-mine')
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(vaultChangedError())

            await api.commitProfileAsync()
            await settle()
            await api.flushPendingCommit()

            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(2)
            expect(ipcBridgeMock.saveProfile.mock.calls[1][2]).toEqual({ hasAttachments: false, force: true })
            expect(api.conflictPending.value).toBe(false)
        })

        it('replaces the profile with the vault on disk when the user reloads', async () => {
            resolveConflict.mockResolvedValueOnce('reload')
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(vaultChangedError())
            ipcBridgeMock.reloadProfile.mockResolvedValueOnce(JSON.stringify({ categories: [{ id: 'c', name: 'From desktop' }], items: [] }))

            await api.commitProfileAsync()
            await settle()

            expect(ipcBridgeMock.reloadProfile).toHaveBeenCalledWith('vault.kpf')
            expect(api.profile.value!.categories[0].name).toBe('From desktop')
            expect(api.conflictPending.value).toBe(false)

            // The reloaded profile is not written straight back
            await api.flushPendingCommit()
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
        })

        it('asks for the passphrase when the vault was re-keyed elsewhere', async () => {
            api.onRequirePassphrase(vi.fn().mockResolvedValue('new passphrase'))
            ipcBridgeMock.reloadProfile.mockRejectedValueOnce(new KryptPadError('wrong', KryptPadErrorCodes.DECRYPT_ERROR))
            ipcBridgeMock.openProfile.mockResolvedValueOnce(JSON.stringify({ categories: [], items: [] }))

            await expect(api.reloadFromVaultAsync()).resolves.toBe(true)

            expect(ipcBridgeMock.openProfile).toHaveBeenCalledWith('vault.kpf', 'new passphrase')
        })

        it('saves to a new vault with the same passphrase when the user picks Save As', async () => {
            resolveConflict.mockResolvedValueOnce('save-as')
            const requirePassphrase = vi.fn()
            api.onRequirePassphrase(requirePassphrase)
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(vaultChangedError())
            ipcBridgeMock.showSaveFileDialogAsync.mockResolvedValueOnce({ canceled: false, filePath: '/data/mine.kpf' })

            await api.commitProfileAsync()
            await settle()
            await api.flushPendingCommit()

            expect(requirePassphrase).not.toHaveBeenCalled()
            expect(ipcBridgeMock.setSessionPassphrase).not.toHaveBeenCalled()
            expect(api.fileName.value).toBe('/data/mine.kpf')
            expect(ipcBridgeMock.saveProfile).toHaveBeenLastCalledWith('/data/mine.kpf', expect.any(String), { hasAttachments: false })
            expect(api.conflictPending.value).toBe(false)
        })

        it('writes unsaved edits to a conflicted copy when closing during a conflict', async () => {
            api.notifier = { notify: vi.fn() }
            ipcBridgeMock.saveProfile.mockRejectedValueOnce(vaultChangedError())
            ipcBridgeMock.saveConflictCopy.mockResolvedValueOnce('/data/vault (conflicted copy).kpf')

            await api.commitProfileAsync()
            await settle()
            await api.closeFile()

            expect(ipcBridgeMock.saveConflictCopy).toHaveBeenCalledWith('vault.kpf', expect.any(String), [])
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledTimes(1)
            expect(api.notifier.notify).toHaveBeenCalled()
            expect(api.conflictDialog!.dismiss).toHaveBeenCalled()
        })
    })

    describe('handleVaultChangedExternallyAsync', () => {
        beforeEach(() => {
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()
            api.notifier = { notify: vi.fn() }
        })

        it('reloads quietly when there are no unsaved edits', async () => {
            ipcBridgeMock.reloadProfile.mockResolvedValueOnce(JSON.stringify({ categories: [{ id: 'c', name: 'New' }], items: [] }))

            await api.handleVaultChangedExternallyAsync()

            expect(api.profile.value!.categories[0].name).toBe('New')
            expect(api.notifier!.notify).toHaveBeenCalled()
            expect(api.conflictPending.value).toBe(false)
        })

        it('asks the user instead when there are unsaved edits', async () => {
            vi.useFakeTimers()
            const resolveConflict = vi.fn().mockResolvedValue(null)
            api.conflictDialog = { resolve: resolveConflict, dismiss: vi.fn() } as any

            api.scheduleCommit()
            await api.handleVaultChangedExternallyAsync()

            expect(ipcBridgeMock.reloadProfile).not.toHaveBeenCalled()
            expect(api.conflictPending.value).toBe(true)
            expect(resolveConflict).toHaveBeenCalled()
        })
    })

    describe('attachments', () => {
        beforeEach(() => {
            api.fileName.value = 'vault.kpf'
            api.profile.value = new Profile()
            api.alertDialog = { error: vi.fn() } as any
        })

        it('adds the attachments the main process encrypted and saves', async () => {
            const item = new Item('item-1')
            api.profile.value!.items.push(item)
            ipcBridgeMock.addAttachments.mockResolvedValueOnce({
                attachments: [{ id: ATTACHMENT_ID, name: 'a.txt', size: 5, key: 'a2V5', added: '2026-01-01T00:00:00.000Z' }],
                errors: []
            })

            await api.addAttachmentsAsync(item)

            expect(item.attachments).toHaveLength(1)
            expect(item.attachments[0].name).toBe('a.txt')
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalledWith('vault.kpf', expect.any(String), { hasAttachments: true })
        })

        it('reports files that could not be attached', async () => {
            const item = new Item('item-1')
            ipcBridgeMock.addAttachments.mockResolvedValueOnce({ attachments: [], errors: ['big.iso: The file is too large to attach.'] })

            await api.addAttachmentsAsync(item)

            expect(api.alertDialog!.error).toHaveBeenCalled()
            expect(ipcBridgeMock.saveProfile).not.toHaveBeenCalled()
        })

        it('removes an attachment reference and saves', async () => {
            const item = new Item('item-1')
            const attachment = new Attachment(ATTACHMENT_ID, 'a.txt', 1, 'key')
            item.attachments.push(attachment)
            api.profile.value!.items.push(item)

            await api.removeAttachmentAsync(item, attachment)

            expect(item.attachments).toHaveLength(0)
            expect(ipcBridgeMock.saveProfile).toHaveBeenCalled()
        })
    })
})

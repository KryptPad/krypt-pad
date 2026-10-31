import { reactive, ref } from 'vue'
import { IPCBridge } from '@/bridge'
import { Attachment, Category, Item, Profile } from './krypt-pad-profile'
import { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { KryptPadError, KryptPadErrorCodes, getExceptionMessage } from '../common/error-utils'
import { ensureExtension, getDirectoryFromFilePath, getFileName } from './utils'
import { SettingsManager } from './app-settings'
import { IAPISettings, IConfirmDialog, IAlertDialog, IConflictDialog, INotifier, ISaveProfileOptions } from './interfaces'

const CONFLICT_MESSAGE =
    'This vault was changed somewhere else, possibly on another device, since you opened it. Your latest changes have not been saved yet.'

class KryptPadAPI {
    private appSettings: SettingsManager
    fileOpened = ref(false)
    fileName = ref<string | undefined>()
    profile = ref<Profile | null>(null)
    router: Router | null = null
    route: RouteLocationNormalizedLoaded | null = null
    confirmDialog?: IConfirmDialog
    alertDialog?: IAlertDialog
    conflictDialog?: IConflictDialog
    notifier?: INotifier
    saving = ref(false)
    ipcBridge = new IPCBridge()

    /**
     * Set when the vault was changed elsewhere and this session's edits have
     * not been saved. Autosave is paused until the user resolves it.
     */
    conflictPending = ref(false)

    /**
     * Whether the conflict dialog is currently waiting on the user
     */
    private _resolvingConflict = false

    /**
     * Item and category content as of the last load or save, used to stamp
     * modified times on whatever changed
     */
    private _snapshot = new Map<string, string>()

    /**
     * The profile JSON as last loaded from or written to a file. A commit with
     * nothing new is skipped, so reloading another device's changes never
     * writes them straight back and sets the two devices reloading each other.
     */
    private _lastPersisted: { fileName: string; json: string } | null = null

    /**
     * Timeout id for the debounced autosave, used by field editors
     */
    private _commitTimer: ReturnType<typeof setTimeout> | undefined

    /**
     * Promise chain that serializes profile saves so they never overlap
     */
    private _commitChain: Promise<void> = Promise.resolve()

    /**
     * Whether there are unsaved edits that still need to be written
     */
    private _needsAutoSave = false

    /**
     * Callback to prompt for passphrase
     */
    private _requirePassphraseCallback: Function | null = null

    /**
     * Callback to reset the timeout
     */
    private _resetTimeoutCallback: Function | null = null

    /**
     * @param {IAPISettings} apiSettings
     */
    constructor(apiSettings: IAPISettings) {
        this.appSettings = apiSettings.appSettings
        this.router = apiSettings.router
        this.route = apiSettings.route
        this.confirmDialog = apiSettings.confirmDialog
        this.alertDialog = apiSettings.alertDialog
        this.conflictDialog = apiSettings.conflictDialog
        this.notifier = apiSettings.notifier
    }

    /**
     * Makes a freshly loaded or created profile the open one
     * @param {Profile} profile
     * @param {string} json The profile's JSON when it was loaded from the open file
     */
    private _adoptProfile(profile: Profile, json?: string) {
        this._lastPersisted = json && this.fileName.value ? { fileName: this.fileName.value, json } : null
        this.profile.value = reactive(profile)
        this._snapshot = profile.snapshot()
    }

    /**
     * Loads profile data read from the open file and makes it the open profile
     * @param {string} data The decrypted profile JSON
     */
    private async _adoptLoadedProfileAsync(data: string) {
        const profile = await Profile.from(data)
        this._adoptProfile(profile, await profile.toJSON())
    }

    /**
     * Registers a callback that will open a prompt for the user to enter his/her passphrase.
     * @param {Function} callback
     */
    onRequirePassphrase(callback: Function) {
        this._requirePassphraseCallback = callback
    }

    /**
     * Registers a callback that will reset the timeout
     * @param {Function} callback
     */
    onResetTimeout(callback: Function) {
        this._resetTimeoutCallback = callback
    }

    /**
     * Redirects to the Start page when there is no profile
     */
    redirectToStartWhenNoProfile() {
        if (!this.profile.value) {
            console.log('Redirecting to start page')
            // Go to start page
            this.router?.push({ name: 'start' })
        }
    }

    /**
     * Opens an existing file
     */
    openExistingFileAsync = async () => {
        // Show the open file dialog
        const selectedFile = await this.ipcBridge.showOpenFileDialogAsync(this.appSettings.lastWorkingDirectory)
        if (selectedFile.canceled) {
            return
        }

        console.info(`Loaded file(s): `, selectedFile)

        // Close open file
        await this.closeFile()

        // Set new filename
        this.fileName.value = ensureExtension(selectedFile.filePaths[0], 'kpf')

        // Update the last working directory in the app settings
        this.appSettings.lastWorkingDirectory = getDirectoryFromFilePath(selectedFile.filePaths[0])
        this.ipcBridge.saveConfigFile(this.appSettings)

        let attempts = 0

        while (attempts < 3) {
            // Prompt for passphrase to decrypt the file
            const passphrase = await this._requirePassphraseCallback?.(false)
            if (!passphrase || !this.fileName.value) {
                break
            }

            try {
                // Read the file and get the data
                const data = await this.ipcBridge.openProfile(this.fileName.value, passphrase)
                if (data) {
                    // Load the profile
                    await this._adoptLoadedProfileAsync(data)

                    // Set fileOpen flag
                    this.fileOpened.value = true

                    this.router?.push({ name: 'home' })

                    break
                }
            } catch (ex) {
                const err = getExceptionMessage(ex)
                console.error(err, ex)

                // Display alert
                await this.alertDialog?.error(err)

                // Check if this is a decryption error. If so, increase attempt count.
                if (ex instanceof KryptPadError && ex.code === KryptPadErrorCodes.DECRYPT_ERROR) {
                    attempts++
                } else {
                    // This is not a decryption attempt error, break now.
                    break
                }
            }
        }

        // Don't leave the title bar naming a file that never opened
        if (!this.fileOpened.value) {
            this.fileName.value = undefined
        }
    }

    /**
     * Create a new file
     */
    createNewFileAsync = async () => {
        // TODO: If there is already a file open, prompt the user if they are sure they want to create a new file

        // Open save dialog to allow user to save a new file
        const selectedFile = await this.ipcBridge.showSaveFileDialogAsync(this.appSettings.lastWorkingDirectory)
        if (selectedFile.canceled || !selectedFile.filePath) {
            return
        }

        console.info(`Saved file(s): `, selectedFile)

        // Close open file
        await this.closeFile()

        // Prompt for new passphrase before adopting the new file.
        const passphrase = await this._requirePassphraseCallback?.(true)
        if (!passphrase) {
            return
        }

        await this.ipcBridge.setSessionPassphrase(passphrase)

        // Set new filename
        this.fileName.value = ensureExtension(selectedFile.filePath, 'kpf')

        // Update the last working directory in the app settings
        this.appSettings.lastWorkingDirectory = getDirectoryFromFilePath(selectedFile.filePath)
        this.ipcBridge.saveConfigFile(this.appSettings)

        // Set fileOpen flag
        this.fileOpened.value = true
        // Create new profile object
        this._adoptProfile(new Profile())

        // Commit the file once after creation
        await this.commitProfileAsync()

        this.router?.push({ name: 'home' })
    }

    /**
     * Saves the existing open profile as a new file
     * @param options keepPassphrase saves the new file with the current
     * passphrase instead of asking for a new one
     * @returns Whether the profile was saved to a new file
     */
    saveProfileAsAsync = async (options?: { keepPassphrase?: boolean }): Promise<boolean> => {
        // Open save dialog to allow user to save a new file
        const selectedFile = await this.ipcBridge.showSaveFileDialogAsync(this.appSettings.lastWorkingDirectory)
        if (selectedFile.canceled || !selectedFile.filePath) {
            return false
        }

        // Prompt for new passphrase before switching to the new file.
        let passphrase: string | undefined
        if (!options?.keepPassphrase) {
            passphrase = await this._requirePassphraseCallback?.(true)
            if (!passphrase) {
                return false
            }
        }

        // Write outstanding edits to the original file under its own passphrase
        // before the session switches to the new file and passphrase. When the
        // original was changed elsewhere, the edits go to the new file instead.
        if (!this.conflictPending.value) {
            await this.flushPendingCommit()
        }

        if (passphrase) {
            await this.ipcBridge.setSessionPassphrase(passphrase)
        }

        // Set new filename
        const previousFileName = this.fileName.value
        this.fileName.value = ensureExtension(selectedFile.filePath, 'kpf')

        // Update the last working directory in the app settings
        this.appSettings.lastWorkingDirectory = getDirectoryFromFilePath(selectedFile.filePath)
        this.ipcBridge.saveConfigFile(this.appSettings)

        // Bring the attachments along. Their keys are in the profile, so the
        // encrypted files work as they are under any passphrase.
        const attachmentIds = this.profile.value?.getAttachmentIds() ?? []
        if (previousFileName && attachmentIds.length) {
            try {
                const missing = await this.ipcBridge.copyAttachments(previousFileName, this.fileName.value, attachmentIds)
                if (missing.length) {
                    await this.alertDialog?.error(
                        `${missing.length} attachment(s) were not on this device and could not be copied. If the vault is synced, they may not have finished syncing.`
                    )
                }
            } catch (ex) {
                await this.alertDialog?.error(getExceptionMessage(ex))
            }
        }

        // The new file holds this session's edits, so there is nothing left to resolve
        this.conflictPending.value = false

        // Commit the file once after creation
        await this.commitProfileAsync()
        return true
    }

    /**
     * Closes the currently open file
     */
    closeFile = async () => {
        // Ensure any pending debounced autosave completes before discarding the profile
        await this.flushPendingCommit()
        void this.ipcBridge.lockProfile()
        this.profile.value = null
        this.fileName.value = undefined
        this.fileOpened.value = false
        this.conflictPending.value = false
        this.conflictDialog?.dismiss()
        this._snapshot = new Map()

        // Go to start page
        this.router?.push({ name: 'start' })
    }

    /**
     * Schedules a debounced save of the profile. Used by field editors to avoid
     * writing to disk on every keystroke while still persisting edits promptly.
     */
    scheduleCommit = () => {
        this._needsAutoSave = true

        // Autosave is paused until the conflict is resolved. If the user
        // dismissed the dialog, editing again brings it back.
        if (this.conflictPending.value) {
            void this.resolveConflictAsync()
            return
        }

        if (this._commitTimer) {
            clearTimeout(this._commitTimer)
        }
        this._commitTimer = setTimeout(() => {
            this._commitTimer = undefined
            void this.commitProfileAsync()
        }, 750)
    }

    /**
     * Ensures any pending debounced save completes before the profile is
     * discarded (e.g. when closing or locking). Any in-progress edits are
     * written to disk so nothing is lost.
     *
     * If the vault was changed elsewhere, the edits can't go into it without
     * the user deciding, and closing or locking can't wait on that. They are
     * written to a conflicted copy next to the vault instead.
     * @returns A promise that resolves once the profile is fully persisted
     */
    flushPendingCommit = async () => {
        if (this._commitTimer) {
            clearTimeout(this._commitTimer)
            this._commitTimer = undefined
        }

        // Wait for any already-running/queued save to settle first
        await this._commitChain

        if (this.conflictPending.value) {
            if (this._needsAutoSave) {
                await this._saveConflictCopyAsync()
            }
            return
        }

        // If edits were made after the last save started, persist them now
        if (this._needsAutoSave) {
            await this.commitProfileAsync()
        }
    }

    /**
     * Saves the profile data to a file. Saves are serialized so they never
     * overlap, and each save snapshots the freshest profile state.
     * @param options force overwrites the vault even if it was changed elsewhere
     */
    commitProfileAsync = async (options?: { force?: boolean }) => {
        this._commitChain = this._commitChain.then(() => this._doCommit(options)).catch(() => {})
        return this._commitChain
    }

    /**
     * Core save routine that performs the actual encryption and write.
     */
    private _doCommit = async (options?: { force?: boolean }): Promise<void> => {
        const fileName = this.fileName.value
        const profile = this.profile.value
        if (!fileName || !profile) {
            return
        }

        // Nothing is written while the user is deciding about a conflict,
        // unless they chose to overwrite
        if (this.conflictPending.value && !options?.force) {
            this._needsAutoSave = true
            return
        }

        // Cleared up front so edits made while this write is in flight mark the
        // profile dirty again and are picked up by the next commit.
        this._needsAutoSave = false
        this.saving.value = true
        // Keep the user session alive
        this._resetTimeoutCallback?.()

        try {
            this._snapshot = profile.stampModified(this._snapshot)
            const plainText = await profile.toJSON()
            if (!plainText) {
                throw new Error('Failed to convert profile to JSON')
            }

            // Nothing changed since this file was loaded or last written
            const unchanged = this._lastPersisted?.fileName === fileName && this._lastPersisted.json === plainText
            if (!unchanged || options?.force) {
                // Write a file containing the encrypted data
                const saveOptions: ISaveProfileOptions = { hasAttachments: profile.hasAttachments() }
                if (options?.force) {
                    saveOptions.force = true
                }
                await this.ipcBridge.saveProfile(fileName, plainText, saveOptions)
                this._lastPersisted = { fileName, json: plainText }
                console.info('Changes written to file.')
            }
            this.conflictPending.value = false
        } catch (ex) {
            // Nothing reached the disk, so the edits are still outstanding.
            // Without this they would be dropped by the flush on close.
            this._needsAutoSave = true

            if (isConflictError(ex)) {
                // Resolved outside the save chain, so the choices the user
                // makes can queue saves of their own
                this.conflictPending.value = true
                void this.resolveConflictAsync()
            } else {
                const err = getExceptionMessage(ex)
                console.error(err, ex)

                // Display alert
                await this.alertDialog?.error(err)
            }
        }

        this.saving.value = false
    }

    /**
     * Asks the user what to do about a vault that was changed elsewhere, then
     * carries out their choice. Does nothing if the dialog is already open.
     */
    resolveConflictAsync = async () => {
        if (this._resolvingConflict || !this.conflictPending.value || !this.conflictDialog) {
            return
        }

        this._resolvingConflict = true
        try {
            const choice = await this.conflictDialog.resolve(CONFLICT_MESSAGE)

            // The vault may have been closed while the dialog was open
            if (!this.profile.value || !this.conflictPending.value) {
                return
            }

            switch (choice) {
                case 'reload':
                    await this.reloadFromVaultAsync()
                    break
                case 'keep-mine':
                    await this.commitProfileAsync({ force: true })
                    break
                case 'save-as':
                    await this.saveProfileAsAsync({ keepPassphrase: true })
                    break
                default:
                    // Dismissed; the conflict stays pending and editing asks again
                    break
            }
        } finally {
            this._resolvingConflict = false
        }
    }

    /**
     * Replaces the open profile with the version on disk, discarding this
     * session's unsaved edits. If the vault was re-keyed elsewhere, e.g. its
     * passphrase was changed, the user is asked for the passphrase.
     * @returns Whether the vault was reloaded
     */
    reloadFromVaultAsync = async (): Promise<boolean> => {
        const fileName = this.fileName.value
        if (!fileName) {
            return false
        }

        // Let any save already in flight finish before swapping the profile
        await this._commitChain

        let data: string | undefined
        try {
            data = await this.ipcBridge.reloadProfile(fileName)
        } catch (ex) {
            if (!(ex instanceof KryptPadError && ex.code === KryptPadErrorCodes.DECRYPT_ERROR)) {
                await this.alertDialog?.error(getExceptionMessage(ex))
                return false
            }

            data = await this._reopenWithPassphraseAsync(fileName)
        }

        if (!data) {
            return false
        }

        if (this._commitTimer) {
            clearTimeout(this._commitTimer)
            this._commitTimer = undefined
        }
        this._needsAutoSave = false
        this.conflictPending.value = false
        await this._adoptLoadedProfileAsync(data)
        return true
    }

    /**
     * Asks for the passphrase and re-opens the current vault with it.
     * @returns The decrypted data, or undefined if the user gave up
     */
    private _reopenWithPassphraseAsync = async (fileName: string): Promise<string | undefined> => {
        for (let attempts = 0; attempts < 3; attempts++) {
            const passphrase = await this._requirePassphraseCallback?.(false)
            if (!passphrase) {
                return undefined
            }

            try {
                return await this.ipcBridge.openProfile(fileName, passphrase)
            } catch (ex) {
                await this.alertDialog?.error(getExceptionMessage(ex))
                if (!(ex instanceof KryptPadError && ex.code === KryptPadErrorCodes.DECRYPT_ERROR)) {
                    return undefined
                }
            }
        }

        return undefined
    }

    /**
     * Writes this session's edits to a conflicted copy next to the vault,
     * leaving the vault itself as the other device saved it.
     */
    private _saveConflictCopyAsync = async () => {
        const fileName = this.fileName.value
        const profile = this.profile.value
        if (!fileName || !profile) {
            return
        }

        try {
            this._snapshot = profile.stampModified(this._snapshot)
            const copyFileName = await this.ipcBridge.saveConflictCopy(fileName, await profile.toJSON(), profile.getAttachmentIds())
            this._needsAutoSave = false
            this.notifier?.notify(`The vault was changed on another device, so your unsaved changes were saved to ${getFileName(copyFileName)}.`)
        } catch (ex) {
            const err = getExceptionMessage(ex)
            console.error(err, ex)
            await this.alertDialog?.error(err)
        }
    }

    /**
     * Handles the vault being changed on disk by something other than this
     * session, such as a sync client bringing in another device's save. With
     * no unsaved edits it reloads quietly; otherwise the user decides.
     */
    handleVaultChangedExternallyAsync = async () => {
        if (!this.profile.value || !this.fileName.value || this.conflictPending.value) {
            return
        }

        if (this._needsAutoSave || this._commitTimer || this.saving.value) {
            this.conflictPending.value = true
            void this.resolveConflictAsync()
            return
        }

        try {
            const data = await this.ipcBridge.reloadProfile(this.fileName.value)
            // Edits may have started while the file was being read
            if (!data || this._needsAutoSave || this.conflictPending.value) {
                if (data && !this.conflictPending.value) {
                    this.conflictPending.value = true
                    void this.resolveConflictAsync()
                }
                return
            }

            await this._adoptLoadedProfileAsync(data)
            this.notifier?.notify('Updated with changes from another device.')
        } catch (ex) {
            if (ex instanceof KryptPadError && ex.code === KryptPadErrorCodes.DECRYPT_ERROR) {
                // Re-keyed elsewhere; reloading needs the passphrase, so let the user decide
                this.conflictPending.value = true
                void this.resolveConflictAsync()
            } else {
                // Often a sync client mid-write; the next change or save will catch it
                console.error(getExceptionMessage(ex), ex)
            }
        }
    }

    /**
     * Lets the user pick files and attaches them, encrypted, to an item
     * @param {Item} item The item to attach the files to
     */
    addAttachmentsAsync = async (item: Item) => {
        const fileName = this.fileName.value
        if (!fileName) {
            return
        }

        try {
            const result = await this.ipcBridge.addAttachments(fileName)
            if (!result) {
                return
            }

            for (const a of result.attachments) {
                item.attachments.push(new Attachment(a.id, a.name, a.size, a.key, a.added))
            }

            if (result.attachments.length) {
                await this.commitProfileAsync()
            }

            if (result.errors.length) {
                await this.alertDialog?.error(`Some files could not be attached:\n${result.errors.join('\n')}`)
            }
        } catch (ex) {
            await this.alertDialog?.error(getExceptionMessage(ex))
        }
    }

    /**
     * Decrypts an attachment to a location the user picks
     * @param {Attachment} attachment
     */
    saveAttachmentAsAsync = async (attachment: Attachment) => {
        const fileName = this.fileName.value
        if (!fileName) {
            return
        }

        try {
            await this.ipcBridge.saveAttachmentAs(fileName, { id: attachment.id, name: attachment.name, key: attachment.key })
        } catch (ex) {
            await this.alertDialog?.error(getExceptionMessage(ex))
        }
    }

    /**
     * Removes an attachment from an item. The encrypted file is left in place,
     * since another device may still reference it; Clean Up Attachments
     * removes old unused files.
     */
    removeAttachmentAsync = async (item: Item, attachment: Attachment) => {
        const index = item.attachments.findIndex((a) => a.id === attachment.id)
        if (index > -1) {
            item.attachments.splice(index, 1)
            await this.commitProfileAsync()
        }
    }

    /**
     * Removes old encrypted attachment files the open profile no longer references
     */
    compactAttachmentsAsync = async () => {
        const fileName = this.fileName.value
        if (!fileName || !this.profile.value) {
            return
        }

        try {
            const removed = await this.ipcBridge.compactAttachments(fileName, this.profile.value.getAttachmentIds())
            await this.alertDialog?.alert(
                removed ? `Removed ${removed} unused attachment file(s).` : 'There were no old unused attachment files to remove.',
                { title: 'Clean Up Attachments', icon: 'mdi-broom' }
            )
        } catch (ex) {
            await this.alertDialog?.error(getExceptionMessage(ex))
        }
    }

    /**
     * Deletes a category from the profile
     * @param {Category} category
     */
    deleteCategory = async (category: Category) => {
        if (!this.profile.value) {
            return
        }

        if (await this.confirmDialog?.confirm('Are you sure you want to delete this category?')) {
            // Remove the category; its items are left without a category
            if (this.profile.value.deleteCategory(category)) {
                // Persist the deletion, otherwise it reappears on the next open
                await this.commitProfileAsync()
            }
        }
    }
}

/**
 * Whether a save failed because the vault was changed or removed elsewhere
 */
function isConflictError(ex: unknown): boolean {
    return ex instanceof KryptPadError && (ex.code === KryptPadErrorCodes.VAULT_CHANGED || ex.code === KryptPadErrorCodes.VAULT_MISSING)
}

export default KryptPadAPI

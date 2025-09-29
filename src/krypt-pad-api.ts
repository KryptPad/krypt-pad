import { reactive, watch, ref, Ref } from 'vue'
import { IPCBridge } from '@/bridge'
import { Category, Profile } from './krypt-pad-profile'
import { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { KryptPadError, KryptPadErrorCodes, getExceptionMessage } from '../common/error-utils'

import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AlertDialog from '@/components/AlertDialog.vue'
import { ensureExtension } from './utils'

class KryptPadAPI {
    fileOpened = ref(false)
    fileName = ref<string | undefined>()
    profile = ref<Profile | null>(null)
    passphrase = ref<string | undefined>()
    router: Router | null = null
    route: RouteLocationNormalizedLoaded | null = null
    confirmDialog: Ref<InstanceType<typeof ConfirmDialog> | null> | null = null
    alertDialog?: Ref<InstanceType<typeof AlertDialog> | null>
    saving = ref(false)
    ipcBridge = new IPCBridge()

    /**
     * Callback to prompt for passphrase
     */
    private _requirePassphraseCallback: Function | null = null

    /**
     * Callback to reset the timeout
     */
    private _resetTimeoutCallback: Function | null = null

    /**
     *
     */
    constructor() {}

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
     * Encrypts the data using the passphrase
     * @param {string} data The data to encrypt
     * @returns
     */
    async encryptData(data: string): Promise<string | undefined> {
        if (!this.passphrase.value) {
            throw new Error('Passphrase is required to encrypt data.')
        }

        return await this.ipcBridge.encryptData(data, this.passphrase.value)
    }

    /**
     * Decrypts the data using the passphrase
     * @param {string} data The data to decrypt
     * @returns
     */
    async decryptData(data: string): Promise<string | undefined> {
        let attempts = 0
        while (attempts < 3) {
            // Prompt for passphrase to decrypt the file
            this.passphrase.value = await this._requirePassphraseCallback?.(false)
            if (!this.passphrase.value || !this.fileName.value) {
                break
            }

            try {
                // Decrypt the data
                return await this.ipcBridge.decryptData(data, this.passphrase.value)
            } catch (ex) {
                const err = getExceptionMessage(ex)
                console.error(err, ex)

                // Display alert
                await this.alertDialog?.value?.error(err)

                // Check if this is a decryption error. If so, increase attempt count.
                if (ex instanceof KryptPadError && ex.code === KryptPadErrorCodes.DECRYPT_ERROR) {
                    attempts++
                } else {
                    // This is not a decryption attempt error, break now.
                    break
                }
            }
        }
    }

    /**
     * Opens an existing file
     */
    openExistingFileAsync = async () => {
        // Show the open file dialog
        const selectedFile = await this.ipcBridge.showOpenFileDialogAsync()
        if (selectedFile.canceled) {
            return
        }

        console.info(`Loaded file(s): `, selectedFile)

        // Close open file
        this.closeFile()

        // Set new filename
        this.fileName.value = ensureExtension(selectedFile.filePaths[0], 'kpf')
        let attempts = 0

        while (attempts < 3) {
            // Prompt for passphrase to decrypt the file
            this.passphrase.value = await this._requirePassphraseCallback?.(false)
            if (!this.passphrase.value || !this.fileName.value) {
                break
            }

            try {
                // Read the file and get the data
                const data = await this.ipcBridge.readFile(this.fileName.value)
                if (data) {
                    // Load the profile
                    const p = await Profile.from(data, this.passphrase.value)
                    if (p) {
                        const rp = reactive(p)
                        this.profile.value = rp
                        this.watchProfile(this.profile.value)
                    }

                    // Set fileOpen flag
                    this.fileOpened.value = true

                    this.router?.push({ name: 'home' })

                    break
                }
            } catch (ex) {
                const err = getExceptionMessage(ex)
                console.error(err, ex)

                // Display alert
                await this.alertDialog?.value?.error(err)

                // Check if this is a decryption error. If so, increase attempt count.
                if (ex instanceof KryptPadError && ex.code === KryptPadErrorCodes.DECRYPT_ERROR) {
                    attempts++
                } else {
                    // This is not a decryption attempt error, break now.
                    break
                }
            }
        }
    }

    /**
     * Create a new file
     */
    createNewFileAsync = async () => {
        // TODO: If there is already a file open, prompt the user if they are sure they want to create a new file

        // Open save dialog to allow user to save a new file

        const selectedFile = await this.ipcBridge.showSaveFileDialogAsync()
        if (selectedFile.canceled || !selectedFile.filePath) {
            return
        }

        console.info(`Saved file(s): `, selectedFile)

        // Close open file
        this.closeFile()

        // Set new filename
        this.fileName.value = ensureExtension(selectedFile.filePath, 'kpf')

        // Prompt for new passphrase
        this.passphrase.value = await this._requirePassphraseCallback?.(true)
        if (!this.passphrase.value) {
            throw new Error('Passphrase is required to create a new profile.')
        }

        // Set fileOpen flag
        this.fileOpened.value = true
        // Create new profile object
        const p = reactive(new Profile())
        if (p) {
            const rp = reactive(p)
            this.profile.value = rp
            this.watchProfile(this.profile.value)
        }

        // Commit the file once after creation
        await this.commitProfileAsync()

        this.router?.push({ name: 'home' })
    }

    /**
     * Saves the existing open profile as a new file
     * @returns
     */
    saveProfileAsAsync = async () => {
        // Open save dialog to allow user to save a new file
        const selectedFile = await this.ipcBridge.showSaveFileDialogAsync()
        if (selectedFile.canceled || !selectedFile.filePath) {
            return
        }

        // Set new filename
        this.fileName.value = ensureExtension(selectedFile.filePath, 'kpf')

        // Prompt for new passphrase
        this.passphrase.value = await this._requirePassphraseCallback?.(true)

        // Commit the file once after creation
        await this.commitProfileAsync()
    }

    /**
     * Closes the currently open file
     */
    closeFile = () => {
        this.passphrase.value = undefined
        this.profile.value = null
        this.fileOpened.value = false

        // Go to start page
        this.router?.push({ name: 'start' })
    }

    /**
     * Saves the profile data to a file
     */
    commitProfileAsync = async () => {
        console.info(`Writing changes to file '${this.fileName.value}'`)

        // Encrypt the profile. But first, make sure we have a filename and a passphrase
        if (this.fileName.value && this.passphrase.value) {
            this.saving.value = true
            // Keep the user session alive
            this._resetTimeoutCallback?.()

            try {
                const plainText = await this.profile.value?.toJSON()
                if (!plainText) {
                    throw new Error('Failed to convert profile to JSON')
                }

                // Write a file containig the encrypted data
                await this.ipcBridge.writeFile(this.fileName.value, plainText)
                console.info('Changes written to file.')
            } catch (ex) {
                const err = getExceptionMessage(ex)
                console.error(err, ex)

                // Display alert
                await this.alertDialog?.value?.error(err)
            }

            this.saving.value = false
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

        if (await this.confirmDialog?.value?.confirm('Are you sure you want to delete this category?')) {
            // Remove category from list
            const index = this.profile.value.categories.indexOf(category)
            if (index > -1) {
                this.profile.value.categories.splice(index, 1)
                // Set all item category ids with matching category id to undefined
                const matchingItems = this.profile.value.items.filter((i) => i.categoryId === category.id)
                for (const item of matchingItems) {
                    item.categoryId = undefined
                }
            }
        }
    }

    /**
     * Watches a profile for any changes and then commits the changes automatically.
     * @param Profile The profile to watch
     */
    private watchProfile(profile: Profile) {
        watch(
            profile,
            async () => {
                // Commit the profile
                await this.commitProfileAsync()
            },
            { deep: true }
        )
    }
}

export default KryptPadAPI

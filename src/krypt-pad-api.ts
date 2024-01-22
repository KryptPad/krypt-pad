import { reactive, watch, ref } from 'vue';
import { bridge } from '@/bridge';
import { Category, Item, Profile } from './krypt-pad-profile';
import { decryptAsync, encryptAsync } from '@/krypto';
import { RouteLocationNormalizedLoaded, Router } from 'vue-router';

class KryptPadAPI {
    fileOpened = ref(false);
    fileName = ref<String | null>(null);
    profile = ref<Profile | null>(null);
    passphrase = ref<String | null>(null);
    router: Router | null = null;
    route: RouteLocationNormalizedLoaded | null = null;
    confirmDialog: any;
    // Callback for requiring passphrase
    private _requirePassphraseCallback: Function | null = null;

    /**
     *
     */
    constructor() {


    }

    /**
     * Registers a callback that will open a prompt for the user to enter his/her passphrase.
     * @param {Function} callback 
     */
    onRequirePassphrase(callback: Function) {
        this._requirePassphraseCallback = callback;
    }

    /**
     * Redirects to the Start page when there is no profile
     */
    redirectToStartWhenNoProfile() {

        if (!this.profile.value) {
            console.log('Redirecting to start page')
            // Go to start page
            this.router?.push({ name: "start" });
        }
    }

    /**
     * Opens an existing file
     */
    openExistingFileAsync = async () => {
        // Show the open file dialog
        const selectedFile = await bridge.showOpenFileDialogAsync();
        if (selectedFile.canceled) { return; }

        // Close open file
        this.closeFile();

        // Set new filename
        this.fileName.value = selectedFile.filePaths[0];

        // Read the file and get the data
        const encryptedJSONString = await bridge.readFileAsync(this.fileName.value);
        if (encryptedJSONString) {
            // Prompt for passphrase to decrypt the file
            this.passphrase.value = await this._requirePassphraseCallback?.(false);
            if (!this.passphrase.value) { return; }

            // Decrypt the json string
            const jsonString = await decryptAsync(encryptedJSONString, Buffer.from(this.passphrase.value, 'binary'));

            // Load the profile
            const p = Profile.from(jsonString);
            if (p) {
                const rp = reactive(p);
                this.profile.value = rp;
                this.watchProfile(this.profile.value);
            }

            // Set fileOpen flag
            this.fileOpened.value = true;

            this.router?.push({ name: "home" });
        }

    }

    /**
    * Create a new file
    */
    async createNewFileAsync() {
        // TODO: If there is already a file open, prompt the user if they are sure they want to create a new file

        // Open save dialog to allow user to save a new file
        const selectedFile = await bridge.showSaveFileDialogAsync();
        if (selectedFile.canceled) { return; }

        // Close open file
        this.closeFile();

        // Set new filename
        this.fileName.value = selectedFile.filePath;

        // Prompt for new passphrase
        this.passphrase = await this._requirePassphraseCallback?.(true);

        // Set fileOpen flag
        this.fileOpened.value = true;
        // Create new profile object
        const p = reactive(new Profile());
        if (p) {
            const rp = reactive(p);
            this.profile.value = rp;
            watchProfile(this.profile.value);
        }

        // Commit the file once after creation
        await this.commitProfileAsync();

        this.router?.push({ name: "home" });

    }

    /**
     * Saves the existing open profile as a new file
     * @returns 
     */
    async saveProfileAsAsync() {
        // Open save dialog to allow user to save a new file
        const selectedFile = await bridge.showSaveFileDialogAsync();
        if (selectedFile.canceled) { return; }

        // Set new filename
        this.fileName = selectedFile.filePath;

        // Prompt for new passphrase
        this.passphrase.value = await this._requirePassphraseCallback?.(true);

        // Commit the file once after creation
        await this.commitProfileAsync();

    }

    /**
     * Closes the currently open file
     */
    closeFile() {
        this.passphrase.value = null;
        this.profile.value = null;
        this.fileOpened.value = false;

        // Go to start page
        this.router?.push({ name: "start" });
    }

    /**
     * Encrypts the profile and commits it to a file
     */
    async commitProfileAsync() {
        console.log("writing file")
        // Encrypt the profile. But first, make sure we have a filename and a passphrase
        if (this.fileName.value && this.passphrase.value) {
            try {
                // Encrypt the data
                const cipherBuffer = await encryptAsync(JSON.stringify(this.profile.value), Buffer.from(this.passphrase.value, 'binary'));
                // Write a file containig the encrypted data
                await bridge.saveFileAsync(this.fileName, cipherBuffer);

            }
            catch (ex) {
                // TODO: Replace with something better
                alert(ex);
                throw ex;
            }

        }


    }

    /**
     * Deletes a category from the profile
     * @param {Category} category 
     */
    async deleteCategory(category: Category) {
        if (!this.profile.value) { return; }

        if (await this.confirmDialog?.confirm("Are you sure you want to delete this category?")) {
            // Remove category from list
            const index = this.profile.value.categories.indexOf(category);
            if (index > -1) {
                this.profile.value.categories.splice(index, 1);
                // Set all item category ids with matching category id to null
                const matchingItems = this.profile.value.items.filter((i) => i.categoryId === category.id);
                for (const item of matchingItems) {
                    item.categoryId = null;
                }
            }

        }
    }

    /**
     * Adds a new item to the profile
     * @param {String} categoryId 
     * @param {String} title
     */
    async addItemAsync(categoryId: String, title: String) {
        const item = new Item(null, categoryId, title);
        // Add the item to the global items list
        this.profile.value?.items.push(item);

        return item;
    }

    /**
     * Watches a profile for any changes and then commits the changes automatically.
     * @param Profile The profile to watch
     */
    watchProfile(profile: Profile) {
        watch(profile, async () => {
            // Commit the profile
            console.log("watcher fired")
            await this.commitProfileAsync();
        }, { deep: true });
    }
}

export default KryptPadAPI;
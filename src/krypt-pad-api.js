import { reactive } from 'vue';
import { bridge } from '@/bridge';
import { Profile } from './krypt-pad-profile';
import { decryptAsync, encryptAsync } from '@/krypto';

const kpAPI = reactive({
    fileOpened: false,
    fileName: null,
    profile: null,
    passphrase: null,
    router: null,
    confirmDialog: null,
    // Callback for requiring passphrase
    _requirePassphraseCallback: null,

    /**
     * Registers a callback that will open a prompt for the user to enter his/her passphrase.
     * @param {Function} callback 
     */
    onRequirePassphrase(callback) {
        kpAPI._requirePassphraseCallback = callback;
    },

    /**
     * Closes the currently open file
     */
    closeFile() {
        kpAPI.passphrase = null;
        kpAPI.profile = null;
        kpAPI.fileOpened = false;

        // Go to start page
        kpAPI.router?.push({ name: "start" });
    },

    /**
    * Create a new file
    */
    async createNewFileAsync() {
        // If there is already a file open, prompt the user if they are sure they want to create a new file

        // Open save dialog to allow user to save a new file
        const selectedFile = await bridge.showSaveFileDialogAsync();
        if (selectedFile.canceled) { return; }

        kpAPI.fileName = selectedFile.filePath;

        // Prompt for new passphrase
        await kpAPI._requirePassphraseCallback?.(true);

        // Set fileOpen flag
        kpAPI.fileOpened = true;
        // Create new profile object
        kpAPI.profile = new Profile();

        // Commit the file once after creation
        await kpAPI.commitProfile();

        kpAPI.router?.push({ name: "home" });

    },
    /**
     * Opens an existing file
     */
    async openExistingFileAsync() {
        // Show the open file dialog
        const selectedFile = await bridge.showOpenFileDialogAsync();
        if (selectedFile.canceled) { return; }

        kpAPI.fileName = selectedFile.filePaths[0];

        // Read the file and get the data
        const encryptedJSONString = await bridge.readFileAsync(kpAPI.fileName);
        if (encryptedJSONString) {
            // Prompt for new passphrase

            const passphrase = await kpAPI._requirePassphraseCallback?.(true);
            // Decrypt the json string
            const jsonString = await decryptAsync(encryptedJSONString, passphrase);

            // Load the profile
            kpAPI.profile = Profile.from(jsonString);
            console.log(kpAPI.profile)
            // Set fileOpen flag
            kpAPI.fileOpened = true;

            kpAPI.router?.push({ name: "home" });
        }

    },
    /**
     * Encrypts the profile and commits it to a file
     */
    async commitProfile() {
        console.log("writing file")
        // Encrypt the profile. But first, make sure we have a filename and a passphrase
        if (kpAPI.fileName && kpAPI.passphrase) {
            try {
                // Encrypt the data
                const cipherBuffer = await encryptAsync(JSON.stringify(kpAPI.profile), kpAPI.passphrase);
                // Write a file containig the encrypted data
                await bridge.saveFileAsync(kpAPI.fileName, cipherBuffer);

            }
            catch (ex) {
                // TODO: Replace with something better
                alert(ex);
                throw ex;
            }

        }


    },

    /**
     * Adds a category to the profile and commits the profile
     * @param {Category} category 
     * @returns 
     */
    async addCategory(category) {
        if (!category) { return; }
        // Add the category to the profile
        kpAPI.profile.categories.push(category);

        // Commit the profile
        await kpAPI.commitProfile();
    },

    async deleteCategory(category) {
        console.log("delete category")
        if (await kpAPI.confirmDialog?.confirm("Are you sure you want to delete this category? All items associated will be deleted")) {
            // Remove category from list
            const index = kpAPI.profile?.categories.indexOf(category);
            if (index > -1) {
                kpAPI.profile?.categories.splice(index, 1);
            }

            // Commit the profile
            await kpAPI.commitProfile();
        }
    }
});

export default kpAPI;
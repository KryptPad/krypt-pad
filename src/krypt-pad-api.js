import { reactive } from 'vue';
import { bridge } from '@/bridge';
import { Category, Profile } from './krypt-pad-format';
import { decrypt, encrypt } from '@/krypto';

const kpAPI = reactive({
    fileOpened: false,
    fileName: null,
    profile: null,
    passphrase: null,
    _requirePassphraseCallback: null,

    onRequirePassphrase(callback) {
        kpAPI._requirePassphraseCallback = callback;
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
        kpAPI.profile.categories.push(new Category("Banks"));
        // TEST CODE
        await kpAPI.commitProfile();

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
            
            const jsonString = decrypt(encryptedJSONString, passphrase);
            
            console.log(jsonString)
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
                const cipherBuffer = encrypt(JSON.stringify(kpAPI.profile), kpAPI.passphrase);
                // Write a file containig the encrypted data
                await bridge.saveFileAsync(kpAPI.fileName, cipherBuffer);

            }
            catch (ex) {
                // TODO: Replace with something better
                alert(ex);
                throw ex;
            }

        }


    }
});

export default kpAPI;
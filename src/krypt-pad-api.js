import { reactive } from 'vue';
import { bridge } from '@/bridge';
import { Category, Profile } from './krypt-pad-format';

const kpAPI = reactive({
    fileOpened: false,
    fileName: null,
    profile: null,

    _requirePassphraseCallback: null,

    onRequirePassphrase(callback){
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
        const passphrase = await kpAPI._requirePassphraseCallback?.(true);
        console.log(passphrase)
        // Set fileOpen flag
        kpAPI.fileOpened = true;
        // Create new profile object
        kpAPI.profile = new Profile();
        kpAPI.profile.categories.push(new Category("Banks"));

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

        console.log(encryptedJSONString)

    }
});

export default kpAPI;
import { ref } from 'vue';

/**
 * Settings state
 */
interface IAppSettings {
    lightMode: boolean;
    enableTimeout: boolean;
    timeoutInSeconds?: number;

}

/**
 * Manages the settings state throughout the app
 */
class SettingsManager {
    lightMode = ref<boolean>(false);
    enableTimeout = ref<boolean>(false);
    timeoutInSeconds = ref<number | undefined>();

    constructor(data?: IAppSettings) {

        this.lightMode.value = data?.lightMode ?? false;
        this.enableTimeout.value = data?.enableTimeout ?? false;
        this.timeoutInSeconds.value = data?.timeoutInSeconds;
    }

    /**
     * Converts the settings properties into a json string which can be persisted to storage
     * @returns A serialized string of app settings
     */
    public toString = (): string => {

        const data: IAppSettings = {
            lightMode: this.lightMode.value,
            enableTimeout: this.enableTimeout.value,
            timeoutInSeconds: this.timeoutInSeconds.value
        }

        return JSON.stringify(data);
    }

}

export { SettingsManager, type IAppSettings };
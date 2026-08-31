import { ref } from 'vue'

/**
 * Settings state
 */
interface IAppSettings {
    lightMode: boolean
    enableTimeout: boolean
    timeoutInSeconds?: number
    lastWorkingDirectory?: string
}

/**
 * Manages the settings state throughout the app
 */
class SettingsManager {
    lightMode = ref<boolean>(false)
    enableTimeout = ref<boolean>(false)
    timeoutInSeconds = ref<number | undefined>()
    lastWorkingDirectory?: string

    constructor(data?: IAppSettings) {
        this.lightMode.value = data?.lightMode ?? false
        this.enableTimeout.value = data?.enableTimeout ?? false
        this.timeoutInSeconds.value = data?.timeoutInSeconds
        this.lastWorkingDirectory = data?.lastWorkingDirectory
    }

    /**
     * Converts the settings properties into a json string which can be persisted to storage
     * @returns A serialized string of app settings
     */
    public toString = (): string => {
        const data: IAppSettings = {
            lightMode: this.lightMode.value,
            enableTimeout: this.enableTimeout.value,
            timeoutInSeconds: this.timeoutInSeconds.value,
            lastWorkingDirectory: this.lastWorkingDirectory
        }

        return JSON.stringify(data)
    }
}

export { SettingsManager, type IAppSettings }

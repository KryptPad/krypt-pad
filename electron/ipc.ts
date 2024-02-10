import { KryptPadError, KryptPadErrorCodes } from "../common/error-utils";

/**
 * For interprocess communication. Defines a general contract to pass data and errors between
 * the main and render processes.
 */
class IPCDataContract<T> {
    data?: T;
    error?: KryptPadError;

    constructor(data?: T, error?: KryptPadError) {
        this.data = data;
        this.error = error;
    }

    /**
     * Takes a response object from IPC and recreates the IPCDataContract class
     * @param obj deserialized response from IPC
     * @returns 
     */
    static load<T>(obj: IPCDataContract<T>): IPCDataContract<T> {

        let error: KryptPadError | undefined = undefined;

        if (obj.error) {
            error = Object.assign(new KryptPadError, obj.error);
        }

        return new IPCDataContract<T>(obj.data, error);
    }

}

export { IPCDataContract };
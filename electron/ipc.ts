import { DecryptionError } from "../common/error-utils";

/**
 * For interprocess communication. Defines a general contract to pass data and errors between
 * the main and render processes.
 */
interface IPCDataContract<T> {
    data?: T,
    error?: unknown,
    err?: DecryptionError
}

export {type IPCDataContract};
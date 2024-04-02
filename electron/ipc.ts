import { KryptPadError } from "../common/error-utils";

/**
 * For interprocess communication. Defines a general contract to pass data and errors between
 * the main and render processes.
 */
interface IPCData<T> {
    data?: T;
    error?: KryptPadError;
}

export { type IPCData };
/**
 * For interprocess communication. Defines a general contract to pass data and errors between
 * the main and render processes.
 */
interface IPCDataContract<T> {
    data?: T,
    error?: string | undefined
}

export {type IPCDataContract};
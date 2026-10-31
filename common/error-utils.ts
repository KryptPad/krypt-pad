/**
 * Krypt Pad error codes
 */
enum KryptPadErrorCodes {
    OK,
    GENERIC,
    /** The passphrase is wrong or the encrypted content was altered */
    DECRYPT_ERROR,
    /** The file is not a Krypt Pad file, is corrupted, or uses an unsupported format */
    INVALID_FILE,
    /** The vault was changed on disk (e.g. by another device) since this session last read or wrote it */
    VAULT_CHANGED,
    /** The vault file no longer exists where this session last read or wrote it */
    VAULT_MISSING,
    /** An attachment's encrypted file is not on this device, e.g. it has not finished syncing */
    ATTACHMENT_MISSING,
    /** A file is too large to add as an attachment */
    ATTACHMENT_TOO_LARGE

}

/**
 * Custom error class for Krypt Pad
 */
class KryptPadError {
    name: string;
    message: string;
    code: KryptPadErrorCodes

    constructor(message?: string, code?: KryptPadErrorCodes) {
        this.name = "KryptPadError";
        this.message = message ?? 'An unknown error occurred';
        this.code = code ?? KryptPadErrorCodes.GENERIC;
    }


    /**
     * Create an instance of a KryptPadError from an error or serialized KryptPadError
     * @param err Creates
     * @returns 
     */
    static fromError(err: KryptPadError | unknown): KryptPadError {

        if (err instanceof KryptPadError) {
            // Return itself. It is already a KryptPadError
            return err;

        }
        else if ((err as KryptPadError)?.name === 'KryptPadError') {
            return Object.assign(new KryptPadError, err);
        }
        else if (err instanceof Error) {
            return new KryptPadError(err.message, KryptPadErrorCodes.GENERIC);

        } else {
            return new KryptPadError("An unknown error occurred.");

        }

    }
}

/**
 * Takes an exception thrown and gets the message from it
 * @param ex the exception thrown
 * @returns 
 */
function getExceptionMessage(ex: unknown): string {
    let err: string;

    if (typeof ex === 'string') {
        err = ex;
    }
    else if (ex instanceof Error) {
        err = ex.message;
    }
    else if (ex instanceof KryptPadError) {
        err = ex.message;
    }
    else {
        err = 'An unknown error occurred.';
    }

    return err;
}

export { getExceptionMessage, KryptPadError, KryptPadErrorCodes };
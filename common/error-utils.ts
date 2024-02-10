enum KryptPadErrorCodes {
    OK,
    GENERIC,
    DECRYPT_ERROR

}

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
     * 
     * @param err Creates
     * @returns 
     */
    static fromError(err: unknown): KryptPadError {

        if (err instanceof KryptPadError) {
            // Return itself. It is already a KryptPadError
            return err;

        } else if (err instanceof Error) {
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
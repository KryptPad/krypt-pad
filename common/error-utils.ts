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
    else {
        err = 'An unknown error occurred.';
    }

    return err;
}

/**
 * Decryption error
 */
class DecryptionError extends Error {
    constructor(message?: string) {
      // 'Error' breaks prototype chain here
      super(message); 
  
      // Restore prototype chain   
      const actualProto = new.target.prototype;
  
      Object.setPrototypeOf(this, actualProto);
    }
  }



export { getExceptionMessage, DecryptionError };
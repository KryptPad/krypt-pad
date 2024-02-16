/*
Quality of life utilities
*/

/**
 * Takes a file path and returns only the name of the file
 * @param filePath The full path to the file
 * @returns 
 */
function getFileName(filePath: string): string | undefined {
    // Convert from \ to /
    let newPath = filePath.replace(/\\/g, '/');

    // Split the path by / and pop off the last one
    const fileName = newPath.split('/').pop();

    return fileName;

}

/**
 * Adds an extension if there is no extension.
 * @param filePath The full path to the file
 * @param extension The extension to add if one is not present
 * @returns 
 */
function ensureExtension(filePath: string, extension: string): string{
    // Check if the file has an extension. If not, then add one. It doesn't have to be the CORRECT extension. It just has to have one.

    const dotIndex = filePath.lastIndexOf('.');
    if (dotIndex < 0){
        // The file doesn't have an extension. Add the extension.
        filePath += '.' + extension;
        
    }

    return filePath;

}

export { getFileName, ensureExtension };
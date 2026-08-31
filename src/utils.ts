/*
Quality of life utilities
*/

/**
 * Takes a file path and returns only the name of the file
 * @param filePath The full path to the file
 * @returns
 */
export function getFileName(filePath: string): string | undefined {
    // Convert from \ to /
    let newPath = filePath.replace(/\\/g, '/')

    // Split the path by / and pop off the last one
    const fileName = newPath.split('/').pop()

    return fileName
}

/**
 * Gets the directory from a file path. Returns undefined if the file path does not contain a directory.
 * @param filePath The path of the selected file
 * @returns
 */
export function getDirectoryFromFilePath(filePath: string): string | undefined {
    // Convert from \ to /
    filePath = filePath.replace(/\\/g, '/')
    const lastSlashIndex = filePath.lastIndexOf('/')

    if (lastSlashIndex === -1) {
        return undefined
    }

    return filePath.substring(0, lastSlashIndex)
}

/**
 * Adds an extension if there is no extension.
 * @param filePath The full path to the file
 * @param extension The extension to add if one is not present
 * @returns
 */
export function ensureExtension(filePath: string, extension: string): string {
    // Check if the file has an extension. If not, then add one. It doesn't have to be the CORRECT extension. It just has to have one.

    const dotIndex = filePath.lastIndexOf('.')
    if (dotIndex < 0) {
        // The file doesn't have an extension. Add the extension.
        filePath += '.' + extension
    }

    return filePath
}

/**
 * Validates a value against a set of rules.
 */
export function validateRules(rules: Array<Function>, value: any): boolean {
    // Iterate through each rule. All must pass.
    for (const rule of rules) {
        if (rule(value) !== true) {
            return false
        }
    }

    return true
}

/**
 * Converts a hex color to an rgba color with the given alpha value.
 * @param hex The hex color to convert. Must be in the format #RRGGBB
 * @param alpha The alpha value to use in the rgba color. Must be between 0 and 1.
 * @returns
 */
export function hexToRgba(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

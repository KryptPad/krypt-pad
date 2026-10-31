import path from 'node:path'
import crypto from 'node:crypto'
import { open, rename, unlink, type FileHandle } from 'fs/promises'

/**
 * Writes a file atomically: the writer fills a temporary file in the same
 * directory, which is flushed to disk and then renamed over the target. A
 * crash or failure mid-write leaves the destination untouched and the
 * temporary file removed.
 *
 * The temporary file name is unique per process and per call. A shared name
 * would let a second writer truncate the temp file this one is midway through,
 * so the rename could publish a partial file over a perfectly good one.
 * @param filePath The path of the file to write
 * @param writer Fills the temporary file through the given handle
 */
async function withAtomicFile(filePath: string, writer: (fileHandle: FileHandle) => Promise<void>): Promise<void> {
    const directory = path.dirname(filePath)
    const uniqueSuffix = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`
    const tempFilePath = path.join(directory, `.${path.basename(filePath)}.${uniqueSuffix}.tmp`)

    try {
        const fileHandle = await open(tempFilePath, 'w')
        try {
            await writer(fileHandle)
            // Ensure the data is durably written to disk before replacing the target
            await fileHandle.sync()
        } finally {
            await fileHandle.close()
        }

        // Atomically replace the destination with the fully-written temp file
        await rename(tempFilePath, filePath)
    } catch (ex) {
        // Clean up the temporary file if it was created
        await unlink(tempFilePath).catch(() => {})
        throw ex
    }
}

/**
 * Atomically writes data to a file. See withAtomicFile.
 * @param filePath The path of the file to write
 * @param data The data to write
 */
async function writeFileAtomic(filePath: string, data: Uint8Array): Promise<void> {
    await withAtomicFile(filePath, (fileHandle) => fileHandle.writeFile(data))
}

/**
 * Atomically copies a file. See withAtomicFile.
 * @param srcPath The file to copy
 * @param destPath Where to copy it
 */
async function copyFileAtomic(srcPath: string, destPath: string): Promise<void> {
    const source = await open(srcPath, 'r')
    try {
        await withAtomicFile(destPath, async (dest) => {
            const buffer = Buffer.alloc(64 * 1024)
            for (;;) {
                const { bytesRead } = await source.read(buffer, 0, buffer.length, null)
                if (bytesRead === 0) {
                    break
                }
                await dest.write(buffer, 0, bytesRead)
            }
        })
    } finally {
        await source.close()
    }
}

export { withAtomicFile, writeFileAtomic, copyFileAtomic }

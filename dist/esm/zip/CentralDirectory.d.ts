/**
 * Central Directory Reader
 *
 * Reads the Central Directory from seekable files to get
 * external file attributes (needed for symlink detection).
 */
export interface CentralDirEntry {
    fileName: string;
    externalAttributes: number;
    platform: number;
}
export interface CentralDirMap {
    [fileName: string]: CentralDirEntry;
}
/**
 * Read Central Directory from file and return map of filename -> entry info
 */
export declare function readCentralDirectory(filePath: string, callback: (err: Error | null, map?: CentralDirMap) => void): void;

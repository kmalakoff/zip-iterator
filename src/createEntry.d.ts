/**
 * Create Entry from ZIP Header
 *
 * Creates the appropriate entry type (File, Directory, SymbolicLink, Link)
 * based on the parsed LocalFileHeader and Central Directory info.
 */
import type { Entry, Lock } from './types.ts';
import type { CentralDirEntry, LocalFileHeader } from './zip/index.ts';
export type EntryCallback = (error?: Error, result?: IteratorResult<Entry>) => void;
/**
 * Create an entry from a LocalFileHeader and stream
 */
export default function createEntry(header: LocalFileHeader, stream: NodeJS.ReadableStream, lock: Lock, next: () => void, callback: EntryCallback, cdEntry?: CentralDirEntry | null): void;

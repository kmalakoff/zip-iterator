export { DirectoryEntry, type Entry, type ExtractOptions, LinkEntry, SymbolicLinkEntry } from 'extract-base-iterator';
export { default as FileEntry } from './FileEntry.ts';

export interface LockT {
  iterator?: unknown;
  err?: Error;
  fd?: number;
  tempPath: string;
  retain: () => void;
  release: () => void;
}

export interface ZipFile {
  getStream: () => NodeJS.ReadableStream;
}

export interface AbstractZipFileIterator {
  next: () => ZipFile;
}

import type { Entry } from 'extract-base-iterator';

export type EntryCallback = (error?: Error, result?: IteratorResult<Entry>) => undefined;

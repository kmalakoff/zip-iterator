export { default as FileEntry } from './FileEntry.js';
export { type Entry, type AbstractIterator, DirectoryEntry, LinkEntry, SymbolicLinkEntry, type ExtractOptions } from 'extract-base-iterator';

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

import type { AbstractIterator, Entry } from 'extract-base-iterator';
export interface AbstractZipIterator extends AbstractIterator<unknown> {
  lock: LockT;
  iterator: AbstractZipFileIterator;
}

export type EntryCallback = (error?: Error, entry?: Entry) => undefined;

// localHeader: localHeader,
// stream: stream,
// start: start,
// centralHeader: centralHeader,
// lastModified: () => decodeDateTime(localHeader.last_mod_file_date, localHeader.last_mod_file_time),
// getStream: () => {

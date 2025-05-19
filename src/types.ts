export type { ExtractOptions } from 'extract-base-iterator';

export interface LockT {
  iterator?: unknown;
  err?: Error;
  fd?: number;
  tempPath: string;
  retain: () => void;
  release: () => void;
}

export interface ZipFileEntryT {
  getStream: () => NodeJS.ReadableStream;
}

/**
 * Type definitions for zip-iterator
 */

import type { ExtractOptions as BaseExtractOptions } from 'extract-base-iterator';

export { DirectoryEntry, type Entry, type ExtractOptions, LinkEntry, SymbolicLinkEntry } from 'extract-base-iterator';
export { default as FileEntry } from './FileEntry.ts';

export interface LockT {
  iterator?: unknown;
  err?: Error;
  retain: () => void;
  release: () => void;
}

/**
 * Options for ZipIterator constructor
 */
export interface ZipIteratorOptions extends BaseExtractOptions {
  /**
   * When true, process streams in pure forward-only mode without buffering
   * to a temp file. This enables lower memory usage but symlink detection
   * will only work if the archive contains ASi extra fields (0x756e).
   * Most Info-ZIP archives do NOT have ASi fields, so symlinks may be
   * extracted as regular files in streaming mode.
   *
   * Default: false (buffer streams to temp file for reliable symlink detection)
   */
  streaming?: boolean;
}

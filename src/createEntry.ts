/**
 * Create Entry from ZIP Header
 *
 * Creates the appropriate entry type (File, Directory, SymbolicLink, Link)
 * based on the parsed LocalFileHeader and Central Directory info.
 */

import once from 'call-once-fn';
import { type DirectoryAttributes, DirectoryEntry, type Entry, type FileAttributes, type LinkAttributes, LinkEntry, SymbolicLinkEntry } from 'extract-base-iterator';
import FileEntry from './FileEntry.ts';
import parseExternalFileAttributes from './lib/parseExternalFileAttributes.ts';
import streamToString from './lib/streamToString.ts';
import type { LockT } from './types.ts';
import { findAsiInfo, findExtendedTimestamp } from './zip/extra-fields.ts';
import type { CentralDirEntry, LocalFileHeader } from './zip/index.ts';

// Unix file type bits (S_IFMT mask = 0xF000)
const S_IFLNK = 0xa000; // Symbolic link
const S_IFDIR = 0x4000; // Directory
const S_IFREG = 0x8000; // Regular file

export type EntryCallback = (error?: Error, result?: IteratorResult<Entry>) => void;

/**
 * Create an entry from a LocalFileHeader and stream
 */
export default function createEntry(header: LocalFileHeader, stream: NodeJS.ReadableStream, lock: LockT, next: () => void, callback: EntryCallback, cdEntry?: CentralDirEntry | null): void {
  const cb = once((err?: Error, entry?: Entry) => {
    // Call next to allow parser to continue
    next();
    // Return result to iterator
    if (err) {
      callback(err);
    } else if (entry) {
      callback(null, { done: false, value: entry });
    } else {
      callback(null, { done: true, value: null });
    }
  });

  // Parse external attributes for type and permissions
  const attributes = getAttributes(header, cdEntry);

  switch (attributes.type) {
    case 'directory':
      cb(null, new DirectoryEntry(attributes as DirectoryAttributes));
      return;

    case 'symlink':
    case 'link':
      // Read symlink target from stream
      streamToString(stream, (err: Error | null, target?: string) => {
        if (err) {
          cb(err);
          return;
        }
        const linkAttributes: LinkAttributes = {
          ...attributes,
          linkpath: target || '',
        };
        const LinkClass = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
        cb(null, new LinkClass(linkAttributes));
      });
      return;

    case 'file':
      cb(null, new FileEntry(attributes as unknown as FileAttributes, stream, lock));
      return;

    default:
      cb(new Error(`Unrecognized entry type: ${attributes.type}`));
  }
}

/**
 * Extract attributes from header and Central Directory entry
 */
function getAttributes(
  header: LocalFileHeader,
  cdEntry?: CentralDirEntry | null
): {
  type: 'file' | 'directory' | 'symlink' | 'link';
  path: string;
  mode: number;
  mtime: number;
} {
  // Clean up path - remove leading/trailing slashes, normalize separators
  let filePath = header.fileName;
  // Replace backslashes with forward slashes
  filePath = filePath.split('\\').join('/');
  // Remove leading slashes
  while (filePath.charAt(0) === '/') {
    filePath = filePath.substring(1);
  }
  // Remove empty path segments
  const segments = filePath.split('/');
  const cleanSegments: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].length > 0) {
      cleanSegments.push(segments[i]);
    }
  }
  filePath = cleanSegments.join('/');

  // Detect directory by trailing slash in original filename
  const isDirectory = header.fileName.charAt(header.fileName.length - 1) === '/';

  // Default type based on filename pattern
  let type: 'file' | 'directory' | 'symlink' | 'link' = isDirectory ? 'directory' : 'file';

  // Default mode
  let mode: number = isDirectory ? 493 : 420; // 0o755 or 0o644

  // If we have Central Directory entry, use external attributes for accurate type detection
  if (cdEntry) {
    const parsed = parseExternalFileAttributes(cdEntry.externalAttributes, cdEntry.platform);
    type = parsed.type;
    mode = parsed.mode as number;
  } else {
    // Try ASi extra field for symlink detection in streaming mode
    const asiInfo = findAsiInfo(header.extraFields);
    if (asiInfo) {
      const fileType = asiInfo.mode & 0xf000;
      if (fileType === S_IFLNK) {
        type = 'symlink';
      } else if (fileType === S_IFDIR) {
        type = 'directory';
      } else if (fileType === S_IFREG) {
        type = 'file';
      }
      // Use lower 12 bits as permissions
      mode = asiInfo.mode & 0x0fff;
    }
  }

  // Get modification time as timestamp
  let mtime = header.mtime.getTime();

  // Try to get extended timestamp for better precision
  const extTimestamp = findExtendedTimestamp(header.extraFields);
  if (extTimestamp && extTimestamp.mtime) {
    mtime = extTimestamp.mtime * 1000;
  }

  return {
    type,
    path: filePath,
    mode,
    mtime,
  };
}

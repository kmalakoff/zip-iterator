/**
 * Parse External File Attributes
 *
 * Extracts file type and permissions from ZIP external attributes.
 * Based on: https://github.com/bower/decompress-zip/blob/master/lib/structures.js
 */

import type { Mode } from 'fs';

// Permission constants (decimal equivalents of octal for Node 0.8 compatibility)
const MODE_READ_ALL = 292; // 0o0444 - r--r--r--
const MODE_WRITE_ALL = 146; // 0o0222 - -w--w--w-
const MODE_EXEC_ALL = 73; // 0o0111 - --x--x--x

export interface Attributes {
  platform: string;
  type: 'file' | 'directory' | 'link' | 'symlink';
  mode: Mode;
  mtime?: number;
  path?: string;
}

export default function parseExternalFileAttributes(externalAttributes: number, platform: number): Attributes {
  const types: { [key: number]: string } = {
    // In theory, any of these could be set. Realistically, though, it will
    // be regular, directory or symlink
    1: 'namedpipe',
    2: 'character',
    4: 'directory',
    6: 'block',
    8: 'file',
    10: 'symlink',
    12: 'socket',
  };

  switch (platform) {
    case 3: // Unix
      return {
        platform: 'Unix',
        type: (types[(externalAttributes >> 28) & 0x0f] as Attributes['type']) || 'file',
        mode: (externalAttributes >> 16) & 0xfff,
      };

    // case 0: // MSDOS
    default: {
      if (platform !== 0) {
        console.warn(`Possibly unsupported ZIP platform type, ${platform}`);
      }

      const attribs = {
        A: (externalAttributes >> 5) & 0x01,
        D: (externalAttributes >> 4) & 0x01,
        V: (externalAttributes >> 3) & 0x01,
        S: (externalAttributes >> 2) & 0x01,
        H: (externalAttributes >> 1) & 0x01,
        R: externalAttributes & 0x01,
      };

      // With no better guidance we'll make the default permissions ugo+r
      let mode = MODE_READ_ALL;

      if (attribs.D) {
        mode |= MODE_EXEC_ALL; // Set the execute bit
      }

      if (!attribs.R) {
        mode |= MODE_WRITE_ALL; // Set the write bit
      }

      mode &= ~process.umask();

      return {
        platform: 'DOS',
        type: attribs.D ? 'directory' : 'file',
        mode: mode,
      };
    }
  }
}

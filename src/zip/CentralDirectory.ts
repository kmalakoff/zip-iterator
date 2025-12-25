/**
 * Central Directory Reader
 *
 * Reads the Central Directory from seekable files to get
 * external file attributes (needed for symlink detection).
 */

import { allocBuffer, bufferEquals, readUInt64LE } from 'extract-base-iterator';
import fs from 'graceful-fs';
import * as C from './constants.ts';
import { decodeCP437 } from './cp437.ts';

export interface CentralDirEntry {
  fileName: string;
  externalAttributes: number;
  platform: number;
}

// Use plain object instead of Map for Node 0.8-0.10 compatibility
export interface CentralDirMap {
  [fileName: string]: CentralDirEntry;
}

/**
 * Read Central Directory from file and return map of filename -> entry info
 */
export function readCentralDirectory(filePath: string, callback: (err: Error | null, map?: CentralDirMap) => void): void {
  fs.stat(filePath, (err, stats) => {
    if (err) return callback(err);

    const fileSize = stats.size;

    // EOCD is at most 65557 bytes from end (22 bytes min + 65535 max comment)
    const searchSize = Math.min(65557, fileSize);
    const searchBuffer = allocBuffer(searchSize);
    const searchStart = fileSize - searchSize;

    fs.open(filePath, 'r', (err, fd) => {
      if (err) return callback(err);

      fs.read(fd, searchBuffer, 0, searchSize, searchStart, (err, bytesRead) => {
        if (err) {
          fs.close(fd, () => callback(err));
          return;
        }

        // Find End of Central Directory signature
        let eocdPos = -1;
        for (let i = bytesRead - 22; i >= 0; i--) {
          if (bufferEquals(searchBuffer, i, C.SIG_END_OF_CENTRAL_DIR)) {
            eocdPos = i;
            break;
          }
        }

        if (eocdPos < 0) {
          fs.close(fd, () => callback(new Error('Cannot find End of Central Directory')));
          return;
        }

        // Parse EOCD
        const eocd = searchBuffer.slice(eocdPos);
        let cdOffset = eocd.readUInt32LE(16);
        let cdSize = eocd.readUInt32LE(12);

        // Check for ZIP64
        if (cdOffset === C.ZIP64_MARKER_32) {
          // Need to find ZIP64 EOCD locator
          if (eocdPos >= 20) {
            const locatorPos = eocdPos - 20;
            if (bufferEquals(searchBuffer, locatorPos, C.SIG_ZIP64_EOCD_LOCATOR)) {
              // Get ZIP64 EOCD position
              const zip64EocdOffset = readUInt64LE(searchBuffer, locatorPos + 8);

              // Read ZIP64 EOCD
              const zip64EocdBuf = allocBuffer(56);
              fs.read(fd, zip64EocdBuf, 0, 56, zip64EocdOffset, (err) => {
                if (err) {
                  fs.close(fd, () => callback(err));
                  return;
                }

                if (!bufferEquals(zip64EocdBuf, 0, C.SIG_ZIP64_END_OF_CENTRAL_DIR)) {
                  fs.close(fd, () => callback(new Error('Invalid ZIP64 EOCD')));
                  return;
                }

                cdSize = readUInt64LE(zip64EocdBuf, 40);
                cdOffset = readUInt64LE(zip64EocdBuf, 48);

                readCentralDirEntries(fd, cdOffset, cdSize, (err, map) => {
                  fs.close(fd, () => callback(err, map));
                });
              });
              return;
            }
          }
        }

        readCentralDirEntries(fd, cdOffset, cdSize, (err, map) => {
          fs.close(fd, () => callback(err, map));
        });
      });
    });
  });
}

/**
 * Read and parse Central Directory entries
 */
function readCentralDirEntries(fd: number, offset: number, size: number, callback: (err: Error | null, map?: CentralDirMap) => void): void {
  const buffer = allocBuffer(size);

  fs.read(fd, buffer, 0, size, offset, (err, bytesRead) => {
    if (err) return callback(err);

    const map: CentralDirMap = {};
    let pos = 0;

    while (pos + 46 <= bytesRead) {
      // Check signature
      if (!bufferEquals(buffer, pos, C.SIG_CENTRAL_DIR)) {
        break;
      }

      const platform = buffer.readUInt8(pos + 5); // Version made by - high byte is platform
      const flags = buffer.readUInt16LE(pos + 8); // General purpose bit flags
      const fileNameLength = buffer.readUInt16LE(pos + 28);
      const extraFieldLength = buffer.readUInt16LE(pos + 30);
      const commentLength = buffer.readUInt16LE(pos + 32);
      const externalAttributes = buffer.readUInt32LE(pos + 38);

      const headerSize = 46 + fileNameLength + extraFieldLength + commentLength;
      if (pos + headerSize > bytesRead) {
        break;
      }

      // Check UTF-8 flag (bit 11) to determine filename encoding
      const isUtf8 = (flags & C.FLAG_UTF8) !== 0;
      let fileName: string;
      if (isUtf8) {
        fileName = buffer.toString('utf8', pos + 46, pos + 46 + fileNameLength);
      } else {
        // CP437 is the original IBM PC character set and ZIP default
        fileName = decodeCP437(buffer, pos + 46, pos + 46 + fileNameLength);
      }

      map[fileName] = {
        fileName,
        externalAttributes,
        platform,
      };

      pos += headerSize;
    }

    callback(null, map);
  });
}

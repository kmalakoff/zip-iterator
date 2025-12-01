/**
 * ZIP Extra Field Parsing
 *
 * Handles parsing of specific extra field types:
 * - ZIP64 Extended Information (0x0001)
 * - Info-ZIP Unix Extra Field (0x5855 / 0x7875)
 * - Extended Timestamp (0x5455)
 */

import { crc32, readUInt64LE } from 'extract-base-iterator';
import * as C from './constants.ts';
import type { ExtraField } from './headers.ts';

// =============================================================================
// Types
// =============================================================================

export interface Zip64Info {
  uncompressedSize: number;
  compressedSize: number;
  /** Relative header offset (if present) */
  headerOffset?: number;
  /** Disk start number (if present) */
  diskStart?: number;
}

export interface UnixInfo {
  /** User ID */
  uid?: number;
  /** Group ID */
  gid?: number;
  /** Access time (seconds since epoch) */
  atime?: number;
  /** Modification time (seconds since epoch) */
  mtime?: number;
  /** Unix file mode (permissions + type) */
  mode?: number;
}

export interface AsiInfo {
  /** Unix file mode (permissions + file type) */
  mode: number;
  /** User ID */
  uid: number;
  /** Group ID */
  gid: number;
  /** Symlink target path (if symlink) */
  linkPath?: string;
}

export interface ExtendedTimestamp {
  /** Modification time (seconds since epoch) */
  mtime?: number;
  /** Access time (seconds since epoch) */
  atime?: number;
  /** Creation time (seconds since epoch) */
  ctime?: number;
}

// =============================================================================
// ZIP64 Extended Information Extra Field (0x0001)
// =============================================================================

/**
 * Parse ZIP64 Extended Information Extra Field
 *
 * Field layout (fields only present if corresponding local header field was 0xFFFFFFFF):
 *   Original Size: 8 bytes
 *   Compressed Size: 8 bytes
 *   Relative Header Offset: 8 bytes (Central Directory only)
 *   Disk Start Number: 4 bytes (Central Directory only)
 *
 * In Local File Header, typically only sizes are present.
 *
 * @param field - The extra field to parse
 * @param needUncompressed - Whether uncompressed size marker was 0xFFFFFFFF
 * @param needCompressed - Whether compressed size marker was 0xFFFFFFFF
 */
export function parseZip64ExtraField(field: ExtraField, needUncompressed: boolean, needCompressed: boolean): Zip64Info | null {
  if (field.id !== C.EXTID_ZIP64) {
    return null;
  }

  const data = field.data;
  let offset = 0;
  const result: Zip64Info = {
    uncompressedSize: 0,
    compressedSize: 0,
  };

  // Fields appear in order but only if the corresponding header field was 0xFFFFFFFF
  if (needUncompressed) {
    if (offset + 8 > data.length) return null;
    result.uncompressedSize = readUInt64LE(data, offset);
    offset += 8;
  }

  if (needCompressed) {
    if (offset + 8 > data.length) return null;
    result.compressedSize = readUInt64LE(data, offset);
    offset += 8;
  }

  // Header offset and disk start are only in Central Directory entries
  // In Local File Headers we typically only have sizes
  if (offset + 8 <= data.length) {
    result.headerOffset = readUInt64LE(data, offset);
    offset += 8;
  }

  if (offset + 4 <= data.length) {
    result.diskStart = data.readUInt32LE(offset);
  }

  return result;
}

// =============================================================================
// Info-ZIP Unix Extra Field (Old) - 0x5855
// =============================================================================

/**
 * Parse Info-ZIP Unix Extra Field (old format)
 *
 * Field layout:
 *   Access Time: 4 bytes (Unix timestamp)
 *   Modification Time: 4 bytes (Unix timestamp)
 *   UID: 2 bytes (optional, in Central Directory)
 *   GID: 2 bytes (optional, in Central Directory)
 */
export function parseUnixExtraFieldOld(field: ExtraField): UnixInfo | null {
  if (field.id !== C.EXTID_UNIX_OLD) {
    return null;
  }

  const data = field.data;
  if (data.length < 8) {
    return null;
  }

  const result: UnixInfo = {
    atime: data.readUInt32LE(0),
    mtime: data.readUInt32LE(4),
  };

  // UID and GID are optional (present in Central Directory)
  if (data.length >= 12) {
    result.uid = data.readUInt16LE(8);
    result.gid = data.readUInt16LE(10);
  }

  return result;
}

// =============================================================================
// Info-ZIP New Unix Extra Field - 0x7875
// =============================================================================

/**
 * Parse Info-ZIP New Unix Extra Field
 *
 * This format supports variable-length UID/GID values.
 *
 * Field layout:
 *   Version: 1 byte (currently 1)
 *   UIDSize: 1 byte
 *   UID: UIDSize bytes
 *   GIDSize: 1 byte
 *   GID: GIDSize bytes
 */
export function parseUnixExtraFieldNew(field: ExtraField): UnixInfo | null {
  if (field.id !== C.EXTID_UNIX_NEW) {
    return null;
  }

  const data = field.data;
  if (data.length < 3) {
    return null;
  }

  const version = data[0];
  if (version !== 1) {
    return null; // Unknown version
  }

  let offset = 1;
  const result: UnixInfo = {};

  // Parse UID
  const uidSize = data[offset++];
  if (offset + uidSize > data.length) {
    return null;
  }
  result.uid = readVariableInt(data, offset, uidSize);
  offset += uidSize;

  // Parse GID
  if (offset >= data.length) {
    return result;
  }
  const gidSize = data[offset++];
  if (offset + gidSize > data.length) {
    return null;
  }
  result.gid = readVariableInt(data, offset, gidSize);

  return result;
}

// =============================================================================
// Extended Timestamp Extra Field - 0x5455
// =============================================================================

/**
 * Parse Extended Timestamp Extra Field
 *
 * Field layout:
 *   Flags: 1 byte (bit 0: mtime, bit 1: atime, bit 2: ctime)
 *   mtime: 4 bytes (if flag bit 0 set)
 *   atime: 4 bytes (if flag bit 1 set) - Local header only
 *   ctime: 4 bytes (if flag bit 2 set) - Local header only
 */
export function parseExtendedTimestamp(field: ExtraField): ExtendedTimestamp | null {
  if (field.id !== C.EXTID_EXTENDED_TIMESTAMP) {
    return null;
  }

  const data = field.data;
  if (data.length < 1) {
    return null;
  }

  const flags = data[0];
  let offset = 1;
  const result: ExtendedTimestamp = {};

  // Modification time
  if ((flags & 0x01) !== 0 && offset + 4 <= data.length) {
    result.mtime = data.readUInt32LE(offset);
    offset += 4;
  }

  // Access time (Local header only)
  if ((flags & 0x02) !== 0 && offset + 4 <= data.length) {
    result.atime = data.readUInt32LE(offset);
    offset += 4;
  }

  // Creation time (Local header only)
  if ((flags & 0x04) !== 0 && offset + 4 <= data.length) {
    result.ctime = data.readUInt32LE(offset);
  }

  return result;
}

// =============================================================================
// ASi Unix Extra Field - 0x756e
// =============================================================================

/**
 * Parse ASi Unix Extra Field
 *
 * This format is used by some archivers and contains Unix file mode
 * which can be used for symlink detection in streaming mode.
 *
 * Field layout (BIG ENDIAN - unusual for ZIP):
 *   CRC: 4 bytes (CRC32 of remaining data)
 *   Mode: 2 bytes (Unix file mode including type bits)
 *   SizDev: 4 bytes (symlink size or device numbers)
 *   UID: 2 bytes (user ID)
 *   GID: 2 bytes (group ID)
 *   Link: variable (symlink target path, if symlink)
 */
export function parseAsiExtraField(field: ExtraField): AsiInfo | null {
  if (field.id !== C.EXTID_ASI) {
    return null;
  }

  const data = field.data;
  // Minimum size: CRC(4) + Mode(2) + SizDev(4) + UID(2) + GID(2) = 14 bytes
  if (data.length < 14) {
    return null;
  }

  // Read and verify CRC (big-endian)
  const storedCrc = data.readUInt32BE(0);
  const dataAfterCrc = data.slice(4);
  const computedCrc = crc32(dataAfterCrc);

  if (storedCrc !== computedCrc) {
    // CRC mismatch - corrupt or wrong format
    return null;
  }

  // Parse fields (big-endian)
  const mode = data.readUInt16BE(4);
  const sizDev = data.readUInt32BE(6);
  const uid = data.readUInt16BE(10);
  const gid = data.readUInt16BE(12);

  const result: AsiInfo = {
    mode,
    uid,
    gid,
  };

  // If this is a symlink (S_IFLNK = 0o120000 = 0xA000), read link path
  // Check file type bits: (mode & 0xF000) === 0xA000
  if ((mode & 0xf000) === 0xa000 && sizDev > 0 && data.length >= 14 + sizDev) {
    result.linkPath = data.toString('utf8', 14, 14 + sizDev);
  }

  return result;
}

/**
 * Find and parse ASi Unix info from extra fields
 * Returns file mode which can be used for symlink detection
 */
export function findAsiInfo(fields: ExtraField[]): AsiInfo | null {
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].id === C.EXTID_ASI) {
      const info = parseAsiExtraField(fields[i]);
      if (info) return info;
    }
  }
  return null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Read variable-length little-endian integer
 * Used for UID/GID in new Unix extra field format
 */
function readVariableInt(buf: Buffer, offset: number, size: number): number {
  let value = 0;
  for (let i = 0; i < size; i++) {
    value += buf[offset + i] << (i * 8);
  }
  return value;
}

/**
 * Find and parse Unix info from extra fields
 * Tries new format first, falls back to old format
 */
export function findUnixInfo(fields: ExtraField[]): UnixInfo | null {
  // Try new format first (more common in modern archives)
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].id === C.EXTID_UNIX_NEW) {
      const info = parseUnixExtraFieldNew(fields[i]);
      if (info) return info;
    }
  }

  // Fall back to old format
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].id === C.EXTID_UNIX_OLD) {
      const info = parseUnixExtraFieldOld(fields[i]);
      if (info) return info;
    }
  }

  return null;
}

/**
 * Find and parse extended timestamp from extra fields
 */
export function findExtendedTimestamp(fields: ExtraField[]): ExtendedTimestamp | null {
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].id === C.EXTID_EXTENDED_TIMESTAMP) {
      const ts = parseExtendedTimestamp(fields[i]);
      if (ts) return ts;
    }
  }
  return null;
}

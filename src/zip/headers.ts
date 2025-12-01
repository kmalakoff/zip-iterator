/**
 * ZIP Header Parsing
 *
 * Functions for parsing Local File Headers and Data Descriptors.
 * All parsing is forward-only - no seeking required.
 */

import { bufferEquals, readUInt64LE } from 'extract-base-iterator';
import * as C from './constants.ts';
import { decodeCP437 } from './cp437.ts';

// =============================================================================
// Types
// =============================================================================

export interface ExtraField {
  id: number;
  size: number;
  data: Buffer;
}

export interface LocalFileHeader {
  // Raw fields from header
  versionNeeded: number;
  flags: number;
  compressionMethod: number;
  lastModTime: number;
  lastModDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  fileNameLength: number;
  extraFieldLength: number;
  fileName: string;
  extraFields: ExtraField[];

  // Computed/derived values
  isEncrypted: boolean;
  hasDataDescriptor: boolean;
  isUtf8: boolean;
  isZip64: boolean;
  mtime: Date;

  // Total header size (fixed + filename + extra)
  headerSize: number;
}

export interface DataDescriptor {
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Total bytes consumed (including optional signature) */
  size: number;
}

// =============================================================================
// Local File Header Parsing
// =============================================================================

/**
 * Check if buffer at offset contains Local File Header signature
 */
export function isLocalFileHeader(buf: Buffer, offset: number): boolean {
  return bufferEquals(buf, offset, C.SIG_LOCAL_FILE);
}

/**
 * Check if buffer at offset contains Central Directory signature
 * (indicates end of local file entries)
 */
export function isCentralDirectory(buf: Buffer, offset: number): boolean {
  return bufferEquals(buf, offset, C.SIG_CENTRAL_DIR);
}

/**
 * Check if buffer at offset contains Data Descriptor signature
 */
export function isDataDescriptor(buf: Buffer, offset: number): boolean {
  return bufferEquals(buf, offset, C.SIG_DATA_DESCRIPTOR);
}

/**
 * Parse Local File Header from buffer
 *
 * @param buf - Buffer containing header data
 * @param offset - Offset to start of header (at signature)
 * @returns Parsed header or null if not enough data
 */
export function parseLocalFileHeader(buf: Buffer, offset: number): LocalFileHeader | null {
  // Need at least the fixed header portion
  if (buf.length < offset + C.LOCAL_HEADER_FIXED_SIZE) {
    return null;
  }

  // Verify signature
  if (!isLocalFileHeader(buf, offset)) {
    return null;
  }

  // Parse fixed fields
  const versionNeeded = buf.readUInt16LE(offset + 4);
  const flags = buf.readUInt16LE(offset + 6);
  const compressionMethod = buf.readUInt16LE(offset + 8);
  const lastModTime = buf.readUInt16LE(offset + 10);
  const lastModDate = buf.readUInt16LE(offset + 12);
  const crc32 = buf.readUInt32LE(offset + 14);
  let compressedSize = buf.readUInt32LE(offset + 18);
  let uncompressedSize = buf.readUInt32LE(offset + 22);
  const fileNameLength = buf.readUInt16LE(offset + 26);
  const extraFieldLength = buf.readUInt16LE(offset + 28);

  // Calculate total header size
  const headerSize = C.LOCAL_HEADER_FIXED_SIZE + fileNameLength + extraFieldLength;

  // Check if we have the complete header
  if (buf.length < offset + headerSize) {
    return null;
  }

  // Parse filename
  // UTF-8 flag indicates filename is UTF-8 encoded, otherwise use CP437
  const isUtf8 = (flags & C.FLAG_UTF8) !== 0;
  let fileName: string;
  if (isUtf8) {
    fileName = buf.toString('utf8', offset + 30, offset + 30 + fileNameLength);
  } else {
    // CP437 is the original IBM PC character set and ZIP default
    fileName = decodeCP437(buf, offset + 30, offset + 30 + fileNameLength);
  }

  // Parse extra fields
  const extraFieldStart = offset + 30 + fileNameLength;
  const extraFields = parseExtraFields(buf.slice(extraFieldStart, extraFieldStart + extraFieldLength));

  // Check for ZIP64 markers
  let isZip64 = false;
  if (compressedSize === C.ZIP64_MARKER_32 || uncompressedSize === C.ZIP64_MARKER_32) {
    isZip64 = true;
    // Try to get actual sizes from ZIP64 extra field
    const zip64Extra = findExtraField(extraFields, C.EXTID_ZIP64);
    if (zip64Extra && zip64Extra.data.length >= 16) {
      uncompressedSize = readUInt64LE(zip64Extra.data, 0);
      compressedSize = readUInt64LE(zip64Extra.data, 8);
    }
  }

  // Compute derived values
  const isEncrypted = (flags & C.FLAG_ENCRYPTED) !== 0;
  const hasDataDescriptor = (flags & C.FLAG_DATA_DESCRIPTOR) !== 0;
  const mtime = decodeDateTime(lastModDate, lastModTime);

  return {
    versionNeeded,
    flags,
    compressionMethod,
    lastModTime,
    lastModDate,
    crc32,
    compressedSize,
    uncompressedSize,
    fileNameLength,
    extraFieldLength,
    fileName,
    extraFields,
    isEncrypted,
    hasDataDescriptor,
    isUtf8,
    isZip64,
    mtime,
    headerSize,
  };
}

// =============================================================================
// Extra Field Parsing
// =============================================================================

/**
 * Parse extra fields from buffer
 *
 * Extra field format:
 *   Header ID (2 bytes) + Data Size (2 bytes) + Data (variable)
 */
export function parseExtraFields(buf: Buffer): ExtraField[] {
  const fields: ExtraField[] = [];
  let offset = 0;

  while (offset + 4 <= buf.length) {
    const id = buf.readUInt16LE(offset);
    const size = buf.readUInt16LE(offset + 2);

    if (offset + 4 + size > buf.length) {
      break; // Truncated extra field
    }

    fields.push({
      id,
      size,
      data: buf.slice(offset + 4, offset + 4 + size),
    });

    offset += 4 + size;
  }

  return fields;
}

/**
 * Find extra field by ID
 */
export function findExtraField(fields: ExtraField[], id: number): ExtraField | null {
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].id === id) {
      return fields[i];
    }
  }
  return null;
}

// =============================================================================
// Data Descriptor Parsing
// =============================================================================

/**
 * Parse Data Descriptor from buffer
 *
 * Data descriptors can appear with or without the optional signature.
 * This function handles both cases.
 *
 * @param buf - Buffer containing descriptor data
 * @param offset - Offset to start of descriptor
 * @param isZip64 - Whether to expect 8-byte sizes
 * @returns Parsed descriptor or null if not enough data
 */
export function parseDataDescriptor(buf: Buffer, offset: number, isZip64: boolean): DataDescriptor | null {
  // Determine expected sizes
  const sizeBytes = isZip64 ? 8 : 4;
  const minSize = 4 + sizeBytes * 2; // CRC + compressed + uncompressed
  const minSizeWithSig = 4 + minSize; // signature + above

  // Check if we have the optional signature
  const hasSignature = bufferEquals(buf, offset, C.SIG_DATA_DESCRIPTOR);
  const expectedSize = hasSignature ? minSizeWithSig : minSize;

  if (buf.length < offset + expectedSize) {
    return null;
  }

  // Adjust offset if signature is present
  const dataOffset = hasSignature ? offset + 4 : offset;

  const crc32 = buf.readUInt32LE(dataOffset);

  let compressedSize: number;
  let uncompressedSize: number;

  if (isZip64) {
    compressedSize = readUInt64LE(buf, dataOffset + 4);
    uncompressedSize = readUInt64LE(buf, dataOffset + 12);
  } else {
    compressedSize = buf.readUInt32LE(dataOffset + 4);
    uncompressedSize = buf.readUInt32LE(dataOffset + 8);
  }

  return {
    crc32,
    compressedSize,
    uncompressedSize,
    size: expectedSize,
  };
}

// =============================================================================
// Date/Time Decoding
// =============================================================================

/**
 * Decode MS-DOS date/time format to JavaScript Date
 *
 * MS-DOS date format (16 bits):
 *   Bits 0-4: Day (1-31)
 *   Bits 5-8: Month (1-12)
 *   Bits 9-15: Year (offset from 1980)
 *
 * MS-DOS time format (16 bits):
 *   Bits 0-4: Seconds/2 (0-29)
 *   Bits 5-10: Minutes (0-59)
 *   Bits 11-15: Hours (0-23)
 */
export function decodeDateTime(date: number, time: number): Date {
  const year = ((date >> 9) & 0x7f) + 1980;
  const month = ((date >> 5) & 0x0f) - 1; // 0-indexed for Date constructor
  const day = date & 0x1f;
  const hour = (time >> 11) & 0x1f;
  const minute = (time >> 5) & 0x3f;
  const second = (time & 0x1f) * 2;

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Get entry type from filename and external attributes
 */
export function getEntryType(fileName: string, externalAttributes: number, platform: number): 'file' | 'directory' | 'symlink' | 'link' {
  // Directory detection: filename ends with /
  if (fileName.charAt(fileName.length - 1) === '/') {
    return 'directory';
  }

  // Unix platform: check file type bits
  if (platform === C.PLATFORM_UNIX) {
    const unixType = (externalAttributes >> 28) & 0x0f;
    if (unixType === C.UNIX_TYPE_DIR) return 'directory';
    if (unixType === C.UNIX_TYPE_SYMLINK) return 'symlink';
    // Note: Hard links are stored differently in ZIP
  }

  return 'file';
}

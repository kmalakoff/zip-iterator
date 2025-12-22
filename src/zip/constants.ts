/**
 * ZIP Format Constants
 *
 * All values based on PKWARE APPNOTE.TXT specification.
 * Byte arrays used for signature detection with bufferEquals().
 * Decimal values used instead of octal literals for Node 0.8 compatibility.
 */

// =============================================================================
// Signatures (as byte arrays for bufferEquals - little-endian)
// =============================================================================

/** Local File Header signature: PK\x03\x04 (0x04034b50) */
export const SIG_LOCAL_FILE = [0x50, 0x4b, 0x03, 0x04];

/** Data Descriptor signature: PK\x07\x08 (0x08074b50) - optional */
export const SIG_DATA_DESCRIPTOR = [0x50, 0x4b, 0x07, 0x08];

/** Central Directory File Header signature: PK\x01\x02 (0x02014b50) */
export const SIG_CENTRAL_DIR = [0x50, 0x4b, 0x01, 0x02];

/** End of Central Directory signature: PK\x05\x06 (0x06054b50) */
export const SIG_END_OF_CENTRAL_DIR = [0x50, 0x4b, 0x05, 0x06];

/** ZIP64 End of Central Directory signature: PK\x06\x06 (0x06064b50) */
export const SIG_ZIP64_END_OF_CENTRAL_DIR = [0x50, 0x4b, 0x06, 0x06];

/** ZIP64 End of Central Directory Locator signature: PK\x06\x07 (0x07064b50) */
export const SIG_ZIP64_EOCD_LOCATOR = [0x50, 0x4b, 0x06, 0x07];

// =============================================================================
// Compression Methods
// =============================================================================

/** No compression - data stored as-is */
export const METHOD_STORE = 0;

/** DEFLATE compression (most common) */
export const METHOD_DEFLATE = 8;

/** BZIP2 compression (not supported) */
export const METHOD_BZIP2 = 12;

/** LZMA compression (not supported) */
export const METHOD_LZMA = 14;

// =============================================================================
// General Purpose Bit Flags
// =============================================================================

/** Bit 0: Entry is encrypted (traditional encryption) */
export const FLAG_ENCRYPTED = 1;

/** Bit 3: Data descriptor follows compressed data (sizes/CRC not in header) */
export const FLAG_DATA_DESCRIPTOR = 8;

/** Bit 6: Strong encryption / AES encryption (PKWARE) */
export const FLAG_STRONG_ENCRYPTION = 64;

/** Bit 11: Filename and comment are UTF-8 encoded */
export const FLAG_UTF8 = 2048;

// =============================================================================
// Extra Field Header IDs
// =============================================================================

/** ZIP64 Extended Information Extra Field */
export const EXTID_ZIP64 = 0x0001;

/** Info-ZIP Unix Extra Field (original/old) - contains atime, mtime, uid, gid */
export const EXTID_UNIX_OLD = 0x5855;

/** Info-ZIP New Unix Extra Field - variable length uid/gid */
export const EXTID_UNIX_NEW = 0x7875;

/** PKWARE Unix Extra Field */
export const EXTID_PKWARE_UNIX = 0x000d;

/** Extended Timestamp Extra Field */
export const EXTID_EXTENDED_TIMESTAMP = 0x5455;

/** ASi Unix Extra Field (contains mode with symlink bit) */
export const EXTID_ASI = 0x756e;

// =============================================================================
// Header Sizes (in bytes)
// =============================================================================

/** Local File Header fixed portion (before filename/extra) */
export const LOCAL_HEADER_FIXED_SIZE = 30;

/** Minimum bytes needed to detect any signature */
export const SIGNATURE_SIZE = 4;

/** Data Descriptor size without signature */
export const DATA_DESCRIPTOR_SIZE = 12;

/** Data Descriptor size with optional signature */
export const DATA_DESCRIPTOR_SIZE_WITH_SIG = 16;

/** ZIP64 Data Descriptor size without signature */
export const ZIP64_DATA_DESCRIPTOR_SIZE = 20;

/** ZIP64 Data Descriptor size with optional signature */
export const ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG = 24;

// =============================================================================
// ZIP64 Markers
// =============================================================================

/** Marker value indicating ZIP64 extended info should be used (32-bit max) */
export const ZIP64_MARKER_32 = 0xffffffff;

/** Marker value indicating ZIP64 extended info should be used (16-bit max) */
export const ZIP64_MARKER_16 = 0xffff;

// =============================================================================
// Permission Constants (decimal equivalents of octal)
// =============================================================================

/** Read permission for all (0o0444 = r--r--r--) */
export const MODE_READ_ALL = 292;

/** Write permission for all (0o0222 = -w--w--w-) */
export const MODE_WRITE_ALL = 146;

/** Execute permission for all (0o0111 = --x--x--x) */
export const MODE_EXEC_ALL = 73;

/** Default file permissions (0o0644 = rw-r--r--) */
export const MODE_DEFAULT_FILE = 420;

/** Default directory permissions (0o0755 = rwxr-xr-x) */
export const MODE_DEFAULT_DIR = 493;

// =============================================================================
// Platform Codes (from version made by / version needed)
// =============================================================================

/** MS-DOS and OS/2 (FAT) */
export const PLATFORM_MSDOS = 0;

/** Unix */
export const PLATFORM_UNIX = 3;

/** NTFS (Windows NT) */
export const PLATFORM_NTFS = 10;

/** OS X (Darwin) */
export const PLATFORM_OSX = 19;

// =============================================================================
// Unix File Type Bits (from external attributes >> 28)
// =============================================================================

/** Named pipe (FIFO) */
export const UNIX_TYPE_FIFO = 1;

/** Character device */
export const UNIX_TYPE_CHAR = 2;

/** Directory */
export const UNIX_TYPE_DIR = 4;

/** Block device */
export const UNIX_TYPE_BLOCK = 6;

/** Regular file */
export const UNIX_TYPE_FILE = 8;

/** Symbolic link */
export const UNIX_TYPE_SYMLINK = 10;

/** Socket */
export const UNIX_TYPE_SOCKET = 12;

// =============================================================================
// Error Codes
// =============================================================================

/** Error codes for programmatic error handling */
export const ZipErrorCode = {
  INVALID_SIGNATURE: 'ZIP_INVALID_SIGNATURE',
  CRC_MISMATCH: 'ZIP_CRC_MISMATCH',
  UNSUPPORTED_METHOD: 'ZIP_UNSUPPORTED_METHOD',
  ENCRYPTED_ENTRY: 'ZIP_ENCRYPTED_ENTRY',
  TRUNCATED_ARCHIVE: 'ZIP_TRUNCATED_ARCHIVE',
  SIZE_EXCEEDED: 'ZIP_SIZE_EXCEEDED',
  INVALID_SIZE: 'ZIP_INVALID_SIZE',
  BUFFER_OVERFLOW: 'ZIP_BUFFER_OVERFLOW',
};

/** Error with a code property for programmatic handling */
export interface ZipCodedError extends Error {
  code: string;
}

/**
 * Create an error with a code property
 */
export function createZipError(message: string, code: string): ZipCodedError {
  const err = new Error(message) as ZipCodedError;
  err.code = code;
  return err;
}

/**
 * ZIP Format Constants
 *
 * All values based on PKWARE APPNOTE.TXT specification.
 * Byte arrays used for signature detection with bufferEquals().
 * Decimal values used instead of octal literals for Node 0.8 compatibility.
 */
/** Local File Header signature: PK\x03\x04 (0x04034b50) */
export declare const SIG_LOCAL_FILE: number[];
/** Data Descriptor signature: PK\x07\x08 (0x08074b50) - optional */
export declare const SIG_DATA_DESCRIPTOR: number[];
/** Central Directory File Header signature: PK\x01\x02 (0x02014b50) */
export declare const SIG_CENTRAL_DIR: number[];
/** End of Central Directory signature: PK\x05\x06 (0x06054b50) */
export declare const SIG_END_OF_CENTRAL_DIR: number[];
/** ZIP64 End of Central Directory signature: PK\x06\x06 (0x06064b50) */
export declare const SIG_ZIP64_END_OF_CENTRAL_DIR: number[];
/** ZIP64 End of Central Directory Locator signature: PK\x06\x07 (0x07064b50) */
export declare const SIG_ZIP64_EOCD_LOCATOR: number[];
/** No compression - data stored as-is */
export declare const METHOD_STORE = 0;
/** DEFLATE compression (most common) */
export declare const METHOD_DEFLATE = 8;
/** BZIP2 compression (not supported) */
export declare const METHOD_BZIP2 = 12;
/** LZMA compression (not supported) */
export declare const METHOD_LZMA = 14;
/** Bit 0: Entry is encrypted (traditional encryption) */
export declare const FLAG_ENCRYPTED = 1;
/** Bit 3: Data descriptor follows compressed data (sizes/CRC not in header) */
export declare const FLAG_DATA_DESCRIPTOR = 8;
/** Bit 6: Strong encryption / AES encryption (PKWARE) */
export declare const FLAG_STRONG_ENCRYPTION = 64;
/** Bit 11: Filename and comment are UTF-8 encoded */
export declare const FLAG_UTF8 = 2048;
/** ZIP64 Extended Information Extra Field */
export declare const EXTID_ZIP64 = 1;
/** Info-ZIP Unix Extra Field (original/old) - contains atime, mtime, uid, gid */
export declare const EXTID_UNIX_OLD = 22613;
/** Info-ZIP New Unix Extra Field - variable length uid/gid */
export declare const EXTID_UNIX_NEW = 30837;
/** PKWARE Unix Extra Field */
export declare const EXTID_PKWARE_UNIX = 13;
/** Extended Timestamp Extra Field */
export declare const EXTID_EXTENDED_TIMESTAMP = 21589;
/** ASi Unix Extra Field (contains mode with symlink bit) */
export declare const EXTID_ASI = 30062;
/** Local File Header fixed portion (before filename/extra) */
export declare const LOCAL_HEADER_FIXED_SIZE = 30;
/** Minimum bytes needed to detect any signature */
export declare const SIGNATURE_SIZE = 4;
/** Data Descriptor size without signature */
export declare const DATA_DESCRIPTOR_SIZE = 12;
/** Data Descriptor size with optional signature */
export declare const DATA_DESCRIPTOR_SIZE_WITH_SIG = 16;
/** ZIP64 Data Descriptor size without signature */
export declare const ZIP64_DATA_DESCRIPTOR_SIZE = 20;
/** ZIP64 Data Descriptor size with optional signature */
export declare const ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG = 24;
/** Marker value indicating ZIP64 extended info should be used (32-bit max) */
export declare const ZIP64_MARKER_32 = 4294967295;
/** Marker value indicating ZIP64 extended info should be used (16-bit max) */
export declare const ZIP64_MARKER_16 = 65535;
/** Read permission for all (0o0444 = r--r--r--) */
export declare const MODE_READ_ALL = 292;
/** Write permission for all (0o0222 = -w--w--w-) */
export declare const MODE_WRITE_ALL = 146;
/** Execute permission for all (0o0111 = --x--x--x) */
export declare const MODE_EXEC_ALL = 73;
/** Default file permissions (0o0644 = rw-r--r--) */
export declare const MODE_DEFAULT_FILE = 420;
/** Default directory permissions (0o0755 = rwxr-xr-x) */
export declare const MODE_DEFAULT_DIR = 493;
/** MS-DOS and OS/2 (FAT) */
export declare const PLATFORM_MSDOS = 0;
/** Unix */
export declare const PLATFORM_UNIX = 3;
/** NTFS (Windows NT) */
export declare const PLATFORM_NTFS = 10;
/** OS X (Darwin) */
export declare const PLATFORM_OSX = 19;
export declare const S_IFLNK = 40960;
export declare const S_IFDIR = 16384;
export declare const S_IFREG = 32768;
/** Named pipe (FIFO) */
export declare const UNIX_TYPE_FIFO = 1;
/** Character device */
export declare const UNIX_TYPE_CHAR = 2;
/** Directory */
export declare const UNIX_TYPE_DIR = 4;
/** Block device */
export declare const UNIX_TYPE_BLOCK = 6;
/** Regular file */
export declare const UNIX_TYPE_FILE = 8;
/** Symbolic link */
export declare const UNIX_TYPE_SYMLINK = 10;
/** Socket */
export declare const UNIX_TYPE_SOCKET = 12;
/** Error codes for programmatic error handling */
export declare const ZipErrorCode: {
  INVALID_SIGNATURE: string;
  CRC_MISMATCH: string;
  UNSUPPORTED_METHOD: string;
  ENCRYPTED_ENTRY: string;
  TRUNCATED_ARCHIVE: string;
  SIZE_EXCEEDED: string;
  INVALID_SIZE: string;
  BUFFER_OVERFLOW: string;
};
/** Error with a code property for programmatic handling */
export interface ZipCodedError extends Error {
  code: string;
}
/**
 * Create an error with a code property
 */
export declare function createZipError(message: string, code: string): ZipCodedError;

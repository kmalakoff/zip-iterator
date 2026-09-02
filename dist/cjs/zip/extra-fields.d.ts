/**
 * ZIP Extra Field Parsing
 *
 * Handles parsing of specific extra field types:
 * - ZIP64 Extended Information (0x0001)
 * - Info-ZIP Unix Extra Field (0x5855 / 0x7875)
 * - Extended Timestamp (0x5455)
 */
import type { ExtraField } from './headers.js';
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
export declare function parseZip64ExtraField(field: ExtraField, needUncompressed: boolean, needCompressed: boolean): Zip64Info | null;
/**
 * Parse Info-ZIP Unix Extra Field (old format)
 *
 * Field layout:
 *   Access Time: 4 bytes (Unix timestamp)
 *   Modification Time: 4 bytes (Unix timestamp)
 *   UID: 2 bytes (optional, in Central Directory)
 *   GID: 2 bytes (optional, in Central Directory)
 */
export declare function parseUnixExtraFieldOld(field: ExtraField): UnixInfo | null;
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
export declare function parseUnixExtraFieldNew(field: ExtraField): UnixInfo | null;
/**
 * Parse Extended Timestamp Extra Field
 *
 * Field layout:
 *   Flags: 1 byte (bit 0: mtime, bit 1: atime, bit 2: ctime)
 *   mtime: 4 bytes (if flag bit 0 set)
 *   atime: 4 bytes (if flag bit 1 set) - Local header only
 *   ctime: 4 bytes (if flag bit 2 set) - Local header only
 */
export declare function parseExtendedTimestamp(field: ExtraField): ExtendedTimestamp | null;
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
export declare function parseAsiExtraField(field: ExtraField): AsiInfo | null;
/**
 * Find and parse ASi Unix info from extra fields
 * Returns file mode which can be used for symlink detection
 */
export declare function findAsiInfo(fields: ExtraField[]): AsiInfo | null;
/**
 * Find and parse Unix info from extra fields
 * Tries new format first, falls back to old format
 */
export declare function findUnixInfo(fields: ExtraField[]): UnixInfo | null;
/**
 * Find and parse extended timestamp from extra fields
 */
export declare function findExtendedTimestamp(fields: ExtraField[]): ExtendedTimestamp | null;

/**
 * ZIP Header Parsing
 *
 * Functions for parsing Local File Headers and Data Descriptors.
 * All parsing is forward-only - no seeking required.
 */
export interface ExtraField {
    id: number;
    size: number;
    data: Buffer;
}
export interface LocalFileHeader {
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
    isEncrypted: boolean;
    isStrongEncrypted: boolean;
    hasDataDescriptor: boolean;
    isUtf8: boolean;
    isZip64: boolean;
    mtime: Date;
    headerSize: number;
}
export interface DataDescriptor {
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
    /** Total bytes consumed (including optional signature) */
    size: number;
}
/**
 * Check if buffer at offset contains Local File Header signature
 */
export declare function isLocalFileHeader(buf: Buffer, offset: number): boolean;
/**
 * Check if buffer at offset contains Central Directory signature
 * (indicates end of local file entries)
 */
export declare function isCentralDirectory(buf: Buffer, offset: number): boolean;
/**
 * Check if buffer at offset contains Data Descriptor signature
 */
export declare function isDataDescriptor(buf: Buffer, offset: number): boolean;
/**
 * Parse Local File Header from buffer
 *
 * @param buf - Buffer containing header data
 * @param offset - Offset to start of header (at signature)
 * @returns Parsed header or null if not enough data
 */
export declare function parseLocalFileHeader(buf: Buffer, offset: number): LocalFileHeader | null;
/**
 * Parse extra fields from buffer
 *
 * Extra field format:
 *   Header ID (2 bytes) + Data Size (2 bytes) + Data (variable)
 */
export declare function parseExtraFields(buf: Buffer): ExtraField[];
/**
 * Find extra field by ID
 */
export declare function findExtraField(fields: ExtraField[], id: number): ExtraField | null;
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
export declare function parseDataDescriptor(buf: Buffer, offset: number, isZip64: boolean): DataDescriptor | null;
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
export declare function decodeDateTime(date: number, time: number): Date;
/**
 * Get entry type from filename and external attributes
 */
export declare function getEntryType(fileName: string, externalAttributes: number, platform: number): 'file' | 'directory' | 'symlink' | 'link';

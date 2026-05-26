/**
 * CP437 (Code Page 437) to Unicode conversion
 *
 * CP437 was the original IBM PC character set and is the default encoding
 * for ZIP filenames when the UTF-8 flag (bit 11) is not set.
 *
 * Characters 0x00-0x7F are standard ASCII.
 * Characters 0x80-0xFF are the extended characters that differ from Latin-1.
 */
/**
 * Decode CP437 encoded bytes to a Unicode string
 *
 * @param buf - Buffer containing CP437 encoded data
 * @param start - Start offset in buffer
 * @param end - End offset in buffer
 * @returns Decoded Unicode string
 */
export declare function decodeCP437(buf: Buffer, start: number, end: number): string;
/**
 * Check if a buffer contains only ASCII characters (0x00-0x7F)
 * If true, CP437 and UTF-8 will produce identical results
 */
export declare function isAscii(buf: Buffer, start: number, end: number): boolean;

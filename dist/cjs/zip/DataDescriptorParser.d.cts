/**
 * DataDescriptorParser - Boundary scanning for entries with data descriptors
 *
 * When entries use data descriptors (streaming ZIP creation), we don't know
 * the compressed size upfront. This module handles scanning for boundary
 * signatures to find where file data ends and the data descriptor begins.
 */
import type { BufferList } from 'extract-base-iterator';
/**
 * Result of finding a boundary in the buffer
 */
export interface BoundaryResult {
    /** Position where compressed data ends (start of data descriptor) */
    dataEnd: number;
    /** True if the data descriptor has an optional signature */
    hasSignature: boolean;
}
/**
 * Search for a byte sequence in a buffer
 * Returns the position of the first occurrence, or -1 if not found
 */
export declare function bufferIndexOf(buf: Buffer, sig: number[]): number;
/**
 * Find the boundary for DEFLATE data with data descriptor
 *
 * Scans for structure signatures (local header, central directory)
 * that indicate where the compressed data ends. The data descriptor
 * is located immediately before these signatures.
 *
 * @param combined Combined buffer of all compressed chunks
 * @param isZip64 Whether this is a ZIP64 entry (affects descriptor size)
 * @returns Boundary result or null if not found yet
 */
export declare function findDeflateBoundary(combined: Buffer, isZip64: boolean): BoundaryResult | null;
/**
 * Find the end of STORE data with data descriptor
 *
 * STORE data has no internal end markers, so we scan for:
 * 1. Data descriptor signature
 * 2. Next local header (descriptor might not have signature)
 *
 * @param buffer The buffer to scan
 * @param isZip64 Whether this is a ZIP64 entry
 * @returns Position where data ends, or -1 if not found
 */
export declare function findStoreDataEnd(buffer: BufferList, isZip64: boolean): number;
/**
 * Calculate the safety buffer size for STORE data streaming
 *
 * When streaming STORE data, we keep a safety buffer to ensure
 * we don't emit bytes that are actually part of the data descriptor
 * or next header.
 */
export declare function getSafetyBufferSize(): number;

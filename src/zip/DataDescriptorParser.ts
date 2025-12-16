/**
 * DataDescriptorParser - Boundary scanning for entries with data descriptors
 *
 * When entries use data descriptors (streaming ZIP creation), we don't know
 * the compressed size upfront. This module handles scanning for boundary
 * signatures to find where file data ends and the data descriptor begins.
 */

import type { BufferList } from 'extract-base-iterator';
import * as C from './constants.ts';

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
export function bufferIndexOf(buf: Buffer, sig: number[]): number {
  if (sig.length === 0) return 0;
  if (buf.length < sig.length) return -1;

  outer: for (let i = 0; i <= buf.length - sig.length; i++) {
    for (let j = 0; j < sig.length; j++) {
      if (buf[i + j] !== sig[j]) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
}

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
export function findDeflateBoundary(combined: Buffer, isZip64: boolean): BoundaryResult | null {
  // Look for next structure signature (definitive end markers)
  let boundaryPos = -1;
  for (const sig of [C.SIG_LOCAL_FILE, C.SIG_CENTRAL_DIR, C.SIG_END_OF_CENTRAL_DIR]) {
    const pos = bufferIndexOf(combined, sig);
    if (pos >= 0 && (boundaryPos < 0 || pos < boundaryPos)) {
      boundaryPos = pos;
    }
  }

  if (boundaryPos < 0) {
    return null; // No boundary found yet
  }

  // Data descriptor is immediately before the boundary
  const descSize = isZip64 ? C.ZIP64_DATA_DESCRIPTOR_SIZE : C.DATA_DESCRIPTOR_SIZE;

  // Check if data descriptor has optional signature
  let descStart = boundaryPos - descSize;
  let hasSignature = false;

  if (descStart >= C.SIGNATURE_SIZE) {
    // Check for data descriptor signature
    if (combined[descStart - 4] === C.SIG_DATA_DESCRIPTOR[0] && combined[descStart - 3] === C.SIG_DATA_DESCRIPTOR[1] && combined[descStart - 2] === C.SIG_DATA_DESCRIPTOR[2] && combined[descStart - 1] === C.SIG_DATA_DESCRIPTOR[3]) {
      descStart -= C.SIGNATURE_SIZE;
      hasSignature = true;
    }
  }

  if (descStart < 0) {
    return null; // Not enough data
  }

  return { dataEnd: descStart, hasSignature };
}

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
export function findStoreDataEnd(buffer: BufferList, isZip64: boolean): number {
  // Look for data descriptor signature
  const descriptorPos = buffer.indexOf(C.SIG_DATA_DESCRIPTOR);

  // Also look for next local header as a boundary
  const nextHeaderPos = buffer.indexOf(C.SIG_LOCAL_FILE);

  // Determine where data ends
  let dataEnd = -1;

  if (descriptorPos >= 0) {
    dataEnd = descriptorPos;
  }

  if (nextHeaderPos >= 0) {
    // If we found a header before descriptor, the descriptor might not have signature
    if (dataEnd < 0 || nextHeaderPos < dataEnd) {
      // Try to find descriptor without signature before the header
      const descSize = isZip64 ? C.ZIP64_DATA_DESCRIPTOR_SIZE : C.DATA_DESCRIPTOR_SIZE;

      if (nextHeaderPos >= descSize) {
        dataEnd = nextHeaderPos - descSize;
      }
    }
  }

  return dataEnd;
}

/**
 * Calculate the safety buffer size for STORE data streaming
 *
 * When streaming STORE data, we keep a safety buffer to ensure
 * we don't emit bytes that are actually part of the data descriptor
 * or next header.
 */
export function getSafetyBufferSize(): number {
  return Math.max(C.ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG, C.LOCAL_HEADER_FIXED_SIZE);
}

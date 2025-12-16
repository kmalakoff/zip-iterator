/**
 * DeflateBufferHandler - Buffered DEFLATE decompression
 *
 * Used for entries with data descriptors where compressed size is unknown.
 * Buffers all compressed data, then decompresses once the boundary is found.
 */

import { crc32, inflateRaw } from 'extract-base-iterator';
import type Stream from 'stream';
import * as C from '../constants.ts';
import type { CompressionHandler, CompressionOptions, CompressionResult } from './types.ts';

export class DeflateBufferHandler implements CompressionHandler {
  private chunks: Buffer[] = [];
  private outputStream: Stream.PassThrough;
  private runningCrc = 0;
  private verifyCrc: boolean;
  private onComplete: () => void;
  private onError: (err: Error) => void;

  constructor(options: CompressionOptions) {
    this.outputStream = options.outputStream;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.verifyCrc = options.verifyCrc !== false;
  }

  write(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  /**
   * Decompress all buffered data and verify CRC
   */
  finish(expectedCrc: number): CompressionResult {
    if (this.chunks.length === 0) {
      // No data to decompress
      this.onComplete();
      return { continue: true };
    }

    try {
      // Concatenate all chunks
      const compressedData = Buffer.concat(this.chunks);
      this.chunks = [];

      // Decompress using native zlib (Node 0.11.12+) or pako fallback
      const decompressed = inflateRaw(compressedData);

      // Verify CRC
      if (this.verifyCrc) {
        this.runningCrc = crc32(decompressed);
        if (this.runningCrc !== expectedCrc) {
          this.onError(C.createZipError(`CRC32 mismatch: expected ${expectedCrc.toString(16)}, got ${this.runningCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
          return { continue: false };
        }
      }

      // Write decompressed data
      this.outputStream.write(decompressed);
      this.onComplete();
      return { continue: true };
    } catch (err) {
      this.onError(err as Error);
      return { continue: false, error: err as Error };
    }
  }

  getRunningCrc(): number {
    return this.runningCrc;
  }

  isWaiting(): boolean {
    return false; // Buffered handler is always synchronous
  }

  /**
   * Get accumulated compressed data without consuming it
   */
  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Clear the buffer
   */
  clearBuffer(): void {
    this.chunks = [];
  }

  destroy(): void {
    this.chunks = [];
    this.runningCrc = 0;
  }
}

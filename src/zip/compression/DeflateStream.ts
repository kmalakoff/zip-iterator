/**
 * DeflateStreamHandler - Streaming DEFLATE decompression with CRC
 *
 * Used for entries with known compressed size. Memory efficient because
 * it decompresses data as it arrives rather than buffering everything.
 */

import { crc32, createInflateRawStream } from 'extract-base-iterator';
import oo from 'on-one';
import type Stream from 'stream';
import * as C from '../constants.ts';
import type { CompressionHandler, CompressionOptions, CompressionResult } from './types.ts';

export class DeflateStreamHandler implements CompressionHandler {
  private inflateStream: NodeJS.ReadWriteStream;
  private outputStream: Stream.PassThrough;
  private runningCrc = 0;
  private verifyCrc: boolean;
  private waiting = false;
  private onComplete: () => void;
  private onError: (err: Error) => void;

  constructor(options: CompressionOptions) {
    this.outputStream = options.outputStream;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.verifyCrc = options.verifyCrc !== false;

    // Create inflate stream
    this.inflateStream = createInflateRawStream();

    // Handle decompressed data
    this.inflateStream.on('data', (chunk: Buffer) => {
      if (this.verifyCrc) {
        this.runningCrc = crc32(chunk, this.runningCrc);
      }
      this.outputStream.write(chunk);
    });

    // Handle inflate errors
    this.inflateStream.on('error', (err: Error) => {
      this.onError(err);
    });
  }

  write(chunk: Buffer): void {
    this.inflateStream.write(chunk);
  }

  finish(expectedCrc: number): CompressionResult {
    if (this.waiting) {
      return { continue: false };
    }

    this.waiting = true;

    // Set up completion handler
    oo(this.inflateStream, ['end', 'close'], () => {
      this.waiting = false;

      // Verify CRC
      if (this.verifyCrc) {
        if (this.runningCrc !== expectedCrc) {
          this.onError(C.createZipError(`CRC32 mismatch: expected ${expectedCrc.toString(16)}, got ${this.runningCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
          return;
        }
      }

      // Signal completion
      this.onComplete();
    });

    // End the inflate stream to flush remaining data
    this.inflateStream.end();

    return { continue: false }; // Async completion
  }

  getRunningCrc(): number {
    return this.runningCrc;
  }

  isWaiting(): boolean {
    return this.waiting;
  }

  destroy(): void {
    this.inflateStream = null;
    this.runningCrc = 0;
    this.waiting = false;
  }
}

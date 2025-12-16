/**
 * StoreHandler - Passthrough for uncompressed (STORE) entries
 *
 * Simply passes data through while calculating CRC for verification.
 */

import { crc32 } from 'extract-base-iterator';
import type Stream from 'stream';
import * as C from '../constants.ts';
import type { CompressionHandler, CompressionOptions, CompressionResult } from './types.ts';

export class StoreHandler implements CompressionHandler {
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
    if (this.verifyCrc) {
      this.runningCrc = crc32(chunk, this.runningCrc);
    }
    this.outputStream.write(chunk);
  }

  finish(expectedCrc: number): CompressionResult {
    // Verify CRC
    if (this.verifyCrc) {
      if (this.runningCrc !== expectedCrc) {
        this.onError(C.createZipError(`CRC32 mismatch: expected ${expectedCrc.toString(16)}, got ${this.runningCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
        return { continue: false };
      }
    }

    this.onComplete();
    return { continue: true };
  }

  getRunningCrc(): number {
    return this.runningCrc;
  }

  isWaiting(): boolean {
    return false; // Store handler is always synchronous
  }

  destroy(): void {
    this.runningCrc = 0;
  }
}

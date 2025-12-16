/**
 * Types for compression handlers
 */

import type Stream from 'stream';

/**
 * Result of processing a chunk of compressed data
 */
export interface CompressionResult {
  /** True if processing should continue, false if waiting for async completion */
  continue: boolean;
  /** Error if processing failed */
  error?: Error;
}

/**
 * Callbacks for compression handler to communicate with parent
 */
export interface CompressionCallbacks {
  /** Called when decompressed data is ready */
  onData: (chunk: Buffer) => void;
  /** Called when an error occurs */
  onError: (err: Error) => void;
  /** Called when decompression is complete (for async handlers) */
  onComplete: () => void;
  /** Verify CRC option */
  verifyCrc: boolean;
}

/**
 * Common interface for compression handlers
 */
export interface CompressionHandler {
  /** Write compressed data to the handler */
  write(chunk: Buffer): void;

  /**
   * Finish processing and verify CRC
   * @param expectedCrc Expected CRC32 from header
   * @returns Result indicating success/failure and whether to continue
   */
  finish(expectedCrc: number): CompressionResult;

  /** Get the running CRC value */
  getRunningCrc(): number;

  /** Check if handler is waiting for async completion */
  isWaiting(): boolean;

  /** Clean up any resources */
  destroy(): void;
}

/**
 * Options for creating a compression handler
 */
export interface CompressionOptions {
  /** Output stream to write decompressed data to */
  outputStream: Stream.PassThrough;
  /** Callback when processing is complete */
  onComplete: () => void;
  /** Callback when an error occurs */
  onError: (err: Error) => void;
  /** Whether to verify CRC (default: true) */
  verifyCrc?: boolean;
}

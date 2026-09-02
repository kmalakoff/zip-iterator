/**
 * DeflateBufferHandler - Buffered DEFLATE decompression
 *
 * Used for entries with data descriptors where compressed size is unknown.
 * Buffers all compressed data, then decompresses once the boundary is found.
 */
import type { CompressionHandler, CompressionOptions, CompressionResult } from './types.js';
export declare class DeflateBufferHandler implements CompressionHandler {
    private chunks;
    private outputStream;
    private runningCrc;
    private verifyCrc;
    private onComplete;
    private onError;
    constructor(options: CompressionOptions);
    write(chunk: Buffer): void;
    /**
     * Decompress all buffered data and verify CRC
     */
    finish(expectedCrc: number): CompressionResult;
    getRunningCrc(): number;
    isWaiting(): boolean;
    /**
     * Get accumulated compressed data without consuming it
     */
    getBuffer(): Buffer;
    /**
     * Clear the buffer
     */
    clearBuffer(): void;
    destroy(): void;
}

/**
 * DeflateStreamHandler - Streaming DEFLATE decompression with CRC
 *
 * Used for entries with known compressed size. Memory efficient because
 * it decompresses data as it arrives rather than buffering everything.
 */
import type { CompressionHandler, CompressionOptions, CompressionResult } from './types.js';
export declare class DeflateStreamHandler implements CompressionHandler {
    private inflateStream;
    private outputStream;
    private runningCrc;
    private verifyCrc;
    private waiting;
    private onComplete;
    private onError;
    constructor(options: CompressionOptions);
    write(chunk: Buffer): void;
    finish(expectedCrc: number): CompressionResult;
    getRunningCrc(): number;
    isWaiting(): boolean;
    destroy(): void;
}

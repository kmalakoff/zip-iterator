/**
 * StoreHandler - Passthrough for uncompressed (STORE) entries
 *
 * Simply passes data through while calculating CRC for verification.
 */
import type { CompressionHandler, CompressionOptions, CompressionResult } from './types.js';
export declare class StoreHandler implements CompressionHandler {
    private outputStream;
    private runningCrc;
    private verifyCrc;
    private onComplete;
    private onError;
    constructor(options: CompressionOptions);
    write(chunk: Buffer): void;
    finish(expectedCrc: number): CompressionResult;
    getRunningCrc(): number;
    isWaiting(): boolean;
    destroy(): void;
}

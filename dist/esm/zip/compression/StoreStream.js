/**
 * StoreHandler - Passthrough for uncompressed (STORE) entries
 *
 * Simply passes data through while calculating CRC for verification.
 */ import { crc32 } from 'extract-base-iterator';
import * as C from '../constants.js';
export class StoreHandler {
    write(chunk) {
        if (this.verifyCrc) {
            this.runningCrc = crc32(chunk, this.runningCrc);
        }
        this.outputStream.write(chunk);
    }
    finish(expectedCrc) {
        // Verify CRC
        if (this.verifyCrc) {
            if (this.runningCrc !== expectedCrc) {
                this.onError(C.createZipError(`CRC32 mismatch: expected ${expectedCrc.toString(16)}, got ${this.runningCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
                return {
                    continue: false
                };
            }
        }
        // End the stream and complete
        this.outputStream.end();
        this.onComplete();
        return {
            continue: true
        };
    }
    getRunningCrc() {
        return this.runningCrc;
    }
    isWaiting() {
        return false; // Store handler is synchronous
    }
    destroy() {
        this.runningCrc = 0;
    }
    constructor(options){
        this.runningCrc = 0;
        this.outputStream = options.outputStream;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        this.verifyCrc = options.verifyCrc !== false;
    }
}

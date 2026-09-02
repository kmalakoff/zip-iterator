/**
 * DeflateStreamHandler - Streaming DEFLATE decompression with CRC
 *
 * Used for entries with known compressed size. Memory efficient because
 * it decompresses data as it arrives rather than buffering everything.
 */ import { crc32, createInflateRawStream } from 'extract-base-iterator';
import oo from 'on-one';
import * as C from '../constants.js';
export class DeflateStreamHandler {
    write(chunk) {
        if (this.inflateStream) this.inflateStream.write(chunk);
    }
    finish(expectedCrc) {
        if (this.waiting) {
            return {
                continue: false
            };
        }
        this.waiting = true;
        const inflateStream = this.inflateStream;
        oo(inflateStream, [
            'end',
            'close'
        ], (_err)=>{
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
        inflateStream.end();
        return {
            continue: false
        }; // Async completion
    }
    getRunningCrc() {
        return this.runningCrc;
    }
    isWaiting() {
        return this.waiting;
    }
    destroy() {
        this.inflateStream = null;
        this.runningCrc = 0;
        this.waiting = false;
    }
    constructor(options){
        this.runningCrc = 0;
        this.waiting = false;
        this.outputStream = options.outputStream;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        this.verifyCrc = options.verifyCrc !== false;
        // Create inflate stream
        this.inflateStream = createInflateRawStream();
        // Handle decompressed data
        this.inflateStream.on('data', (chunk)=>{
            if (this.verifyCrc) {
                this.runningCrc = crc32(chunk, this.runningCrc);
            }
            this.outputStream.write(chunk);
        });
        // Handle inflate errors
        this.inflateStream.on('error', (err)=>{
            this.onError(err);
        });
    }
}

/**
 * DeflateBufferHandler - Buffered DEFLATE decompression
 *
 * Used for entries with data descriptors where compressed size is unknown.
 * Buffers all compressed data, then decompresses once the boundary is found.
 */ import { crc32, inflateRaw } from 'extract-base-iterator';
import * as C from '../constants.js';
export class DeflateBufferHandler {
    write(chunk) {
        this.chunks.push(chunk);
    }
    /**
   * Decompress all buffered data and verify CRC
   */ finish(expectedCrc) {
        if (this.chunks.length === 0) {
            // No data to decompress
            this.onComplete();
            return {
                continue: true
            };
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
                    return {
                        continue: false
                    };
                }
            }
            // Write decompressed data
            this.outputStream.write(decompressed);
            this.onComplete();
            return {
                continue: true
            };
        } catch (err) {
            this.onError(err);
            return {
                continue: false,
                error: err
            };
        }
    }
    getRunningCrc() {
        return this.runningCrc;
    }
    isWaiting() {
        return false; // Buffered handler is always synchronous
    }
    /**
   * Get accumulated compressed data without consuming it
   */ getBuffer() {
        return Buffer.concat(this.chunks);
    }
    /**
   * Clear the buffer
   */ clearBuffer() {
        this.chunks = [];
    }
    destroy() {
        this.chunks = [];
        this.runningCrc = 0;
    }
    constructor(options){
        this.chunks = [];
        this.runningCrc = 0;
        this.outputStream = options.outputStream;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        this.verifyCrc = options.verifyCrc !== false;
    }
}

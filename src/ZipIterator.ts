import BaseIterator from 'extract-base-iterator';
import fs from 'fs';
import oo from 'on-one';
import os from 'os';
import path from 'path';
import createEntry from './createEntry.ts';
import Lock from './lib/Lock.ts';
import type { LockT, ZipIteratorOptions } from './types.ts';
import { type CentralDirMap, type LocalFileHeader, readCentralDirectory, ZipExtract } from './zip/index.ts';

// Get temp directory
const tmpdir = os.tmpdir || (os as { tmpdir?: () => string }).tmpdir || (() => '/tmp');

export default class ZipIterator extends BaseIterator {
  lock: LockT;
  private extract: ZipExtract | null;
  private centralDir: CentralDirMap | null;
  private tempPath: string | null;
  private sourceStream: NodeJS.ReadableStream | null;
  private streamingMode: boolean;

  constructor(source: string | NodeJS.ReadableStream, options: ZipIteratorOptions = {}) {
    super(options);
    this.lock = new Lock();
    this.lock.iterator = this;
    this.centralDir = null;
    this.tempPath = null;
    this.sourceStream = null;
    this.streamingMode = options.streaming === true;

    // Create the forward-only parser
    this.extract = new ZipExtract();

    if (typeof source === 'string') {
      // For file inputs, read Central Directory first for better type detection
      readCentralDirectory(source, (err, map) => {
        // Check if iterator was destroyed while we were reading CD
        if (this.done) return;

        if (!err && map) {
          this.centralDir = map;
        }
        // Even if CD read fails, continue with forward-only parsing
        this.startStreaming(fs.createReadStream(source));
      });
    } else if (this.streamingMode) {
      // Pure streaming mode - no temp file, rely on ASi extra fields for symlinks
      this.startStreaming(source);
    } else {
      // Default: buffer stream to temp file to get Central Directory access
      this.bufferStreamAndStart(source);
    }
  }

  private bufferStreamAndStart(source: NodeJS.ReadableStream): void {
    // Generate temp file path
    this.tempPath = path.join(tmpdir(), `zip-iterator-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);

    const writeStream = fs.createWriteStream(this.tempPath);
    const tempPath = this.tempPath;

    // Handle source errors
    source.on('error', (err: Error) => {
      const ws = writeStream as NodeJS.WritableStream & { destroy?: () => void };
      if (typeof ws.destroy === 'function') ws.destroy();
      this.cleanupTemp();
      this.end(err);
    });

    // Handle write completion using on-one for Node 0.8 compatibility
    oo(writeStream, ['error', 'finish', 'close'], (err?: Error) => {
      if (err) {
        this.cleanupTemp();
        this.end(err);
        return;
      }

      if (this.done) {
        this.cleanupTemp();
        return;
      }

      // Read Central Directory from temp file
      readCentralDirectory(tempPath, (cdErr, map) => {
        if (this.done) {
          this.cleanupTemp();
          return;
        }

        if (!cdErr && map) {
          this.centralDir = map;
        }

        // Start streaming from temp file
        this.startStreaming(fs.createReadStream(tempPath));
      });
    });

    source.pipe(writeStream);
  }

  private cleanupTemp(): void {
    if (this.tempPath) {
      const tempPath = this.tempPath;
      this.tempPath = null;
      fs.unlink(tempPath, () => {
        // Ignore errors - temp cleanup is best-effort
      });
    }
  }

  private startStreaming(stream: NodeJS.ReadableStream): void {
    // Store reference to destroy on end
    this.sourceStream = stream;

    // IMPORTANT: Set up parser event handlers FIRST, before data flows
    // In Node 0.8, streams are "flowing" immediately when you attach a 'data' handler
    // If the stream ends quickly (e.g., truncated file), we need handlers ready

    this.extract.on('entry', (header: LocalFileHeader, entryStream: NodeJS.ReadableStream, next: () => void) => {
      if (this.done) {
        next();
        return;
      }

      // Look up Central Directory entry if available
      const cdEntry = this.centralDir ? this.centralDir[header.fileName] : null;

      // Push a function that calls createEntry synchronously with the streams
      // Note: createEntry must be called synchronously to receive stream data events
      this.push((_iterator, callback) => {
        // Call createEntry - it will attach listeners to stream which is still active
        createEntry(header, entryStream, this.lock, next, callback, cdEntry);
      });

      // DO NOT continue processing until consumer calls next()
      // The stream is still being populated by ZipExtract.processFileData()
    });

    this.extract.on('error', (err: Error) => {
      this.end(err);
    });

    this.extract.on('finish', () => {
      if (!this.done) {
        this.end();
      }
    });

    // NOW set up stream handlers - data will start flowing after 'data' handler is attached
    stream.on('data', (chunk: Buffer) => {
      if (!this.done && this.extract) {
        this.extract.write(chunk);
      }
    });

    // Handle stream end/error using on-one for Node 0.8 compatibility
    oo(stream, ['error', 'end', 'close'], (err?: Error) => {
      if (err) {
        this.end(err);
      } else if (this.extract) {
        // Signal end to parser - it will emit 'finish' or 'error' which will trigger cleanup
        this.extract.end();
      }
    });
  }

  end(err?: Error) {
    if (this.lock) {
      this.lock.err = err;
      this.lock.release();
      this.lock = null;
    } else {
      BaseIterator.prototype.end.call(this, err);
      // Only cleanup when actually ending (not when releasing lock)
      this.cleanup();
    }
  }

  private cleanup(): void {
    // Signal end to extract if it hasn't been signaled yet
    if (this.extract) {
      this.extract.end();
      this.extract = null;
    }
    this.centralDir = null;
    this.cleanupTemp();

    // Destroy source stream to release file handles (important for Node 0.8)
    if (this.sourceStream) {
      const stream = this.sourceStream as NodeJS.ReadableStream & { destroy?: () => void };
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      this.sourceStream = null;
    }
  }
}

import BaseIterator, { Lock, waitForAccess } from 'extract-base-iterator';
import fs from 'fs';
import mkdirp from 'mkdirp-classic';
import oo from 'on-one';
import os from 'os';
import path from 'path';
import createEntry from './createEntry.ts';
import type { Entry, ZipIteratorOptions } from './types.ts';
import { type CentralDirMap, type LocalFileHeader, readCentralDirectory, ZipExtract } from './zip/index.ts';

// Get temp directory
const tmpdir = os.tmpdir || (os as { tmpdir?: () => string }).tmpdir || (() => '/tmp');

// Extended Lock type with zip-specific properties
interface ZipLock extends Lock {
  setup?: (() => undefined) | null;
}

export default class ZipIterator extends BaseIterator<Entry> {
  private lock: ZipLock | null;
  private extract: ZipExtract | null;
  private centralDir: CentralDirMap | null;
  private tempPath: string | null;
  private sourceStream: NodeJS.ReadableStream | null;
  private streamingMode: boolean;

  constructor(source: string | NodeJS.ReadableStream, options: ZipIteratorOptions = {}) {
    super(options);
    const lock: ZipLock = new Lock();
    this.lock = lock;
    lock.onDestroy = (err) => BaseIterator.prototype.end.call(this, err);
    this.centralDir = null;
    this.tempPath = null;
    this.sourceStream = null;
    this.streamingMode = options.streaming === true;

    // Keep a setup function in processing to prevent BaseIterator from calling end()
    // prematurely when stack becomes empty between entry events.
    // This is removed in end() when the iterator actually completes.
    let cancelled = false;
    const setup = (): undefined => {
      cancelled = true;
    };
    this.processing.push(setup);
    lock.setup = setup;

    // Create the forward-only parser
    this.extract = new ZipExtract();

    if (typeof source === 'string') {
      // For file inputs, read Central Directory first for better type detection
      readCentralDirectory(source, (err, map) => {
        // Check if iterator was destroyed while we were reading CD
        if (this.done || cancelled) return;

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
    // Ensure temp directory exists (may not exist on Windows with Node 0.8 fallback to /tmp)
    const _tmpdir = tmpdir();
    mkdirp.sync(_tmpdir);

    // Generate temp file path
    this.tempPath = path.join(_tmpdir, `zip-iterator-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);

    // Register cleanup for temp file
    const tempPath = this.tempPath;
    this.lock.registerCleanup(() => {
      fs.unlink(tempPath, () => {});
    });

    const writeStream = fs.createWriteStream(this.tempPath);

    // Handle source errors
    source.on('error', (err: Error) => {
      const ws = writeStream as NodeJS.WritableStream & { destroy?: () => void };
      if (typeof ws.destroy === 'function') ws.destroy();
      this.end(err);
    });

    // Handle write completion using on-one for Node 0.8 compatibility
    // Note: Node 0.8 may only emit 'close', not 'finish'. We use waitForAccess
    // to handle Windows where 'close' can fire before file is fully written.
    oo(writeStream, ['error', 'finish', 'close'], (err?: Error) => {
      if (err) {
        this.end(err);
        return;
      }

      if (this.done) return;

      // Wait for file to be accessible (handles Windows timing issues)
      waitForAccess(tempPath, () => {
        if (this.done) return;

        // Read Central Directory from temp file
        readCentralDirectory(tempPath, (cdErr, map) => {
          if (this.done) return;
          if (!cdErr && map) this.centralDir = map;

          // Start streaming from temp file
          this.startStreaming(fs.createReadStream(tempPath));
        });
      });
    });

    source.pipe(writeStream);
  }

  private startStreaming(stream: NodeJS.ReadableStream): void {
    // Guard: if iterator was destroyed before async callback, clean up and exit
    if (!this.lock) {
      const s = stream as NodeJS.ReadableStream & { destroy?: () => void };
      if (typeof s.destroy === 'function') s.destroy();
      return;
    }

    // Store reference to destroy on end
    this.sourceStream = stream;

    // Register cleanup for source stream
    this.lock.registerCleanup(() => {
      const s = stream as NodeJS.ReadableStream & { destroy?: () => void };
      if (typeof s.destroy === 'function') {
        s.destroy();
      }
    });

    // Register cleanup for extract parser
    const extract = this.extract;
    this.lock.registerCleanup(() => {
      if (extract) {
        extract.end();
      }
    });

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
        // Guard: skip if iterator already ended
        if (!this.lock) {
          next();
          callback();
          return;
        }
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
    const lock = this.lock;
    if (lock) {
      this.lock = null; // Clear FIRST to prevent re-entrancy
      // Remove setup from processing before release
      if (lock.setup) {
        this.processing.remove(lock.setup);
        lock.setup = null;
      }
      lock.err = err;
      lock.release(); // Lock.__destroy() handles all cleanup
    }
    // Clear local refs (always runs, safe/idempotent)
    this.extract = null;
    this.centralDir = null;
    this.sourceStream = null;
    this.tempPath = null;
  }
}

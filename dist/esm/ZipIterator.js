import BaseIterator, { Lock, waitForAccess } from 'extract-base-iterator';
import fs from 'graceful-fs';
import mkdirp from 'mkdirp-classic';
import oo from 'on-one';
import os from 'os';
import path from 'path';
import createEntry from './createEntry.js';
import { readCentralDirectory, ZipExtract } from './zip/index.js';
// Get temp directory
const tmpdir = os.tmpdir || os.tmpdir || (()=>'/tmp');
let ZipIterator = class ZipIterator extends BaseIterator {
    bufferStreamAndStart(source) {
        // Ensure temp directory exists (may not exist on Windows with Node 0.8 fallback to /tmp)
        const _tmpdir = tmpdir();
        mkdirp.sync(_tmpdir);
        // Generate temp file path
        this.tempPath = path.join(_tmpdir, `zip-iterator-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
        // Register cleanup for temp file
        const tempPath = this.tempPath;
        this.lock.registerCleanup(()=>{
            fs.unlink(tempPath, ()=>{});
        });
        const writeStream = fs.createWriteStream(this.tempPath);
        // Handle source errors
        source.on('error', (err)=>{
            const ws = writeStream;
            if (typeof ws.destroy === 'function') ws.destroy();
            this.end(err);
        });
        // Handle write completion using on-one for Node 0.8 compatibility
        // Note: Node 0.8 may only emit 'close', not 'finish'. We use waitForAccess
        // to handle Windows where 'close' can fire before file is fully written.
        oo(writeStream, [
            'error',
            'finish',
            'close'
        ], (err)=>{
            if (err) {
                this.end(err);
                return;
            }
            if (this.done) return;
            // Wait for file to be accessible (handles Windows timing issues)
            waitForAccess(tempPath, ()=>{
                if (this.done) return;
                // Read Central Directory from temp file
                readCentralDirectory(tempPath, (cdErr, map)=>{
                    if (this.done) return;
                    if (!cdErr && map) this.centralDir = map;
                    // Start streaming from temp file
                    this.startStreaming(fs.createReadStream(tempPath));
                });
            });
        });
        source.pipe(writeStream);
    }
    startStreaming(stream) {
        // Guard: if iterator was destroyed before async callback, clean up and exit
        if (!this.lock) {
            const s = stream;
            if (typeof s.destroy === 'function') s.destroy();
            return;
        }
        // Register cleanup for source stream
        this.lock.registerCleanup(()=>{
            const s = stream;
            if (typeof s.destroy === 'function') {
                s.destroy();
            }
        });
        const extract = this.extract;
        this.lock.registerCleanup(()=>{
            extract.end();
        });
        extract.on('entry', (header, entryStream, next)=>{
            if (this.done) {
                next();
                return;
            }
            const cdEntry = this.centralDir ? this.centralDir[header.fileName] : null;
            this.push((_iterator, callback)=>{
                if (!this.lock) {
                    next();
                    callback();
                    return;
                }
                createEntry(header, entryStream, this.lock, next, callback, cdEntry);
            });
        });
        extract.on('error', (err)=>{
            this.end(err);
        });
        extract.on('finish', ()=>{
            if (!this.done) {
                this.end();
            }
        });
        // NOW set up stream handlers - data will start flowing after 'data' handler is attached
        stream.on('data', (chunk)=>{
            if (!this.done && this.extract) {
                this.extract.write(chunk);
            }
        });
        // Handle stream end/error using on-one for Node 0.8 compatibility
        oo(stream, [
            'error',
            'end',
            'close'
        ], (err)=>{
            if (err) {
                this.end(err);
            } else if (this.extract) {
                // Signal end to parser - it will emit 'finish' or 'error' which will trigger cleanup
                this.extract.end();
            }
        });
    }
    end(err) {
        const lock = this.lock;
        if (lock) {
            this.lock = null; // Clear FIRST to prevent re-entrancy
            // Remove setup from processing before release
            if (lock.setup) {
                this.processing.remove(lock.setup);
                lock.setup = null;
            }
            lock.err = err !== null && err !== void 0 ? err : null;
            lock.release();
        }
        // Clear local refs (always runs, safe/idempotent)
        this.extract = null;
        this.centralDir = null;
        this.tempPath = null;
    }
    constructor(source, options = {}){
        super(options);
        const lock = new Lock();
        this.lock = lock;
        lock.onDestroy = (err)=>BaseIterator.prototype.end.call(this, err);
        this.centralDir = null;
        this.tempPath = null;
        this.streamingMode = options.streaming === true;
        // Keep a setup function in processing to prevent BaseIterator from calling end()
        // prematurely when stack becomes empty between entry events.
        // This is removed in end() when the iterator actually completes.
        let cancelled = false;
        const setup = ()=>{
            cancelled = true;
        };
        this.processing.push(setup);
        lock.setup = setup;
        // Create the forward-only parser
        this.extract = new ZipExtract();
        if (typeof source === 'string') {
            // For file inputs, read Central Directory first for better type detection
            readCentralDirectory(source, (err, map)=>{
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
};
export { ZipIterator as default };

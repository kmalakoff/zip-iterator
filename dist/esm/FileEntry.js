/**
 * FileEntry for ZIP archives
 *
 * Wraps a decompressed stream with the entry lifecycle.
 */ import once from 'call-once-fn';
import { FileEntry, waitForAccess } from 'extract-base-iterator';
import fs from 'graceful-fs';
import oo from 'on-one';
let ZipFileEntry = class ZipFileEntry extends FileEntry {
    create(dest, options, callback) {
        callback = typeof options === 'function' ? options : callback;
        options = typeof options === 'function' ? {} : options || {};
        if (typeof callback === 'function') {
            const cb = (err)=>{
                callback(err);
                if (this.lock) {
                    this.lock.release();
                    this.lock = null;
                }
            };
            super.create(dest, options, cb);
            return;
        }
        return new Promise((resolve, reject)=>this.create(dest, options, (err)=>err ? reject(err) : resolve(true)));
    }
    _writeFile(fullPath, _options, callback) {
        if (!this.stream) {
            callback(new Error('Zip FileEntry missing stream. Check for calling create multiple times'));
            return;
        }
        const stream = this.stream;
        this.stream = null; // Prevent reuse
        const cb = once((err)=>{
            err ? callback(err) : waitForAccess(fullPath, callback);
        });
        try {
            const writeStream = fs.createWriteStream(fullPath);
            stream.on('error', (streamErr)=>{
                const ws = writeStream;
                writeStream.on('error', ()=>{});
                if (typeof ws.destroy === 'function') ws.destroy();
                cb(streamErr);
            });
            stream.pipe(writeStream);
            oo(writeStream, [
                'error',
                'close',
                'finish'
            ], cb);
        } catch (err) {
            cb(err);
        }
    }
    destroy() {
        super.destroy();
        if (this.stream) {
            this.stream.resume(); // drain stream
            this.stream = null;
        }
        if (this.lock) {
            this.lock.release();
            this.lock = null;
        }
    }
    constructor(attributes, stream, lock){
        super(attributes);
        this.stream = stream;
        this.lock = lock;
        this.lock.retain();
    }
};
export { ZipFileEntry as default };

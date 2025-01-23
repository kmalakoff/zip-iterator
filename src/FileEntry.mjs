import fs from 'fs';
import once from 'call-once-fn';
import { FileEntry } from 'extract-base-iterator';
import waitForAccess from './lib/waitForAccess.mjs';

export default class ZipFileEntry extends FileEntry {
  constructor(attributes, entry, lock) {
    super(attributes);
    this.entry = entry;
    this.lock = lock;
    this.lock.retain();
  }

  create(dest, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = null;
    }

    const self = this;
    if (typeof callback === 'function') {
      options = options || {};
      return FileEntry.prototype.create.call(this, dest, options, (err) => {
        callback(err);
        if (self.lock) {
          self.lock.release();
          self.lock = null;
        }
      });
    }

    return new Promise(function createPromise(resolve, reject) {
      self.create(dest, options, (err, done) => (err ? reject(err) : resolve(done)));
    });
  }

  _writeFile(fullPath, _, callback) {
    if (!this.entry) return callback(new Error('Zip FileEntry missing entry. Check for calling create multiple times'));

    const res = this.entry.getStream().pipe(fs.createWriteStream(fullPath));
    const end = once((err) => {
      err ? callback(err) : waitForAccess(fullPath, callback); // gunzip stream returns prematurely occasionally
    });
    res.on('error', end);
    res.on('end', end);
    res.on('close', end);
    res.on('finish', end);
  }

  destroy() {
    FileEntry.prototype.destroy.call(this);
    this.entry = null;
    if (this.lock) {
      this.lock.release();
      this.lock = null;
    }
  }
}

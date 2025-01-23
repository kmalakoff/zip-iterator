import fs from 'fs';
import { FileEntry } from 'extract-base-iterator';
import oo from 'on-one';
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
    oo(res, ['error', 'end', 'close', 'finish'], (err) => {
      err ? callback(err) : waitForAccess(fullPath, callback); // gunzip stream returns prematurely occasionally
    });
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

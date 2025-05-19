import fs from 'fs';
import { FileEntry } from 'extract-base-iterator';
import oo from 'on-one';
import waitForAccess from './lib/waitForAccess.js';

import type { LockT, ZipFileEntryT } from './types.js';

export default class ZipFileEntry extends FileEntry {
  private lock: LockT;
  private entry: ZipFileEntryT;

  constructor(attributes, entry: ZipFileEntryT, lock: LockT) {
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

    if (typeof callback === 'function') {
      options = options || {};
      return FileEntry.prototype.create.call(this, dest, options, (err) => {
        callback(err);
        if (this.lock) {
          this.lock.release();
          this.lock = null;
        }
      });
    }

    return new Promise((resolve, reject) => {
      this.create(dest, options, (err, done) => (err ? reject(err) : resolve(done)));
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

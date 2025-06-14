import fs from 'fs';
import { type FileAttributes, FileEntry, type NoParamCallback, waitForAccess } from 'extract-base-iterator';
import oo from 'on-one';

import type { ExtractOptions, LockT, ZipFile } from './types.js';

export default class ZipFileEntry extends FileEntry {
  private lock: LockT;
  private entry: ZipFile;

  constructor(attributes: FileAttributes, entry: ZipFile, lock: LockT) {
    super(attributes);
    this.entry = entry;
    this.lock = lock;
    this.lock.retain();
  }

  create(dest: string, options: ExtractOptions | NoParamCallback, callback: NoParamCallback): undefined | Promise<boolean> {
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
      this.create(dest, options, (err?: Error, done?: boolean) => (err ? reject(err) : resolve(done)));
    });
  }

  _writeFile(fullPath: string, _options: ExtractOptions, callback: NoParamCallback): undefined {
    if (!this.entry) {
      callback(new Error('Zip FileEntry missing entry. Check for calling create multiple times'));
      return;
    }

    const res = this.entry.getStream().pipe(fs.createWriteStream(fullPath));
    oo(res, ['error', 'end', 'close', 'finish'], (err?: Error) => {
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

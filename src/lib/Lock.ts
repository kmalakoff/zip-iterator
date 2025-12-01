/**
 * Lock - Reference counting for entry lifecycle
 *
 * Ensures the iterator doesn't complete until all entries
 * have been processed.
 */

import BaseIterator from 'extract-base-iterator';
import fs from 'fs';
import type ZipExtract from '../zip/ZipExtract.ts';

export default class Lock {
  private count = 1;

  // members
  iterator: BaseIterator = null;
  err: Error = null;

  // cleanup resources
  tempPath: string = null;
  extract: ZipExtract = null;
  sourceStream: NodeJS.ReadableStream = null;

  // Processing setup function to prevent premature end() - removed in ZipIterator.end()
  setup: (() => undefined) | null = null;

  retain() {
    this.count++;
  }

  release() {
    if (this.count <= 0) throw new Error('Lock count is corrupted');
    this.count--;
    if (this.count === 0) this.__destroy();
  }

  private __destroy() {
    // 1. End the extract parser
    if (this.extract) {
      this.extract.end();
      this.extract = null;
    }

    // 2. Delete temp file
    if (this.tempPath) {
      fs.unlink(this.tempPath, () => {});
      this.tempPath = null;
    }

    // 3. Destroy source stream
    if (this.sourceStream) {
      const stream = this.sourceStream as NodeJS.ReadableStream & { destroy?: () => void };
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      this.sourceStream = null;
    }

    // 4. Call BaseIterator.end() LAST
    if (this.iterator) {
      BaseIterator.prototype.end.call(this.iterator, this.err || null);
      this.iterator = null;
    }
  }
}

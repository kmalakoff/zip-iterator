import BaseIterator from 'extract-base-iterator';
import fs from 'fs';
import os from 'os';
import osShim from 'os-shim';
import path from 'path';
import Queue from 'queue-cb';
import shortHash from 'short-hash';
import tempSuffix from 'temp-suffix';
import Lock from './lib/Lock.js';
import streamToFile from './lib/streamToFile.js';
import Zip from './lib/Zip.js';
import nextEntry from './nextEntry.js';

const tmpdir = os.tmpdir || osShim.tmpdir;

import type { AbstractZipFileIterator, ExtractOptions, LockT } from './types.js';

export default class ZipIterator extends BaseIterator<unknown> {
  private lock: LockT;
  private iterator: AbstractZipFileIterator;

  constructor(source: string | NodeJS.ReadableStream, options: ExtractOptions = {}) {
    super(options);
    this.lock = new Lock();
    this.lock.iterator = this;

    const queue = new Queue(1);
    let cancelled = false;
    const setup = (): undefined => {
      cancelled = true;
    };
    this.processing.push(setup);

    if (typeof source !== 'string') {
      this.lock.tempPath = path.join(tmpdir(), 'zip-iterator', shortHash(process.cwd()), tempSuffix('tmp.zip'));
      queue.defer(streamToFile.bind(null, source, this.lock.tempPath));
    }

    // open zip
    queue.defer((cb) => {
      fs.open(this.lock.tempPath || (source as string), 'r', '0666', (err, fd) => {
        if (this.done || cancelled) return; // done
        if (err) return cb(err);
        const reader = new Zip(fd);
        this.lock.fd = fd;
        this.iterator = reader.iterator();
        cb();
      });
    });

    // start processing
    queue.await((err) => {
      this.processing.remove(setup);
      if (this.done || cancelled) return; // done
      err ? this.end(err) : this.push(nextEntry);
    });
  }

  end(err?: Error) {
    if (this.lock) {
      this.lock.err = err;
      this.lock.release();
      this.lock = null;
    } else {
      BaseIterator.prototype.end.call(this, err); // call in lock release so end is properly handled
    }
    this.iterator = null;
  }
}

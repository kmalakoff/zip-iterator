const fs = require('fs');
const path = require('path');

const inherits = require('inherits');
const BaseIterator = require('extract-base-iterator').default;
const Queue = require('queue-cb');
const tmpdir = require('os').tmpdir || require('os-shim').tmpdir;
const shortHash = require('short-hash');
const tempSuffix = require('temp-suffix');

const nextEntry = require('./nextEntry.cjs');
const fifoRemove = require('./lib/fifoRemove.cjs');
const Zip = require('./lib/Zip.cjs');
const Lock = require('./lib/Lock.cjs');
const streamToFile = require('./lib/streamToFile.cjs');

function ZipIterator(source, options) {
  if (!(this instanceof ZipIterator)) return new ZipIterator(source, options);
  BaseIterator.call(this, options);
  this.lock = new Lock();
  this.lock.iterator = this;

  const queue = Queue(1);
  let cancelled = false;
  function setup() {
    cancelled = true;
  }
  this.processing.push(setup);

  if (typeof source !== 'string') {
    this.lock.tempPath = path.join(tmpdir(), 'zip-iterator', shortHash(process.cwd()), tempSuffix('tmp.zip'));
    queue.defer(streamToFile.bind(null, source, this.lock.tempPath));
  }

  // open zip
  queue.defer((callback) => {
    fs.open(this.lock.tempPath || source, 'r', '0666', (err, fd) => {
      if (this.done || cancelled) return; // done
      if (err) return callback(err);
      const reader = Zip(fd);
      this.lock.fd = fd;
      this.iterator = reader.iterator();
      callback();
    });
  });

  // start processing
  queue.await((err) => {
    fifoRemove(this.processing, setup);
    if (this.done || cancelled) return; // done
    err ? this.end(err) : this.push(nextEntry);
  });
}

inherits(ZipIterator, BaseIterator);

ZipIterator.prototype.end = function end(err) {
  if (this.lock) {
    this.lock.err = err;
    this.lock.release();
    this.lock = null;
  } else {
    BaseIterator.prototype.end.call(this, err); // call in lock release so end is properly handled
  }
  this.iterator = null;
};

module.exports = ZipIterator;

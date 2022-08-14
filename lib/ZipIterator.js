var fs = require('fs');
var path = require('path');

var inherits = require('inherits');
var BaseIterator = require('extract-base-iterator');
var Queue = require('queue-cb');
var tmpdir = require('os').tmpdir || require('os-shim').tmpdir;
var shortHash = require('short-hash');
var tempSuffix = require('temp-suffix');

var nextEntry = require('./nextEntry');
var fifoRemove = require('./lib/fifoRemove');
var Zip = require('./lib/Zip');
var Lock = require('./lib/Lock');
var streamToFile = require('./lib/streamToFile');

function ZipIterator(source, options) {
  if (!(this instanceof ZipIterator)) return new ZipIterator(source, options);
  BaseIterator.call(this, options);

  var self = this;
  this.lock = new Lock();
  this.lock.iterator = this;

  var queue = Queue(1);
  var cancelled = false;
  function setup() {
    cancelled = true;
  }
  this.processing.push(setup);

  if (typeof source !== 'string') {
    self.lock.tempPath = path.join(tmpdir(), 'zip-iterator', shortHash(process.cwd()), tempSuffix('tmp.zip'));
    queue.defer(streamToFile.bind(null, source, self.lock.tempPath));
  }

  // open zip
  queue.defer(function (callback) {
    fs.open(self.lock.tempPath || source, 'r', '0666', function (err, fd) {
      if (self.done || cancelled) return; // done
      if (err) return callback(err);
      var reader = Zip(fd);
      self.lock.fd = fd;
      self.iterator = reader.iterator();
      callback();
    });
  });

  // start processing
  queue.await(function (err) {
    fifoRemove(self.processing, setup);
    if (self.done || cancelled) return; // done
    err ? self.end(err) : self.push(nextEntry);
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

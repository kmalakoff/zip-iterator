var fs = require('fs');
var path = require('path');

var inherits = require('inherits');
var BaseIterator = require('extract-base-iterator');
var Queue = require('queue-cb');
var tempSuffix = require('temp-suffix');
var eos = require('end-of-stream');
var rimraf = require('rimraf');

var nextEntry = require('./nextEntry');
var fifoRemove = require('./fifoRemove');

var readerIterator = require('./reader/readerIterator');
var patchFdSource = require('./reader/patchFdSource');

var ZIP = require('zip');

function ZipIterator(source, options) {
  if (!(this instanceof ZipIterator)) return new ZipIterator(source, options);
  BaseIterator.call(this, options);

  var self = this;
  var queue = Queue(1);
  var cancelled = false;
  function setup() {
    cancelled = true;
  }
  this.processing.push(setup);

  if (typeof source !== 'string') {
    this.tempPath = self.options.tempPath || path.join(process.cwd(), tempSuffix('tmp.zip'));
    queue.defer(function (callback) {
      var data = null;
      function cleanup() {
        source.removeListener('error', onError);
      }
      function onError(err) {
        data = err;
        cleanup();
        callback(err);
      }
      source.on('error', onError);
      eos(source.pipe(fs.createWriteStream(self.tempPath)), function (err) {
        if (data) return;
        cleanup();
        callback(err);
      });
    });
  }

  // open zip
  queue.defer(function (callback) {
    fs.open(self.tempPath || source, 'r', '0666', function (err, fd) {
      if (err) return callback(err);
      var reader = ZIP.Reader(fd);
      patchFdSource(reader, fd);
      self.iterator = readerIterator(reader);
      callback();
    });
  });

  // start processing
  queue.await(function (err) {
    fifoRemove(self.processing, setup);
    if (self.done || cancelled) return;
    err ? self.end(err) : self.push(nextEntry);
  });
}

inherits(ZipIterator, BaseIterator);

ZipIterator.prototype.end = function end(err) {
  BaseIterator.prototype.end.call(this, err);

  if (this.tempPath) {
    try {
      rimraf.sync(this.tempPath);
    } catch (err) {
      /* empty */
    }
    this.tempPath = null;
  }
};

module.exports = ZipIterator;

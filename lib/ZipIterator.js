require('./patch');
var inherits = require('inherits');
var yauzl = require('yauzl');
var BaseIterator = require('extract-base-iterator');
var path = require('path');
var fs = require('fs');
var Queue = require('queue-cb');
var tempSuffix = require('temp-suffix');
var eos = require('end-of-stream');
var rimraf = require('rimraf');
var LC = require('lifecycle');

var nextEntry = require('./nextEntry');

var Lock = LC.RefCountable.extend({
  constructor: function () {
    LC.RefCountable.prototype.constructor.apply(this, arguments);
  },
  __destroy: function () {
    if (this.extract) {
      this.extract.close();
      this.extract = null;
    }
    if (this.tempPath) {
      try {
        rimraf.sync(this.tempPath);
      } catch (err) {}
      this.tempPath = null;
    }
  },
});

function ZipIterator(source, options) {
  if (!(this instanceof ZipIterator)) return new ZipIterator(source, options);
  BaseIterator.call(this, options);

  var self = this;
  var queue = Queue(1);
  self.processing++;
  self.lock = new Lock();

  if (typeof source !== 'string') {
    self.lock.tempPath = self.options.tempPath || path.join(process.cwd(), tempSuffix('tmp.zip'));
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
      eos(source.pipe(fs.createWriteStream(self.lock.tempPath)), function (err) {
        if (data) return;
        cleanup();
        callback(err);
      });
    });
  }

  // open zip
  queue.defer(function (callback) {
    yauzl.open(self.lock.tempPath || source, { lazyEntries: true, autoClose: false }, function (err, extract) {
      if (err) return callback(err);
      self.lock.extract = extract;
      callback();
    });
  });

  // start processing
  queue.await(function (err) {
    self.processing--;
    if (self.done) return;
    err ? self.end(err) : self.push(nextEntry);
  });
}

inherits(ZipIterator, BaseIterator);

ZipIterator.prototype.end = function end(err) {
  BaseIterator.prototype.end.call(this, err);
  this.lock.release();
};

module.exports = ZipIterator;

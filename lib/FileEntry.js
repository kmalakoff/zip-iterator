var inherits = require('inherits');
var BaseIterator = require('extract-base-iterator');
var fs = require('fs');
var eos = require('end-of-stream');

var waitForAccess = require('./waitForAccess');

function FileEntry(attributes, entry, lock) {
  BaseIterator.FileEntry.call(this, attributes);
  this.entry = entry;
  this.lock = lock;
  this.lock.retain();
}

inherits(FileEntry, BaseIterator.FileEntry);

FileEntry.prototype.create = function create(dest, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  var self = this;
  if (typeof callback === 'function') {
    options = options || {};
    return BaseIterator.FileEntry.prototype.create.call(this, dest, options, function createCallback(err) {
      if (self.lock) {
        self.lock.release();
        self.lock = null;
      }
      callback(err);
    });
  }

  return new Promise(function createPromise(resolve, reject) {
    self.create(dest, options, function createCallback(err, done) {
      err ? reject(err) : resolve(done);
    });
  });
};

FileEntry.prototype._writeFile = function _writeFile(fullPath, _, callback) {
  if (!this.entry) return callback(new Error('Zip FileEntry missing entry. Check for calling create multiple times'));

  var res = this.entry.getStream().pipe(fs.createWriteStream(fullPath));
  eos(res, function (err) {
    err ? callback(err) : waitForAccess(fullPath, callback); // gunzip stream returns prematurely occassionally
  });
};

FileEntry.prototype.destroy = function destroy() {
  BaseIterator.FileEntry.prototype.destroy.call(this);
  if (this.lock) {
    this.lock.release();
    this.lock = null;
  }
};

module.exports = FileEntry;

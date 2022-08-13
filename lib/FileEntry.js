var inherits = require('inherits');
var BaseIterator = require('extract-base-iterator');
var fs = require('fs');
var eos = require('end-of-stream');

var getStream = require('./reader/getStream');

function FileEntry(attributes, entry) {
  BaseIterator.FileEntry.call(this, attributes);
  this.entry = entry;
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
    return BaseIterator.FileEntry.prototype.create.call(this, dest, options, callback);
  }

  return new Promise(function createPromise(resolve, reject) {
    self.create(dest, options, function createCallback(err, done) {
      err ? reject(err) : resolve(done);
    });
  });
};

FileEntry.prototype._writeFile = function _writeFile(fullPath, _, callback) {
  if (!this.entry) return callback(new Error('Zip FileEntry missing entry. Check for calling create multiple times'));
  var stream = getStream(this.entry).pipe(fs.createWriteStream(fullPath))
  eos(stream, callback)
};

module.exports = FileEntry;

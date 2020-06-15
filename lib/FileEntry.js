var inherits = require('inherits');
var BaseIterator = require('extract-base-iterator');
var fs = require('fs');
var eos = require('end-of-stream');

var waitForAccess = require('./waitForAccess');

function FileEntry(attributes, extract, header) {
  BaseIterator.FileEntry.call(this, attributes);
  this.extract = extract;
  this.header = header;
}

inherits(FileEntry, BaseIterator.FileEntry);

FileEntry.prototype._writeFile = function _writeFile(fullPath, options, callback) {
  this.extract.openReadStream(this.header, function (err, stream) {
    if (err) return callback(err);

    var res = stream.pipe(fs.createWriteStream(fullPath));
    eos(res, function (err) {
      err ? callback(err) : waitForAccess(fullPath, callback); // gunzip stream returns prematurely occassionally
    });
  });
};

module.exports = FileEntry;

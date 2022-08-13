// adapted from https://github.com/kriskowal/zip/blob/master/zip.js

var Readable = require('stream').Readable;
var zlib = require('zlib');

module.exports = function getStream(entry) {
  // get buffer
  var bookmark = entry.stream.position();
  entry.stream.seek(entry.start);
  var buffer = entry.stream.read(entry.centralHeader.compressed_size);
  entry.stream.seek(bookmark);

  // create stream
  var stream = new Readable();
  stream._read = function () {};
  stream.push(buffer);
  stream.push(null);
  return entry.centralHeader.compression_method === 0 ? stream : stream.pipe(zlib.createInflateRaw());
};

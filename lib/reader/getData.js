// adapted from https://github.com/kriskowal/zip/blob/master/zip.js

module.exports = function getData(entry) {
  if (entry._stream == null) {
    var bookmark = entry.stream.position();
    entry.stream.seek(entry.start);
    entry._stream = entry.stream.readUncompressed(entry.centralHeader.compressed_size, entry.centralHeader.compression_method);
    entry.stream.seek(bookmark);
  }
  return entry._stream;
};

var ZipReader = require('zip').Reader;
var inherits = require('util').inherits;

var fs = require('graceful-fs');
var Readable = require('stream').Readable;
// var slice = require('stream-slice').slice;
var zlib = require('zlib');

function Zip(fd, filePath) {
  if (!(this instanceof Zip)) return new Zip(fd, filePath);
  ZipReader.call(this, fd);
  this._filePath = filePath;
  this._source = new FdSource(fd);
  this._offset = 0;
}
inherits(Zip, ZipReader);

function FdSource(fd) {
  var self = this;
  this.fd = fd;
  this._fileLength = fs.fstatSync(this.fd).size;
  this.length = function () {
    return self._fileLength;
  };
  this.read = function (start, length) {
    var result = Buffer.alloc(length);
    var pos = 0;
    while (length > 0) {
      var toRead = length > 8192 ? 8192 : length;
      fs.readSync(self.fd, result, pos, toRead, start);
      length -= toRead;
      start += toRead;
      pos += toRead;
    }
    return result;
  };
}

Zip.prototype.iterator = function () {
  var stream = this;

  // find the end record and read it
  stream.locateEndOfCentralDirectoryRecord();
  var endRecord = stream.readEndOfCentralDirectoryRecord();

  // seek to the beginning of the central directory
  stream.seek(endRecord.central_dir_offset);

  var count = endRecord.central_dir_disk_records;

  return {
    next: function () {
      if (count-- === 0) throw 'stop-iteration'; // eslint-disable-line no-throw-literal

      // read the central directory header
      var centralHeader = stream.readCentralDirectoryFileHeader();

      // save our new position so we can restore it
      var saved = stream.position();

      // seek to the local header and read it
      stream.seek(centralHeader.local_file_header_offset);
      var localHeader = stream.readLocalFileHeader();

      // dont read the content just save the position for later use
      var start = stream.position();

      // seek back to the next central directory header
      stream.seek(saved);

      return {
        localHeader: localHeader,
        stream: stream,
        start: start,
        centralHeader: centralHeader,
        lastModified: function () {
          return decodeDateTime(localHeader.last_mod_file_date, localHeader.last_mod_file_time);
        },
        getStream: function () {
          // get stream - streams create too many file hanldes - tried graceful-fs but it din't help
          // var res = fs.createReadStream(stream._filePath);
          // res = res.pipe(slice(start, start + centralHeader.compressed_size));

          // get buffer
          var bookmark = stream.position();
          stream.seek(start);
          var buffer = stream.read(centralHeader.compressed_size);
          stream.seek(bookmark);

          // create stream
          var res = new Readable();
          res._read = function () {};
          res.push(buffer);
          res.push(null);
          if (centralHeader.compression_method !== 0) res = res.pipe(zlib.createInflateRaw());
          return res;
        },
      };
    },
  };
};

module.exports = Zip;

var decodeDateTime = function (date, time) {
  return new Date((date >>> 9) + 1980, ((date >>> 5) & 15) - 1, date & 31, (time >>> 11) & 31, (time >>> 5) & 63, (time & 63) * 2);
};

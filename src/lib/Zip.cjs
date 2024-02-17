const ZipReader = require('zip').Reader;
const inherits = require('util').inherits;

const fs = require('fs');
const Readable = require('stream').Readable;
const zlib = require('zlib');

function Zip(fd, filePath) {
  if (!(this instanceof Zip)) return new Zip(fd, filePath);
  ZipReader.call(this, fd);

  // patch pos
  this._source.read = (start, length) => {
    const result = Buffer.alloc(length);
    let pos = 0;
    while (length > 0) {
      const toRead = Math.min(length, 8192);
      fs.readSync(fd, result, pos, toRead, start);
      length -= toRead;
      start += toRead;
      pos += toRead;
    }
    return result;
  };
}

inherits(Zip, ZipReader);

Zip.prototype.iterator = function () {
  const stream = this;

  // find the end record and read it
  stream.locateEndOfCentralDirectoryRecord();
  const endRecord = stream.readEndOfCentralDirectoryRecord();

  // seek to the beginning of the central directory
  stream.seek(endRecord.central_dir_offset);

  let count = endRecord.central_dir_disk_records;

  return {
    next: () => {
      if (count-- === 0) throw 'stop-iteration';

      // read the central directory header
      const centralHeader = stream.readCentralDirectoryFileHeader();

      // save our new position so we can restore it
      const saved = stream.position();

      // seek to the local header and read it
      stream.seek(centralHeader.local_file_header_offset);
      const localHeader = stream.readLocalFileHeader();

      // dont read the content just save the position for later use
      const start = stream.position();

      // seek back to the next central directory header
      stream.seek(saved);

      return {
        localHeader: localHeader,
        stream: stream,
        start: start,
        centralHeader: centralHeader,
        lastModified: () => decodeDateTime(localHeader.last_mod_file_date, localHeader.last_mod_file_time),
        getStream: () => {
          let offset = start;
          let remaining = centralHeader.compressed_size;
          let res = new Readable();
          res._read = function (size) {
            if (remaining <= 0) return this.push(null); // done
            if (size > remaining) size = remaining; // clamp
            const bookmark = stream.position(); // save
            stream.seek(offset);
            const chunk = stream.read(size);
            remaining -= size;
            offset += size;
            stream.seek(bookmark); // restore
            this.push(chunk);
          };
          if (centralHeader.compression_method !== 0) res = res.pipe(zlib.createInflateRaw());
          return res;
        },
      };
    },
  };
};

module.exports = Zip;

const decodeDateTime = (date, time) => new Date((date >>> 9) + 1980, ((date >>> 5) & 15) - 1, date & 31, (time >>> 11) & 31, (time >>> 5) & 63, (time & 63) * 2);

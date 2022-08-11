// adapted from https://github.com/kriskowal/zip/blob/master/zip.js

module.exports = function readerIterator(iterator) {
  var stream = iterator;

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
      };
    },
  };
};

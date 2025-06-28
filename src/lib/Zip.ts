import fs from 'fs';
import StreamCompat from 'readable-stream';
import { Buffer } from 'safe-buffer';
import Stream from 'stream';
import { Reader } from 'zip';
import zlib from 'zlib';

const major = +process.versions.node.split('.')[0];
const Readable = major > 0 ? Stream.Readable : (StreamCompat.Readable as typeof Stream.Readable);

const decodeDateTime = (date, time) => new Date((date >>> 9) + 1980, ((date >>> 5) & 15) - 1, date & 31, (time >>> 11) & 31, (time >>> 5) & 63, (time & 63) * 2);

interface Source {
  read(start: number, length: number): Buffer;
}

interface ReaderT {
  _source: Source;
}

import type { AbstractZipFileIterator } from '../types.ts';

export default class Zip extends Reader {
  constructor(fd: number) {
    super(fd);

    // patch pos
    (this as unknown as ReaderT)._source.read = (start, length) => {
      const result = Buffer.alloc(length);
      let pos = 0;
      while (length > 0) {
        const toRead = Math.min(length, 8192);
        fs.readSync(fd, result as unknown as NodeJS.ArrayBufferView, pos, toRead, start);
        length -= toRead;
        start += toRead;
        pos += toRead;
      }
      return result;
    };
  }

  iterator(): AbstractZipFileIterator {
    const stream = this as Reader;

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
  }
}

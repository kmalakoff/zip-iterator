import fs from 'fs';
import path from 'path';
import once from 'call-once-fn';
import mkdirp from 'mkdirp-classic';
import oo from 'on-one';

export default function streamToFile(source, filePath, callback) {
  mkdirp.sync(path.dirname(filePath)); // sync to not pause the stream

  const end = once(callback);
  source.on('error', end);
  const res = source.pipe(fs.createWriteStream(filePath));
  oo(res, ['error', 'end', 'close', 'finish'], end);
}

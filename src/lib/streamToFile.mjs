import fs from 'fs';
import path from 'path';
import once from 'call-once-fn';
import mkdirp from 'mkdirp-classic';

export default function streamToFile(source, filePath, callback) {
  mkdirp.sync(path.dirname(filePath)); // sync to not pause the stream

  const end = once(callback);
  source.on('error', end);
  const res = source.pipe(fs.createWriteStream(filePath));
  res.on('error', end);
  res.on('end', end);
  res.on('close', end);
  res.on('finish', end);
}

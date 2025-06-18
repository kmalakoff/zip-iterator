import once from 'call-once-fn';
import fs from 'fs';
import mkdirp from 'mkdirp-classic';
import oo from 'on-one';
import path from 'path';

export type Callback = (error?: Error) => undefined;

export default function streamToFile(source: NodeJS.ReadStream, filePath: string, callback: Callback): undefined {
  mkdirp.sync(path.dirname(filePath)); // sync to not pause the stream

  const end = once(callback);
  source.on('error', end);
  const res = source.pipe(fs.createWriteStream(filePath));
  oo(res, ['error', 'end', 'close', 'finish'], end);
}

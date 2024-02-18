import fs from 'fs';
import path from 'path';
import mkpath from 'mkpath';
import eos from 'end-of-stream';

export default function streamToFile(source, filePath, callback) {
  mkpath.sync(path.dirname(filePath)); // sync to not pause the stream
  let err = null;
  function cleanup() {
    source.removeListener('error', onError);
  }
  function onError(_err) {
    err = _err;
    cleanup();
    callback(err);
  }
  source.on('error', onError);
  eos(source.pipe(fs.createWriteStream(filePath)), (err) => {
    if (err) return;
    cleanup();
    callback(err);
  });
};

import 'buffer-v6-polyfill';

import Module from 'module';
import stream from 'stream';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;

if (!stream.Readable) {
  const patch = _require('readable-stream');
  stream.Readable = patch.Readable;
  stream.Writable = patch.Writable;
  stream.Transform = patch.Transform;
  stream.PassThrough = patch.PassThrough;
}

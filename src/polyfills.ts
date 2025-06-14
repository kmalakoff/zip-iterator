import 'buffer-v6-polyfill';
import stream from 'stream';

import Module from 'module';

const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;

if (!stream.Readable) {
  const patch = _require('readable-stream');
  stream.Readable = patch.Readable;
  stream.Writable = patch.Writable;
  stream.Transform = patch.Transform;
  stream.PassThrough = patch.PassThrough;
}

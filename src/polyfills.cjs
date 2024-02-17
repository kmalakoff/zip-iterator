require('buffer-v6-polyfill');

const stream = require('stream');
if (!stream.Readable) {
  const patch = require('readable-stream');
  stream.Readable = patch.Readable;
  stream.Writable = patch.Writable;
  stream.Transform = patch.Transform;
  stream.PassThrough = patch.PassThrough;
}

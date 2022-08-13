require('buffer-v6-polyfill');

var stream = require('stream');
if (!stream.Readable) {
  var patch = require('readable-stream');
  stream.Readable = patch.Readable;
  stream.Writable = patch.Writable;
  stream.Transform = patch.Transform;
  stream.PassThrough = patch.PassThrough;
}

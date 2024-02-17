const eos = require('end-of-stream');

module.exports = function streamToString(stream, callback) {
  let string = '';
  stream.on('data', (chunk) => {
    string += chunk.toString();
  });
  eos(stream, (err) => {
    err ? callback(err) : callback(null, string);
  });
};

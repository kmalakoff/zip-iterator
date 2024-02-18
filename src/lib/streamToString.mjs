import eos from 'end-of-stream';

export default function streamToString(stream, callback) {
  let string = '';
  stream.on('data', (chunk) => {
    string += chunk.toString();
  });
  eos(stream, (err) => {
    err ? callback(err) : callback(null, string);
  });
}

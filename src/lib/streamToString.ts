import oo from 'on-one';

export default function streamToString(stream, callback) {
  let string = '';
  stream.on('data', (chunk) => {
    string += chunk.toString();
  });
  oo(stream, ['error', 'end', 'close', 'finish'], (err) => {
    err ? callback(err) : callback(null, string);
  });
}

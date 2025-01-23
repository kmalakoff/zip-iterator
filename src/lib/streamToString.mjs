import once from 'call-once-fn';

export default function streamToString(stream, callback) {
  let string = '';
  stream.on('data', (chunk) => {
    string += chunk.toString();
  });
  const end = once((err) => {
    err ? callback(err) : callback(null, string);
  });
  stream.on('error', end);
  stream.on('end', end);
  stream.on('close', end);
  stream.on('finish', end);
}

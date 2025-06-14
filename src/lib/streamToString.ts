import oo from 'on-one';

export type Callback = (error?: Error, result?: string) => undefined;

export default function streamToString(stream: NodeJS.ReadStream, callback: Callback) {
  let string = '';
  stream.on('data', (chunk) => {
    string += chunk.toString();
  });
  oo(stream, ['error', 'end', 'close', 'finish'], (err?: Error) => {
    err ? callback(err) : callback(null, string);
  });
}

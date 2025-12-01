/**
 * Read entire stream content as string
 *
 * Handles both flowing streams and streams that have already
 * buffered data (using readable stream semantics).
 */

import oo from 'on-one';

export type Callback = (error?: Error, result?: string) => undefined;

export default function streamToString(stream: NodeJS.ReadableStream, callback: Callback) {
  const chunks: Buffer[] = [];

  // Handle data from the stream
  stream.on('data', (chunk: Buffer | string) => {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, 'utf8'));
    } else {
      chunks.push(chunk);
    }
  });

  // Handle stream end events using on-one for Node 0.8 compatibility
  oo(stream, ['error', 'end', 'close'], (err?: Error) => {
    if (err) {
      callback(err);
    } else {
      const content = Buffer.concat(chunks).toString('utf8');
      callback(null, content);
    }
  });

  // Ensure stream is flowing (in case it's paused)
  if (typeof (stream as NodeJS.ReadStream).resume === 'function') {
    (stream as NodeJS.ReadStream).resume();
  }
}

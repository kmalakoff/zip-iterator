/**
 * EntryEmitter - Entry stream creation and lifecycle management
 *
 * Handles creating PassThrough streams for entries and manages the
 * deferred error emission pattern for race conditions.
 */

import Stream from 'stream';

// Use readable-stream for Node 0.8 compatibility or native
const major = +process.versions.node.split('.')[0];
let PassThrough: typeof Stream.PassThrough;
try {
  if (major > 0) {
    PassThrough = Stream.PassThrough;
  } else {
    // Node 0.8/0.10 - use readable-stream
    PassThrough = require('readable-stream').PassThrough;
  }
} catch (_e) {
  PassThrough = Stream.PassThrough;
}

/**
 * Create a new entry stream
 *
 * Creates a PassThrough stream that is initially paused to prevent
 * data events from being lost before the consumer attaches listeners.
 */
export function createEntryStream(): Stream.PassThrough {
  const stream = new PassThrough();

  // Pause the output stream so data events aren't lost before consumer attaches listeners
  // Consumer should call resume() or attach listeners which will auto-resume
  if (typeof stream.pause === 'function') {
    stream.pause();
  }

  return stream;
}

/**
 * Emit error to a stream, deferring if no listeners are attached yet.
 *
 * This handles the race condition where the stream ends before the consumer
 * has a chance to attach error listeners (e.g., small truncated files).
 *
 * @param stream The stream to emit error to
 * @param err The error to emit
 */
export function emitErrorToStream(stream: NodeJS.EventEmitter, err: Error): void {
  // Check if there are already error listeners
  const hasListeners = stream.listeners && stream.listeners('error').length > 0;

  if (hasListeners) {
    // Emit immediately if listeners exist
    stream.emit('error', err);
  } else {
    // Defer emission: patch on/addListener to emit when listener is attached
    // Store error on stream object for deferred emission
    const streamWithError = stream as NodeJS.EventEmitter & { _deferredError?: Error };
    streamWithError._deferredError = err;

    // Wrap the on/addListener methods to check for deferred error
    const origOn = stream.on;

    const patchedOn = function (this: NodeJS.EventEmitter & { _deferredError?: Error }, event: string, listener: (...args: unknown[]) => void): NodeJS.EventEmitter {
      const result = origOn.call(this, event, listener);
      // If attaching error listener and we have a deferred error, emit it
      if (event === 'error' && this._deferredError) {
        const deferredErr = this._deferredError;
        this._deferredError = undefined;
        // Emit asynchronously to ensure listener is fully attached
        setTimeout(() => {
          this.emit('error', deferredErr);
        }, 0);
      }
      return result;
    };

    stream.on = patchedOn as typeof stream.on;
    stream.addListener = patchedOn as typeof stream.addListener;
  }
}

/**
 * Emit error to stream if it has listeners, otherwise use deferred emission
 *
 * @param stream The stream to emit error to
 * @param err The error to emit
 */
export function emitStreamError(stream: NodeJS.EventEmitter | null, err: Error): void {
  if (!stream) return;

  const listeners = stream.listeners && stream.listeners('error');
  if (listeners && listeners.length > 0) {
    stream.emit('error', err);
  } else {
    emitErrorToStream(stream, err);
  }
}

/**
 * End and clean up an entry stream
 *
 * @param stream The stream to end
 */
export function endEntryStream(stream: Stream.PassThrough | null): void {
  if (stream) {
    stream.end();
  }
}

/**
 * Export PassThrough for use in other modules
 */
export { PassThrough };

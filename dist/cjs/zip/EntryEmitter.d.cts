/**
 * EntryEmitter - Entry stream creation and lifecycle management
 *
 * Handles creating PassThrough streams for entries and manages the
 * deferred error emission pattern for race conditions.
 */
import type Stream from 'stream';
/**
 * Create a new entry stream
 *
 * Creates a PassThrough stream that is initially paused to prevent
 * data events from being lost before the consumer attaches listeners.
 */
export declare function createEntryStream(): Stream.PassThrough;
/**
 * Emit error to a stream, deferring if no listeners are attached yet.
 *
 * This handles the race condition where the stream ends before the consumer
 * has a chance to attach error listeners (e.g., small truncated files).
 * The parser detects errors synchronously before the consumer's forEach callback
 * has a chance to call entry.create() and attach listeners.
 *
 * @param stream The stream to emit error to
 * @param err The error to emit
 */
export declare function emitErrorToStream(stream: NodeJS.EventEmitter, err: Error): void;
/**
 * Emit error to stream if it has listeners, otherwise use deferred emission
 *
 * @param stream The stream to emit error to
 * @param err The error to emit
 */
export declare function emitStreamError(stream: NodeJS.EventEmitter | null, err: Error): void;
/**
 * End and clean up an entry stream
 *
 * @param stream The stream to end
 */
export declare function endEntryStream(stream: Stream.PassThrough | null): void;
/**
 * Export PassThrough for use in other modules
 */
export { PassThrough } from 'extract-base-iterator';

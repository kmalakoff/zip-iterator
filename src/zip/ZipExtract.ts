/**
 * ZipExtract - Forward-Only ZIP Parser
 *
 * Parses ZIP files in a single forward pass using Local File Headers.
 * Does not require seeking or the Central Directory.
 *
 * Uses native zlib on Node 0.11.12+, falls back to pako for older versions
 *
 * State Machine:
 * ```
 *  SIGNATURE ──┬── LOCAL_HEADER ── FILE_DATA ──┬── DATA_DESCRIPTOR ──┐
 *              │                               │                     │
 *              └───────────────────────────────┴─────────────────────┘
 *              │
 *              └── CENTRAL_DIR/END ── FINISHED
 * ```
 *
 * State Transitions:
 * - SIGNATURE: Reads 4-byte signature to determine next state
 *   - Local File Header (0x04034b50) → LOCAL_HEADER
 *   - Central Directory (0x02014b50) → FINISHED
 *   - End of Central Dir (0x06054b50) → FINISHED
 *
 * - LOCAL_HEADER: Parses header, creates entry stream → FILE_DATA
 *
 * - FILE_DATA: Streams or buffers file content
 *   - Known size: reads bytesRemaining bytes → SIGNATURE
 *   - Data descriptor: scans for boundary → DATA_DESCRIPTOR
 *
 * - DATA_DESCRIPTOR: Parses descriptor, verifies CRC → SIGNATURE
 *
 * Events:
 *   'entry' (header: LocalFileHeader, stream: Readable, next: () => void)
 *   'error' (err: Error)
 *   'finish' ()
 */

import { EventEmitter } from 'events';
import { BufferList, crc32, inflateRaw } from 'extract-base-iterator';
import type Stream from 'stream';
import { DeflateStreamHandler } from './compression/DeflateStream.ts';
import { StoreHandler } from './compression/StoreStream.ts';
import type { CompressionHandler } from './compression/types.ts';
import * as C from './constants.ts';
import { findDeflateBoundary, findStoreDataEnd, getSafetyBufferSize } from './DataDescriptorParser.ts';
import { createEntryStream, emitErrorToStream, emitStreamError } from './EntryEmitter.ts';
import { type LocalFileHeader, parseDataDescriptor, parseLocalFileHeader } from './headers.ts';

// =============================================================================
// Types
// =============================================================================

export interface ZipExtractOptions {
  /** Encoding for filenames when UTF-8 flag is not set (default: 'utf8') */
  filenameEncoding?: BufferEncoding;
  /** Verify CRC32 checksums (default: true) */
  verifyCrc?: boolean;
  /**
   * Maximum buffer size for data descriptor entries (entries without known size).
   * This prevents zip bomb attacks where huge compressed data is buffered.
   * Set to 0 or Infinity to disable (not recommended).
   * Default: 104857600 (100MB)
   */
  maxDataDescriptorBuffer?: number;
}

const State = {
  SIGNATURE: 0,
  LOCAL_HEADER: 1,
  FILE_DATA: 2,
  DATA_DESCRIPTOR: 3,
  FINISHED: 4,
} as const;

type State = (typeof State)[keyof typeof State];

// =============================================================================
// ZipExtract Class
// =============================================================================

export default class ZipExtract extends EventEmitter {
  private options: ZipExtractOptions;
  private buffer: BufferList;
  private state: State;
  private currentHeader: LocalFileHeader | null;
  private currentStream: Stream.PassThrough | null;
  private bytesRemaining: number;
  private locked: boolean;
  private ended: boolean;
  // Compression handler for current entry (known-size entries only)
  private compressionHandler: CompressionHandler | null;
  // Buffer for data descriptor entries (unknown size - need to scan for boundaries)
  private compressedChunks: Buffer[] | null;
  // Track total size of compressedChunks for memory limit enforcement
  private compressedChunksSize: number;
  // Running CRC for data descriptor entries
  private runningCrc: number;
  // Expected CRC from header
  private expectedCrc: number;

  constructor(options: ZipExtractOptions = {}) {
    super();
    this.options = options;
    this.buffer = new BufferList();
    this.state = State.SIGNATURE;
    this.currentHeader = null;
    this.currentStream = null;
    this.bytesRemaining = 0;
    this.locked = false;
    this.ended = false;
    this.compressionHandler = null;
    this.compressedChunks = null;
    this.compressedChunksSize = 0;
    this.runningCrc = 0;
    this.expectedCrc = 0;
  }

  /**
   * Write chunk to parser
   */
  write(chunk: Buffer, callback?: () => void): boolean {
    if (this.ended) {
      if (callback) callback();
      return false;
    }

    this.buffer.append(chunk);
    this.process();

    if (callback) callback();
    return !this.locked;
  }

  /**
   * Signal end of input
   */
  end(callback?: () => void): void {
    // Guard against re-entrant calls (can happen when error handler triggers cleanup)
    if (this.ended) {
      if (callback) callback();
      return;
    }
    this.ended = true;

    // Check if we're waiting for async compression completion
    const waitingForAsync = this.compressionHandler?.isWaiting() ?? false;

    // If we have an active stream and we're in FILE_DATA state, the archive is truncated
    // This handles the case where consumer called next() early but stream data is incomplete
    // Exception: if we're waiting for async inflate completion, that's not truncation
    if (this.currentStream && this.state === State.FILE_DATA && !waitingForAsync) {
      const err = C.createZipError(this.bytesRemaining > 0 ? `Truncated archive: expected ${this.bytesRemaining} more bytes of file data` : 'Truncated archive: unexpected end of file data', C.ZipErrorCode.TRUNCATED_ARCHIVE);
      const stream = this.currentStream;
      this.currentStream = null;
      // Emit error to stream - use deferred emission if no listeners yet
      // This handles the race condition where end() is called before consumer attaches listeners
      // NOTE: We do NOT call stream.end() here - the error should prevent normal completion
      emitErrorToStream(stream as NodeJS.EventEmitter, err);
      // Emit to ZipExtract for iterator-level error handling
      this.emitError(err);
      if (callback) callback();
      return;
    }

    // If not locked, process remaining data (process() will call checkEndState() when appropriate)
    if (!this.locked) {
      this.process();
    } else {
      // Even when locked, check for truncation in data-consuming states
      // This handles the case where we're waiting for file data that will never arrive
      this.checkLockedEndState();
    }

    if (callback) callback();
  }

  /**
   * Check for truncation when input ends while locked
   * This catches premature EOF during file data streaming
   */
  private checkLockedEndState(): void {
    // If we're in FILE_DATA state and waiting for more data, that's a truncation
    if (this.state === State.FILE_DATA) {
      const header = this.currentHeader;
      if (header) {
        if (header.hasDataDescriptor) {
          // For data descriptor entries, we're waiting for boundary signatures
          // If input ends, it's truncated
          this.emitError(C.createZipError('Truncated archive: unexpected end of file data', C.ZipErrorCode.TRUNCATED_ARCHIVE));
        } else if (this.bytesRemaining > 0) {
          // For known-size entries, if we still need data, it's truncated
          this.emitError(C.createZipError(`Truncated archive: expected ${this.bytesRemaining} more bytes of file data`, C.ZipErrorCode.TRUNCATED_ARCHIVE));
        } else {
          // bytesRemaining is 0 or negative - entry data was complete
          // This shouldn't normally happen when locked, but just in case
          this.finishKnownSizeEntry();
        }
      }
    } else if (this.state === State.DATA_DESCRIPTOR) {
      // Waiting for data descriptor that won't arrive
      this.emitError(C.createZipError('Truncated archive: unexpected end while reading data descriptor', C.ZipErrorCode.TRUNCATED_ARCHIVE));
    }
  }

  /**
   * Check if we ended in a valid state
   */
  private checkEndState(): void {
    if (this.state === State.FINISHED) {
      return; // Already finished
    }

    // SIGNATURE state with empty buffer is valid (between entries or empty archive)
    if (this.state === State.SIGNATURE && this.buffer.length === 0) {
      this.finish();
      return;
    }

    // SIGNATURE state with data but no valid signature means we hit central directory or EOF
    if (this.state === State.SIGNATURE && this.buffer.length > 0) {
      // Check if it's the central directory (normal end)
      if (this.buffer.startsWith(C.SIG_CENTRAL_DIR) || this.buffer.startsWith(C.SIG_END_OF_CENTRAL_DIR)) {
        this.finish();
        return;
      }
    }

    // Any other state is unexpected
    this.emitError(C.createZipError(`Unexpected end of input in state: ${this.state}`, C.ZipErrorCode.TRUNCATED_ARCHIVE));
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private process(): void {
    // Process as much as we can from the buffer
    // Note: locked only prevents starting NEW entries, not processing current entry's data
    while (true) {
      const processed = this.processState();
      if (!processed) break;
    }

    // If input has ended and we're not processing an entry, check if we finished properly
    // Note: locked may be false even with currentStream set (consumer called next() early)
    // In that case, we're still actively processing file data and shouldn't error yet
    if (this.ended && !this.locked && !this.currentStream) {
      this.checkEndState();
    }
  }

  private processState(): boolean {
    switch (this.state) {
      case State.SIGNATURE:
        return this.processSignature();
      case State.LOCAL_HEADER:
        return this.processLocalHeader();
      case State.FILE_DATA:
        return this.processFileData();
      case State.DATA_DESCRIPTOR:
        return this.processDataDescriptor();
      case State.FINISHED:
        return false;
      default:
        return false;
    }
  }

  /**
   * Detect what signature comes next
   */
  private processSignature(): boolean {
    // Don't start a new entry while locked (waiting for consumer to call next())
    if (this.locked) {
      return false;
    }

    if (this.buffer.length < C.SIGNATURE_SIZE) {
      return false;
    }

    // Check for Local File Header
    if (this.buffer.startsWith(C.SIG_LOCAL_FILE)) {
      this.state = State.LOCAL_HEADER;
      return true;
    }

    // Check for Central Directory (end of entries)
    if (this.buffer.startsWith(C.SIG_CENTRAL_DIR)) {
      this.finish();
      return false;
    }

    // Check for End of Central Directory (empty archive)
    if (this.buffer.startsWith(C.SIG_END_OF_CENTRAL_DIR)) {
      this.finish();
      return false;
    }

    // Unknown signature
    this.emitError(C.createZipError(`Invalid ZIP signature: 0x${this.buffer.slice(0, 4).toString('hex')}`, C.ZipErrorCode.INVALID_SIGNATURE));
    return false;
  }

  /**
   * Parse Local File Header
   */
  private processLocalHeader(): boolean {
    // Check if we have minimum header size
    if (this.buffer.length < C.LOCAL_HEADER_FIXED_SIZE) {
      return false;
    }

    // Use zero-copy reads to get filename and extra field lengths
    // This avoids allocating buffers for the entire header parse
    const fileNameLength = this.buffer.readUInt16LEAt(26);
    const extraFieldLength = this.buffer.readUInt16LEAt(28);

    if (fileNameLength === null || extraFieldLength === null) {
      return false; // Need more data
    }

    const headerSize = C.LOCAL_HEADER_FIXED_SIZE + fileNameLength + extraFieldLength;

    // Read exactly what's needed using readBytesAt (zero-copy for most cases)
    const buf = this.buffer.readBytesAt(0, headerSize);

    // parseLocalFileHeader expects a contiguous buffer
    const header = parseLocalFileHeader(buf, 0);

    if (!header) {
      return false; // Need more data
    }

    // Check for encryption (traditional or strong/AES)
    if (header.isEncrypted || header.isStrongEncrypted) {
      this.emitError(C.createZipError('Encrypted ZIP entries are not supported', C.ZipErrorCode.ENCRYPTED_ENTRY));
      return false;
    }

    // Check for supported compression method
    if (header.compressionMethod !== C.METHOD_STORE && header.compressionMethod !== C.METHOD_DEFLATE) {
      this.emitError(C.createZipError(`Unsupported compression method: ${header.compressionMethod}`, C.ZipErrorCode.UNSUPPORTED_METHOD));
      return false;
    }

    // Consume header from buffer
    this.buffer.skip(header.headerSize);

    this.currentHeader = header;

    // Determine how to handle file data
    if (header.hasDataDescriptor) {
      // Sizes unknown - need to handle specially
      this.bytesRemaining = -1;
    } else {
      this.bytesRemaining = header.compressedSize;
    }

    // Create entry stream
    this.createAndEmitEntryStream();

    return true;
  }

  /**
   * Create and emit entry stream
   */
  private createAndEmitEntryStream(): void {
    const header = this.currentHeader;
    if (!header) return;

    // Create output stream (paused to prevent data loss before consumer attaches)
    const entryStream = createEntryStream();
    this.currentStream = entryStream;

    // Initialize CRC state
    this.runningCrc = 0;
    this.expectedCrc = header.crc32;

    // For data descriptor entries, we need to buffer for boundary scanning
    if (header.hasDataDescriptor) {
      this.compressedChunks = [];
      this.compressionHandler = null;
    } else if (header.compressedSize === 0) {
      // No data to decompress - end stream immediately
      this.compressedChunks = null;
      this.compressionHandler = null;
      entryStream.end();
    } else {
      // Known size with data: use compression handlers for streaming
      this.compressedChunks = null;
      const handlerOptions = {
        outputStream: entryStream,
        onComplete: () => this.onCompressionComplete(),
        onError: (err: Error) => this.emitError(err),
        verifyCrc: this.options.verifyCrc,
      };

      if (header.compressionMethod === C.METHOD_DEFLATE) {
        this.compressionHandler = new DeflateStreamHandler(handlerOptions);
      } else {
        this.compressionHandler = new StoreHandler(handlerOptions);
      }
    }

    // Lock until consumer calls next()
    this.locked = true;
    this.state = State.FILE_DATA;

    this.emit('entry', header, entryStream, () => this.unlock());
  }

  /**
   * Called when compression handler completes (async for DEFLATE)
   */
  private onCompressionComplete(): void {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }

    // Clean up compression handler
    if (this.compressionHandler) {
      this.compressionHandler.destroy();
      this.compressionHandler = null;
    }

    this.currentHeader = null;
    this.state = State.SIGNATURE;

    // Resume processing to handle next entry
    this.process();
  }

  /**
   * Process file data
   */
  private processFileData(): boolean {
    const header = this.currentHeader;
    if (!header) return false;

    if (header.hasDataDescriptor) {
      // Unknown size - handle based on compression method
      if (header.compressionMethod === C.METHOD_DEFLATE) {
        return this.processDeflateDataDescriptor();
      }
      return this.processStoreDataDescriptor();
    }
    // Known size - simple case
    return this.processKnownSizeData();
  }

  /**
   * Process file data when size is known
   */
  private processKnownSizeData(): boolean {
    if (this.bytesRemaining <= 0) {
      return this.finishKnownSizeEntry();
    }

    const available = Math.min(this.buffer.length, this.bytesRemaining);
    if (available === 0) {
      return false;
    }

    const chunk = this.buffer.consume(available);
    this.bytesRemaining -= available;

    // Use compression handler for known-size entries
    if (this.compressionHandler) {
      this.compressionHandler.write(chunk);
    }

    if (this.bytesRemaining <= 0) {
      return this.finishKnownSizeEntry();
    }

    return true;
  }

  /**
   * Finish a known-size entry
   */
  private finishKnownSizeEntry(): boolean {
    // If compression handler is waiting for async completion, wait
    if (this.compressionHandler?.isWaiting()) {
      return false;
    }

    // Use compression handler's finish method (handles CRC verification)
    if (this.compressionHandler) {
      const result = this.compressionHandler.finish(this.expectedCrc);
      // If async, return false to wait for onCompressionComplete callback
      return result.continue;
    }

    // No compression handler means we shouldn't be here for known-size entries
    this.finishEntry();
    return true;
  }

  /**
   * Process DEFLATE data with data descriptor
   *
   * Since we don't know the compressed size upfront, we buffer data and scan
   * for boundary signatures (next entry or central directory) to find where
   * the compressed data ends. Once found, we inflate the data.
   */
  private processDeflateDataDescriptor(): boolean {
    // Initialize buffer for compressed data
    if (this.compressedChunks === null) {
      this.compressedChunks = [];
      this.compressedChunksSize = 0;
    }

    if (this.buffer.length === 0) {
      return false;
    }

    // Consume into our accumulator
    const chunk = this.buffer.consume(this.buffer.length);
    this.compressedChunks.push(chunk);
    this.compressedChunksSize += chunk.length;

    // Check memory limit (default 100MB)
    const maxBuffer = this.options.maxDataDescriptorBuffer ?? 104857600;
    if (maxBuffer > 0 && this.compressedChunksSize > maxBuffer) {
      this.emitError(C.createZipError(`Data descriptor entry exceeds buffer limit: ${this.compressedChunksSize} > ${maxBuffer}`, C.ZipErrorCode.BUFFER_OVERFLOW));
      return false;
    }

    // Combine all chunks to search for boundaries
    const combined = Buffer.concat(this.compressedChunks);

    // Find boundary using DataDescriptorParser
    const isZip64 = this.currentHeader?.isZip64 ?? false;
    const boundary = findDeflateBoundary(combined, isZip64);

    if (!boundary) {
      // No boundary found yet - keep buffering
      // Store combined buffer for efficiency
      this.compressedChunks = [combined];
      return false;
    }

    // Compressed data is from 0 to dataEnd
    const compressedData = combined.slice(0, boundary.dataEnd);

    // Data descriptor + rest goes back to buffer for normal parsing
    const remainder = combined.slice(boundary.dataEnd);
    this.buffer.prepend(remainder);

    // Clean up compressed chunks since we've extracted what we need
    this.compressedChunks = null;
    this.compressedChunksSize = 0;

    // Decompress and emit to consumer
    try {
      const decompressed = inflateRaw(compressedData);
      this.finishDeflateEntry(decompressed);
    } catch (err) {
      this.emitError(err as Error);
      return false;
    }
    return true;
  }

  /**
   * Complete a DEFLATE data descriptor entry after decompression
   */
  private finishDeflateEntry(decompressed: Buffer): void {
    // Calculate CRC of decompressed data for verification after data descriptor is parsed
    if (this.options.verifyCrc !== false) {
      this.runningCrc = crc32(decompressed);
    }

    if (this.currentStream) {
      this.currentStream.write(decompressed);
      this.currentStream.end();
      this.currentStream = null;
    }

    // Move to data descriptor parsing
    this.state = State.DATA_DESCRIPTOR;
  }

  /**
   * Process STORE data with data descriptor
   *
   * STORE has no internal end markers, so we need to scan for the
   * data descriptor signature or next local header.
   */
  private processStoreDataDescriptor(): boolean {
    const isZip64 = this.currentHeader?.isZip64 ?? false;
    const dataEnd = findStoreDataEnd(this.buffer, isZip64);

    if (dataEnd < 0) {
      // Haven't found end yet - emit all but a safety buffer
      // Keep enough bytes to detect signatures
      const safetyBuffer = getSafetyBufferSize();
      if (this.buffer.length > safetyBuffer) {
        const toEmit = this.buffer.length - safetyBuffer;
        const chunk = this.buffer.consume(toEmit);
        // Track CRC as data is emitted
        if (this.options.verifyCrc !== false) {
          this.runningCrc = crc32(chunk, this.runningCrc);
        }
        if (this.currentStream) {
          this.currentStream.write(chunk);
        }
      }
      return false;
    }

    // Emit file data up to the descriptor
    if (dataEnd > 0) {
      const chunk = this.buffer.consume(dataEnd);
      // Calculate CRC for STORE data descriptor entries
      if (this.options.verifyCrc !== false) {
        this.runningCrc = crc32(chunk, this.runningCrc);
      }
      if (this.currentStream) {
        this.currentStream.write(chunk);
        this.currentStream.end();
        this.currentStream = null;
      }
    }

    this.state = State.DATA_DESCRIPTOR;
    return true;
  }

  /**
   * Process data descriptor
   */
  private processDataDescriptor(): boolean {
    const header = this.currentHeader;
    if (!header) return false;
    const isZip64 = header.isZip64;

    // Data descriptors are small (12-24 bytes), always use slice() to avoid copying large BufferLists
    const maxDescriptorSize = isZip64 ? 32 : 24; // Safe upper bound
    const buf = this.buffer.slice(0, Math.min(this.buffer.length, maxDescriptorSize));
    const descriptor = parseDataDescriptor(buf, 0, isZip64);

    if (!descriptor) {
      return false; // Need more data
    }

    // Verify CRC using the CRC from data descriptor
    if (this.options.verifyCrc !== false) {
      if (this.runningCrc !== descriptor.crc32) {
        this.emitError(C.createZipError(`CRC32 mismatch: expected ${descriptor.crc32.toString(16)}, got ${this.runningCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
        return false;
      }
    }

    // Consume descriptor
    this.buffer.skip(descriptor.size);

    // Finish the entry
    this.finishEntry();
    return true;
  }

  /**
   * Finish current entry
   */
  private finishEntry(): void {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }

    // Clean up compression handler
    if (this.compressionHandler) {
      this.compressionHandler.destroy();
      this.compressionHandler = null;
    }

    // Clean up data descriptor buffers
    this.compressedChunks = null;
    this.compressedChunksSize = 0;

    // Reset CRC state
    this.runningCrc = 0;
    this.expectedCrc = 0;

    this.currentHeader = null;
    this.state = State.SIGNATURE;
  }

  /**
   * Unlock and continue processing
   */
  private unlock(): void {
    this.locked = false;
    this.process();
  }

  /**
   * Emit error and stop
   */
  private emitError(err: Error): void {
    this.state = State.FINISHED;

    // Propagate error to current entry stream so consumers receive it
    // Uses emitStreamError which handles both immediate and deferred emission
    if (this.currentStream) {
      const stream = this.currentStream;
      this.currentStream = null;
      emitStreamError(stream as NodeJS.EventEmitter, err);
    }

    // Clean up state
    if (this.compressionHandler) {
      this.compressionHandler.destroy();
      this.compressionHandler = null;
    }
    this.compressedChunks = null;
    this.compressedChunksSize = 0;
    this.currentHeader = null;

    this.emit('error', err);
  }

  /**
   * Signal completion
   */
  private finish(): void {
    if (this.state === State.FINISHED) return;
    this.state = State.FINISHED;
    this.emit('finish');
  }
}

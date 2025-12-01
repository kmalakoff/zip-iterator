/**
 * ZipExtract - Forward-Only ZIP Parser
 *
 * Parses ZIP files in a single forward pass using Local File Headers.
 * Does not require seeking or the Central Directory.
 *
 * Uses pako for pure JavaScript decompression (works on all Node versions)
 *
 * Events:
 *   'entry' (header: LocalFileHeader, stream: Readable, next: () => void)
 *   'error' (err: Error)
 *   'finish' ()
 */

import { EventEmitter } from 'events';
import { bufferFrom, crc32 } from 'extract-base-iterator';
import pako from 'pako';
import Stream from 'stream';
import BufferList from './BufferList.ts';
import * as C from './constants.ts';
import { type LocalFileHeader, parseDataDescriptor, parseLocalFileHeader } from './headers.ts';

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

// =============================================================================
// Types
// =============================================================================

export interface ZipExtractOptions {
  /** Encoding for filenames when UTF-8 flag is not set (default: 'utf8') */
  filenameEncoding?: BufferEncoding;
  /** Verify CRC32 checksums (default: true) */
  verifyCrc?: boolean;
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
  // For DEFLATE: buffer compressed data until we have it all
  private compressedChunks: Buffer[] | null;
  // Running CRC for verification
  private runningCrc: number;
  // Expected CRC from header or data descriptor
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
    this.compressedChunks = null;
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

    // If we have an active stream and we're in FILE_DATA state, the archive is truncated
    // This handles the case where consumer called next() early but stream data is incomplete
    if (this.currentStream && this.state === State.FILE_DATA) {
      const err = C.createZipError(this.bytesRemaining > 0 ? `Truncated archive: expected ${this.bytesRemaining} more bytes of file data` : 'Truncated archive: unexpected end of file data', C.ZipErrorCode.TRUNCATED_ARCHIVE);
      // End the stream and emit error
      const stream = this.currentStream as NodeJS.WritableStream & { end?: () => void };
      this.currentStream = null;
      // End the stream (PassThrough is a writable, so end() signals EOF to readers)
      if (typeof stream.end === 'function') {
        stream.end();
      }
      // Emit error to stream if it has listeners
      if ((stream as NodeJS.EventEmitter).listeners && (stream as NodeJS.EventEmitter).listeners('error').length > 0) {
        stream.emit('error', err);
      }
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
    const header = parseLocalFileHeader(this.buffer.toBuffer(), 0);

    if (!header) {
      return false; // Need more data
    }

    // Check for encryption
    if (header.isEncrypted) {
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
    this.createEntryStream();

    return true;
  }

  /**
   * Create and emit entry stream
   */
  private createEntryStream(): void {
    const header = this.currentHeader;
    if (!header) return;

    // Create output stream
    const entryStream = new PassThrough();
    this.currentStream = entryStream;

    // Initialize CRC state
    this.runningCrc = 0;
    this.expectedCrc = header.crc32;

    // For DEFLATE, we'll buffer compressed data and decompress with pako
    if (header.compressionMethod === C.METHOD_DEFLATE) {
      this.compressedChunks = [];
    }

    // Lock until consumer calls next()
    this.locked = true;
    this.state = State.FILE_DATA;

    // Pause the output stream so data events aren't lost before consumer attaches listeners
    // Consumer should call resume() or attach listeners which will auto-resume
    if (typeof entryStream.pause === 'function') {
      entryStream.pause();
    }

    this.emit('entry', header, entryStream, () => this.unlock());
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

    // If buffering compressed data for DEFLATE
    if (this.compressedChunks !== null) {
      this.compressedChunks.push(chunk);
    } else if (this.currentStream) {
      // STORE - write directly and calculate running CRC
      if (this.options.verifyCrc !== false) {
        this.runningCrc = crc32(chunk, this.runningCrc);
      }
      this.currentStream.write(chunk);
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
    // If we have buffered compressed data (DEFLATE), decompress now
    if (this.compressedChunks !== null && this.compressedChunks.length > 0) {
      const compressedData = Buffer.concat(this.compressedChunks);
      this.compressedChunks = null;

      try {
        // Use pako for synchronous decompression (works on all Node versions)
        const decompressed = pako.inflateRaw(compressedData);
        const decompressedBuf = bufferFrom(decompressed);

        // Verify CRC if enabled
        if (this.options.verifyCrc !== false) {
          const actualCrc = crc32(decompressedBuf);
          if (actualCrc !== this.expectedCrc) {
            this.emitError(C.createZipError(`CRC32 mismatch: expected ${this.expectedCrc.toString(16)}, got ${actualCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
            return false;
          }
        }

        if (this.currentStream) {
          this.currentStream.write(decompressedBuf);
        }
      } catch (err) {
        this.emitError(err as Error);
        return false;
      }
    } else if (this.options.verifyCrc !== false) {
      // For STORE entries, verify CRC from running calculation
      if (this.runningCrc !== this.expectedCrc) {
        this.emitError(C.createZipError(`CRC32 mismatch: expected ${this.expectedCrc.toString(16)}, got ${this.runningCrc.toString(16)}`, C.ZipErrorCode.CRC_MISMATCH));
        return false;
      }
    }

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
    }

    if (this.buffer.length === 0) {
      return false;
    }

    // Consume into our accumulator
    const chunk = this.buffer.consume(this.buffer.length);
    this.compressedChunks.push(chunk);

    // Combine all chunks to search for boundaries
    const combined = Buffer.concat(this.compressedChunks);

    // Look for next structure signature (definitive end markers)
    let boundaryPos = -1;
    for (const sig of [C.SIG_LOCAL_FILE, C.SIG_CENTRAL_DIR, C.SIG_END_OF_CENTRAL_DIR]) {
      const pos = this.bufferIndexOf(combined, sig);
      if (pos >= 0 && (boundaryPos < 0 || pos < boundaryPos)) {
        boundaryPos = pos;
      }
    }

    if (boundaryPos < 0) {
      // No boundary found yet - keep buffering
      // Store combined buffer for efficiency
      this.compressedChunks = [combined];
      return false;
    }

    // Found boundary! Data descriptor is immediately before it
    const isZip64 = this.currentHeader?.isZip64;
    const descSize = isZip64 ? C.ZIP64_DATA_DESCRIPTOR_SIZE : C.DATA_DESCRIPTOR_SIZE;
    const _descSizeWithSig = descSize + C.SIGNATURE_SIZE;

    // Check if data descriptor has optional signature
    let descStart = boundaryPos - descSize;
    if (descStart >= C.SIGNATURE_SIZE) {
      // Check for data descriptor signature
      if (combined[descStart - 4] === C.SIG_DATA_DESCRIPTOR[0] && combined[descStart - 3] === C.SIG_DATA_DESCRIPTOR[1] && combined[descStart - 2] === C.SIG_DATA_DESCRIPTOR[2] && combined[descStart - 1] === C.SIG_DATA_DESCRIPTOR[3]) {
        descStart -= C.SIGNATURE_SIZE;
      }
    }

    if (descStart < 0) {
      // Not enough data - this shouldn't happen with valid ZIP
      this.compressedChunks = [combined];
      return false;
    }

    // Compressed data is from 0 to descStart
    const compressedData = combined.slice(0, descStart);

    // Data descriptor + rest goes back to buffer for normal parsing
    const remainder = combined.slice(descStart);
    this.buffer.prepend(remainder);

    // Clean up compressed chunks since we've extracted what we need
    this.compressedChunks = null;

    // Decompress using pako and emit to consumer
    try {
      const decompressed = pako.inflateRaw(compressedData);
      this.finishDeflateEntry(bufferFrom(decompressed));
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
   * Search for byte sequence in buffer
   */
  private bufferIndexOf(buf: Buffer, sig: number[]): number {
    if (sig.length === 0) return 0;
    if (buf.length < sig.length) return -1;

    outer: for (let i = 0; i <= buf.length - sig.length; i++) {
      for (let j = 0; j < sig.length; j++) {
        if (buf[i + j] !== sig[j]) {
          continue outer;
        }
      }
      return i;
    }
    return -1;
  }

  /**
   * Process STORE data with data descriptor
   *
   * STORE has no internal end markers, so we need to scan for the
   * data descriptor signature or next local header.
   */
  private processStoreDataDescriptor(): boolean {
    // Look for data descriptor signature
    const descriptorPos = this.buffer.indexOf(C.SIG_DATA_DESCRIPTOR);

    // Also look for next local header as a boundary
    const nextHeaderPos = this.buffer.indexOf(C.SIG_LOCAL_FILE);

    // Determine where data ends
    let dataEnd = -1;

    if (descriptorPos >= 0) {
      dataEnd = descriptorPos;
    }

    if (nextHeaderPos >= 0) {
      // If we found a header before descriptor, the descriptor might not have signature
      if (dataEnd < 0 || nextHeaderPos < dataEnd) {
        // Try to find descriptor without signature before the header
        // The descriptor is 12 bytes (or 20 for ZIP64) before the header
        const possibleDescEnd = nextHeaderPos;
        const isZip64 = this.currentHeader?.isZip64;
        const descSize = isZip64 ? C.ZIP64_DATA_DESCRIPTOR_SIZE : C.DATA_DESCRIPTOR_SIZE;

        if (possibleDescEnd >= descSize) {
          dataEnd = possibleDescEnd - descSize;
        }
      }
    }

    if (dataEnd < 0) {
      // Haven't found end yet - emit all but a safety buffer
      // Keep enough bytes to detect signatures
      const safetyBuffer = Math.max(C.ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG, C.LOCAL_HEADER_FIXED_SIZE);
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

    const descriptor = parseDataDescriptor(this.buffer.toBuffer(), 0, isZip64);

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

    // Clean up data descriptor buffers
    this.compressedChunks = null;

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
    if (this.currentStream) {
      this.currentStream.emit('error', err);
      this.currentStream = null;
    }

    // Clean up state
    this.compressedChunks = null;
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

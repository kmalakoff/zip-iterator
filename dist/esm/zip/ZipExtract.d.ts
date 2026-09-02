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
export default class ZipExtract extends EventEmitter {
    private options;
    private buffer;
    private state;
    private currentHeader;
    private currentStream;
    private bytesRemaining;
    private locked;
    private ended;
    private compressionHandler;
    private compressedChunks;
    private compressedChunksSize;
    private runningCrc;
    private expectedCrc;
    constructor(options?: ZipExtractOptions);
    /**
     * Write chunk to parser
     */
    write(chunk: Buffer, callback?: () => void): boolean;
    /**
     * Signal end of input
     */
    end(callback?: () => void): void;
    /**
     * Check for truncation when input ends while locked
     * This catches premature EOF during file data streaming
     */
    private checkLockedEndState;
    /**
     * Check if we ended in a valid state
     */
    private checkEndState;
    private process;
    private processState;
    /**
     * Detect what signature comes next
     */
    private processSignature;
    /**
     * Parse Local File Header
     */
    private processLocalHeader;
    /**
     * Create and emit entry stream
     */
    private createAndEmitEntryStream;
    /**
     * Called when compression handler completes (async for DEFLATE)
     */
    private onCompressionComplete;
    /**
     * Process file data
     */
    private processFileData;
    /**
     * Process file data when size is known
     */
    private processKnownSizeData;
    /**
     * Finish a known-size entry
     */
    private finishKnownSizeEntry;
    /**
     * Process DEFLATE data with data descriptor
     *
     * Since we don't know the compressed size upfront, we buffer data and scan
     * for boundary signatures (next entry or central directory) to find where
     * the compressed data ends. Once found, we inflate the data.
     */
    private processDeflateDataDescriptor;
    /**
     * Complete a DEFLATE data descriptor entry after decompression
     */
    private finishDeflateEntry;
    /**
     * Process STORE data with data descriptor
     *
     * STORE has no internal end markers, so we need to scan for the
     * data descriptor signature or next local header.
     */
    private processStoreDataDescriptor;
    /**
     * Process data descriptor
     */
    private processDataDescriptor;
    /**
     * Finish current entry
     */
    private finishEntry;
    /**
     * Unlock and continue processing
     */
    private unlock;
    /**
     * Emit error and stop
     */
    private emitError;
    /**
     * Signal completion
     */
    private finish;
}

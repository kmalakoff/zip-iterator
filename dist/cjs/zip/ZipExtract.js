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
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return ZipExtract;
    }
});
var _events = require("events");
var _extractbaseiterator = require("extract-base-iterator");
var _DeflateStreamts = require("./compression/DeflateStream.js");
var _StoreStreamts = require("./compression/StoreStream.js");
var _constantsts = /*#__PURE__*/ _interop_require_wildcard(require("./constants.js"));
var _DataDescriptorParserts = require("./DataDescriptorParser.js");
var _EntryEmitterts = require("./EntryEmitter.js");
var _headersts = require("./headers.js");
function _assert_this_initialized(self) {
    if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return self;
}
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _get_prototype_of(o) {
    _get_prototype_of = Object.setPrototypeOf ? Object.getPrototypeOf : function getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _get_prototype_of(o);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _set_prototype_of(subClass, superClass);
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) return obj;
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") return {
        default: obj
    };
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) return cache.get(obj);
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) Object.defineProperty(newObj, key, desc);
            else newObj[key] = obj[key];
        }
    }
    newObj.default = obj;
    if (cache) cache.set(obj, newObj);
    return newObj;
}
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) return call;
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var State = {
    SIGNATURE: 0,
    LOCAL_HEADER: 1,
    FILE_DATA: 2,
    DATA_DESCRIPTOR: 3,
    FINISHED: 4
};
var ZipExtract = /*#__PURE__*/ function(EventEmitter) {
    "use strict";
    _inherits(ZipExtract, EventEmitter);
    function ZipExtract() {
        var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        _class_call_check(this, ZipExtract);
        var _this;
        _this = _call_super(this, ZipExtract);
        _this.options = options;
        _this.buffer = new _extractbaseiterator.BufferList();
        _this.state = State.SIGNATURE;
        _this.currentHeader = null;
        _this.currentStream = null;
        _this.bytesRemaining = 0;
        _this.locked = false;
        _this.ended = false;
        _this.compressionHandler = null;
        _this.compressedChunks = null;
        _this.compressedChunksSize = 0;
        _this.runningCrc = 0;
        _this.expectedCrc = 0;
        return _this;
    }
    var _proto = ZipExtract.prototype;
    /**
   * Write chunk to parser
   */ _proto.write = function write(chunk, callback) {
        if (this.ended) {
            if (callback) callback();
            return false;
        }
        this.buffer.append(chunk);
        this.process();
        if (callback) callback();
        return !this.locked;
    };
    /**
   * Signal end of input
   */ _proto.end = function end(callback) {
        var _ref;
        var _this_compressionHandler;
        // Guard against re-entrant calls (can happen when error handler triggers cleanup)
        if (this.ended) {
            if (callback) callback();
            return;
        }
        this.ended = true;
        // Check if we're waiting for async compression completion
        var waitingForAsync = (_ref = (_this_compressionHandler = this.compressionHandler) === null || _this_compressionHandler === void 0 ? void 0 : _this_compressionHandler.isWaiting()) !== null && _ref !== void 0 ? _ref : false;
        // If we have an active stream and we're in FILE_DATA state, the archive is truncated
        // This handles the case where consumer called next() early but stream data is incomplete
        // Exception: if we're waiting for async inflate completion, that's not truncation
        if (this.currentStream && this.state === State.FILE_DATA && !waitingForAsync) {
            var err = _constantsts.createZipError(this.bytesRemaining > 0 ? "Truncated archive: expected ".concat(this.bytesRemaining, " more bytes of file data") : 'Truncated archive: unexpected end of file data', _constantsts.ZipErrorCode.TRUNCATED_ARCHIVE);
            var stream = this.currentStream;
            this.currentStream = null;
            // Emit error to stream - use deferred emission if no listeners yet
            // This handles the race condition where end() is called before consumer attaches listeners
            // NOTE: We do NOT call stream.end() here - the error should prevent normal completion
            (0, _EntryEmitterts.emitErrorToStream)(stream, err);
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
    };
    /**
   * Check for truncation when input ends while locked
   * This catches premature EOF during file data streaming
   */ _proto.checkLockedEndState = function checkLockedEndState() {
        // If we're in FILE_DATA state and waiting for more data, that's a truncation
        if (this.state === State.FILE_DATA) {
            var header = this.currentHeader;
            if (header) {
                if (header.hasDataDescriptor) {
                    // For data descriptor entries, we're waiting for boundary signatures
                    // If input ends, it's truncated
                    this.emitError(_constantsts.createZipError('Truncated archive: unexpected end of file data', _constantsts.ZipErrorCode.TRUNCATED_ARCHIVE));
                } else if (this.bytesRemaining > 0) {
                    // For known-size entries, if we still need data, it's truncated
                    this.emitError(_constantsts.createZipError("Truncated archive: expected ".concat(this.bytesRemaining, " more bytes of file data"), _constantsts.ZipErrorCode.TRUNCATED_ARCHIVE));
                } else {
                    // bytesRemaining is 0 or negative - entry data was complete
                    // This shouldn't normally happen when locked, but just in case
                    this.finishKnownSizeEntry();
                }
            }
        } else if (this.state === State.DATA_DESCRIPTOR) {
            // Waiting for data descriptor that won't arrive
            this.emitError(_constantsts.createZipError('Truncated archive: unexpected end while reading data descriptor', _constantsts.ZipErrorCode.TRUNCATED_ARCHIVE));
        }
    };
    /**
   * Check if we ended in a valid state
   */ _proto.checkEndState = function checkEndState() {
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
            if (this.buffer.startsWith(_constantsts.SIG_CENTRAL_DIR) || this.buffer.startsWith(_constantsts.SIG_END_OF_CENTRAL_DIR)) {
                this.finish();
                return;
            }
        }
        // Any other state is unexpected
        this.emitError(_constantsts.createZipError("Unexpected end of input in state: ".concat(this.state), _constantsts.ZipErrorCode.TRUNCATED_ARCHIVE));
    };
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    _proto.process = function process() {
        // Process as much as we can from the buffer
        // Note: locked only prevents starting NEW entries, not processing current entry's data
        while(true){
            var processed = this.processState();
            if (!processed) break;
        }
        // If input has ended and we're not processing an entry, check if we finished properly
        // Note: locked may be false even with currentStream set (consumer called next() early)
        // In that case, we're still actively processing file data and shouldn't error yet
        if (this.ended && !this.locked && !this.currentStream) {
            this.checkEndState();
        }
    };
    _proto.processState = function processState() {
        switch(this.state){
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
    };
    /**
   * Detect what signature comes next
   */ _proto.processSignature = function processSignature() {
        // Don't start a new entry while locked (waiting for consumer to call next())
        if (this.locked) {
            return false;
        }
        if (this.buffer.length < _constantsts.SIGNATURE_SIZE) {
            return false;
        }
        // Check for Local File Header
        if (this.buffer.startsWith(_constantsts.SIG_LOCAL_FILE)) {
            this.state = State.LOCAL_HEADER;
            return true;
        }
        // Check for Central Directory (end of entries)
        if (this.buffer.startsWith(_constantsts.SIG_CENTRAL_DIR)) {
            this.finish();
            return false;
        }
        // Check for End of Central Directory (empty archive)
        if (this.buffer.startsWith(_constantsts.SIG_END_OF_CENTRAL_DIR)) {
            this.finish();
            return false;
        }
        // Unknown signature
        this.emitError(_constantsts.createZipError("Invalid ZIP signature: 0x".concat(this.buffer.slice(0, 4).toString('hex')), _constantsts.ZipErrorCode.INVALID_SIGNATURE));
        return false;
    };
    /**
   * Parse Local File Header
   */ _proto.processLocalHeader = function processLocalHeader() {
        // Check if we have minimum header size
        if (this.buffer.length < _constantsts.LOCAL_HEADER_FIXED_SIZE) {
            return false;
        }
        // Use zero-copy reads to get filename and extra field lengths
        // This avoids allocating buffers for the entire header parse
        var fileNameLength = this.buffer.readUInt16LEAt(26);
        var extraFieldLength = this.buffer.readUInt16LEAt(28);
        if (fileNameLength === null || extraFieldLength === null) {
            return false; // Need more data
        }
        var headerSize = _constantsts.LOCAL_HEADER_FIXED_SIZE + fileNameLength + extraFieldLength;
        // Read exactly what's needed using readBytesAt (zero-copy for most cases)
        var buf = this.buffer.readBytesAt(0, headerSize);
        // parseLocalFileHeader expects a contiguous buffer
        var header = (0, _headersts.parseLocalFileHeader)(buf, 0);
        if (!header) {
            return false; // Need more data
        }
        // Check for encryption (traditional or strong/AES)
        if (header.isEncrypted || header.isStrongEncrypted) {
            this.emitError(_constantsts.createZipError('Encrypted ZIP entries are not supported', _constantsts.ZipErrorCode.ENCRYPTED_ENTRY));
            return false;
        }
        // Check for supported compression method
        if (header.compressionMethod !== _constantsts.METHOD_STORE && header.compressionMethod !== _constantsts.METHOD_DEFLATE) {
            this.emitError(_constantsts.createZipError("Unsupported compression method: ".concat(header.compressionMethod), _constantsts.ZipErrorCode.UNSUPPORTED_METHOD));
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
    };
    /**
   * Create and emit entry stream
   */ _proto.createAndEmitEntryStream = function createAndEmitEntryStream() {
        var _this = this;
        var header = this.currentHeader;
        if (!header) return;
        // Create output stream (paused to prevent data loss before consumer attaches)
        var entryStream = (0, _EntryEmitterts.createEntryStream)();
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
            var handlerOptions = {
                outputStream: entryStream,
                onComplete: function onComplete() {
                    return _this.onCompressionComplete();
                },
                onError: function onError(err) {
                    return _this.emitError(err);
                },
                verifyCrc: this.options.verifyCrc
            };
            if (header.compressionMethod === _constantsts.METHOD_DEFLATE) {
                this.compressionHandler = new _DeflateStreamts.DeflateStreamHandler(handlerOptions);
            } else {
                this.compressionHandler = new _StoreStreamts.StoreHandler(handlerOptions);
            }
        }
        // Lock until consumer calls next()
        this.locked = true;
        this.state = State.FILE_DATA;
        this.emit('entry', header, entryStream, function() {
            return _this.unlock();
        });
    };
    /**
   * Called when compression handler completes (async for DEFLATE)
   */ _proto.onCompressionComplete = function onCompressionComplete() {
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
    };
    /**
   * Process file data
   */ _proto.processFileData = function processFileData() {
        var header = this.currentHeader;
        if (!header) return false;
        if (header.hasDataDescriptor) {
            // Unknown size - handle based on compression method
            if (header.compressionMethod === _constantsts.METHOD_DEFLATE) {
                return this.processDeflateDataDescriptor();
            }
            return this.processStoreDataDescriptor();
        }
        // Known size - simple case
        return this.processKnownSizeData();
    };
    /**
   * Process file data when size is known
   */ _proto.processKnownSizeData = function processKnownSizeData() {
        if (this.bytesRemaining <= 0) {
            return this.finishKnownSizeEntry();
        }
        var available = Math.min(this.buffer.length, this.bytesRemaining);
        if (available === 0) {
            return false;
        }
        var chunk = this.buffer.consume(available);
        this.bytesRemaining -= available;
        // Use compression handler for known-size entries
        if (this.compressionHandler) {
            this.compressionHandler.write(chunk);
        }
        if (this.bytesRemaining <= 0) {
            return this.finishKnownSizeEntry();
        }
        return true;
    };
    /**
   * Finish a known-size entry
   */ _proto.finishKnownSizeEntry = function finishKnownSizeEntry() {
        var _this_compressionHandler;
        // If compression handler is waiting for async completion, wait
        if ((_this_compressionHandler = this.compressionHandler) === null || _this_compressionHandler === void 0 ? void 0 : _this_compressionHandler.isWaiting()) {
            return false;
        }
        // Use compression handler's finish method (handles CRC verification)
        if (this.compressionHandler) {
            var result = this.compressionHandler.finish(this.expectedCrc);
            // If async, return false to wait for onCompressionComplete callback
            return result.continue;
        }
        // No compression handler means we shouldn't be here for known-size entries
        this.finishEntry();
        return true;
    };
    /**
   * Process DEFLATE data with data descriptor
   *
   * Since we don't know the compressed size upfront, we buffer data and scan
   * for boundary signatures (next entry or central directory) to find where
   * the compressed data ends. Once found, we inflate the data.
   */ _proto.processDeflateDataDescriptor = function processDeflateDataDescriptor() {
        var _this_options_maxDataDescriptorBuffer, _ref;
        var _this_currentHeader;
        // Initialize buffer for compressed data
        if (this.compressedChunks === null) {
            this.compressedChunks = [];
            this.compressedChunksSize = 0;
        }
        if (this.buffer.length === 0) {
            return false;
        }
        // Consume into our accumulator
        var chunk = this.buffer.consume(this.buffer.length);
        this.compressedChunks.push(chunk);
        this.compressedChunksSize += chunk.length;
        // Check memory limit (default 100MB)
        var maxBuffer = (_this_options_maxDataDescriptorBuffer = this.options.maxDataDescriptorBuffer) !== null && _this_options_maxDataDescriptorBuffer !== void 0 ? _this_options_maxDataDescriptorBuffer : 104857600;
        if (maxBuffer > 0 && this.compressedChunksSize > maxBuffer) {
            this.emitError(_constantsts.createZipError("Data descriptor entry exceeds buffer limit: ".concat(this.compressedChunksSize, " > ").concat(maxBuffer), _constantsts.ZipErrorCode.BUFFER_OVERFLOW));
            return false;
        }
        // Combine all chunks to search for boundaries
        var combined = Buffer.concat(this.compressedChunks);
        // Find boundary using DataDescriptorParser
        var isZip64 = (_ref = (_this_currentHeader = this.currentHeader) === null || _this_currentHeader === void 0 ? void 0 : _this_currentHeader.isZip64) !== null && _ref !== void 0 ? _ref : false;
        var boundary = (0, _DataDescriptorParserts.findDeflateBoundary)(combined, isZip64);
        if (!boundary) {
            // No boundary found yet - keep buffering
            // Store combined buffer for efficiency
            this.compressedChunks = [
                combined
            ];
            return false;
        }
        // Compressed data is from 0 to dataEnd
        var compressedData = combined.slice(0, boundary.dataEnd);
        // Data descriptor + rest goes back to buffer for normal parsing
        var remainder = combined.slice(boundary.dataEnd);
        this.buffer.prepend(remainder);
        // Clean up compressed chunks since we've extracted what we need
        this.compressedChunks = null;
        this.compressedChunksSize = 0;
        // Decompress and emit to consumer
        try {
            var decompressed = (0, _extractbaseiterator.inflateRaw)(compressedData);
            this.finishDeflateEntry(decompressed);
        } catch (err) {
            this.emitError(err);
            return false;
        }
        return true;
    };
    /**
   * Complete a DEFLATE data descriptor entry after decompression
   */ _proto.finishDeflateEntry = function finishDeflateEntry(decompressed) {
        // Calculate CRC of decompressed data for verification after data descriptor is parsed
        if (this.options.verifyCrc !== false) {
            this.runningCrc = (0, _extractbaseiterator.crc32)(decompressed);
        }
        if (this.currentStream) {
            this.currentStream.write(decompressed);
            this.currentStream.end();
            this.currentStream = null;
        }
        // Move to data descriptor parsing
        this.state = State.DATA_DESCRIPTOR;
    };
    /**
   * Process STORE data with data descriptor
   *
   * STORE has no internal end markers, so we need to scan for the
   * data descriptor signature or next local header.
   */ _proto.processStoreDataDescriptor = function processStoreDataDescriptor() {
        var _ref;
        var _this_currentHeader;
        var isZip64 = (_ref = (_this_currentHeader = this.currentHeader) === null || _this_currentHeader === void 0 ? void 0 : _this_currentHeader.isZip64) !== null && _ref !== void 0 ? _ref : false;
        var dataEnd = (0, _DataDescriptorParserts.findStoreDataEnd)(this.buffer, isZip64);
        if (dataEnd < 0) {
            // Haven't found end yet - emit all but a safety buffer
            // Keep enough bytes to detect signatures
            var safetyBuffer = (0, _DataDescriptorParserts.getSafetyBufferSize)();
            if (this.buffer.length > safetyBuffer) {
                var toEmit = this.buffer.length - safetyBuffer;
                var chunk = this.buffer.consume(toEmit);
                // Track CRC as data is emitted
                if (this.options.verifyCrc !== false) {
                    this.runningCrc = (0, _extractbaseiterator.crc32)(chunk, this.runningCrc);
                }
                if (this.currentStream) {
                    this.currentStream.write(chunk);
                }
            }
            return false;
        }
        // Emit file data up to the descriptor
        if (dataEnd > 0) {
            var chunk1 = this.buffer.consume(dataEnd);
            // Calculate CRC for STORE data descriptor entries
            if (this.options.verifyCrc !== false) {
                this.runningCrc = (0, _extractbaseiterator.crc32)(chunk1, this.runningCrc);
            }
            if (this.currentStream) {
                this.currentStream.write(chunk1);
                this.currentStream.end();
                this.currentStream = null;
            }
        }
        this.state = State.DATA_DESCRIPTOR;
        return true;
    };
    /**
   * Process data descriptor
   */ _proto.processDataDescriptor = function processDataDescriptor() {
        var header = this.currentHeader;
        if (!header) return false;
        var isZip64 = header.isZip64;
        // Data descriptors are small (12-24 bytes), always use slice() to avoid copying large BufferLists
        var maxDescriptorSize = isZip64 ? 32 : 24; // Safe upper bound
        var buf = this.buffer.slice(0, Math.min(this.buffer.length, maxDescriptorSize));
        var descriptor = (0, _headersts.parseDataDescriptor)(buf, 0, isZip64);
        if (!descriptor) {
            return false; // Need more data
        }
        // Verify CRC using the CRC from data descriptor
        if (this.options.verifyCrc !== false) {
            if (this.runningCrc !== descriptor.crc32) {
                this.emitError(_constantsts.createZipError("CRC32 mismatch: expected ".concat(descriptor.crc32.toString(16), ", got ").concat(this.runningCrc.toString(16)), _constantsts.ZipErrorCode.CRC_MISMATCH));
                return false;
            }
        }
        // Consume descriptor
        this.buffer.skip(descriptor.size);
        // Finish the entry
        this.finishEntry();
        return true;
    };
    /**
   * Finish current entry
   */ _proto.finishEntry = function finishEntry() {
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
    };
    /**
   * Unlock and continue processing
   */ _proto.unlock = function unlock() {
        this.locked = false;
        this.process();
    };
    /**
   * Emit error and stop
   */ _proto.emitError = function emitError(err) {
        this.state = State.FINISHED;
        // Propagate error to current entry stream so consumers receive it
        // Uses emitStreamError which handles both immediate and deferred emission
        if (this.currentStream) {
            var stream = this.currentStream;
            this.currentStream = null;
            (0, _EntryEmitterts.emitStreamError)(stream, err);
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
    };
    /**
   * Signal completion
   */ _proto.finish = function finish() {
        if (this.state === State.FINISHED) return;
        this.state = State.FINISHED;
        this.emit('finish');
    };
    return ZipExtract;
}(_events.EventEmitter);
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
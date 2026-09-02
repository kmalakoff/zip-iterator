/**
 * DeflateBufferHandler - Buffered DEFLATE decompression
 *
 * Used for entries with data descriptors where compressed size is unknown.
 * Buffers all compressed data, then decompresses once the boundary is found.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DeflateBufferHandler", {
    enumerable: true,
    get: function() {
        return DeflateBufferHandler;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
var _constantsts = /*#__PURE__*/ _interop_require_wildcard(require("../constants.js"));
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
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
var DeflateBufferHandler = /*#__PURE__*/ function() {
    "use strict";
    function DeflateBufferHandler(options) {
        _class_call_check(this, DeflateBufferHandler);
        this.chunks = [];
        this.runningCrc = 0;
        this.outputStream = options.outputStream;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        this.verifyCrc = options.verifyCrc !== false;
    }
    var _proto = DeflateBufferHandler.prototype;
    _proto.write = function write(chunk) {
        this.chunks.push(chunk);
    };
    /**
   * Decompress all buffered data and verify CRC
   */ _proto.finish = function finish(expectedCrc) {
        if (this.chunks.length === 0) {
            // No data to decompress
            this.onComplete();
            return {
                continue: true
            };
        }
        try {
            // Concatenate all chunks
            var compressedData = Buffer.concat(this.chunks);
            this.chunks = [];
            // Decompress using native zlib (Node 0.11.12+) or pako fallback
            var decompressed = (0, _extractbaseiterator.inflateRaw)(compressedData);
            // Verify CRC
            if (this.verifyCrc) {
                this.runningCrc = (0, _extractbaseiterator.crc32)(decompressed);
                if (this.runningCrc !== expectedCrc) {
                    this.onError(_constantsts.createZipError("CRC32 mismatch: expected ".concat(expectedCrc.toString(16), ", got ").concat(this.runningCrc.toString(16)), _constantsts.ZipErrorCode.CRC_MISMATCH));
                    return {
                        continue: false
                    };
                }
            }
            // Write decompressed data
            this.outputStream.write(decompressed);
            this.onComplete();
            return {
                continue: true
            };
        } catch (err) {
            this.onError(err);
            return {
                continue: false,
                error: err
            };
        }
    };
    _proto.getRunningCrc = function getRunningCrc() {
        return this.runningCrc;
    };
    _proto.isWaiting = function isWaiting() {
        return false; // Buffered handler is always synchronous
    };
    /**
   * Get accumulated compressed data without consuming it
   */ _proto.getBuffer = function getBuffer() {
        return Buffer.concat(this.chunks);
    };
    /**
   * Clear the buffer
   */ _proto.clearBuffer = function clearBuffer() {
        this.chunks = [];
    };
    _proto.destroy = function destroy() {
        this.chunks = [];
        this.runningCrc = 0;
    };
    return DeflateBufferHandler;
}();
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
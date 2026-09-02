/**
 * DeflateStreamHandler - Streaming DEFLATE decompression with CRC
 *
 * Used for entries with known compressed size. Memory efficient because
 * it decompresses data as it arrives rather than buffering everything.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DeflateStreamHandler", {
    enumerable: true,
    get: function() {
        return DeflateStreamHandler;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
var _onone = /*#__PURE__*/ _interop_require_default(require("on-one"));
var _constantsts = /*#__PURE__*/ _interop_require_wildcard(require("../constants.js"));
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
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
var DeflateStreamHandler = /*#__PURE__*/ function() {
    "use strict";
    function DeflateStreamHandler(options) {
        var _this = this;
        _class_call_check(this, DeflateStreamHandler);
        this.runningCrc = 0;
        this.waiting = false;
        this.outputStream = options.outputStream;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        this.verifyCrc = options.verifyCrc !== false;
        // Create inflate stream
        this.inflateStream = (0, _extractbaseiterator.createInflateRawStream)();
        // Handle decompressed data
        this.inflateStream.on('data', function(chunk) {
            if (_this.verifyCrc) {
                _this.runningCrc = (0, _extractbaseiterator.crc32)(chunk, _this.runningCrc);
            }
            _this.outputStream.write(chunk);
        });
        // Handle inflate errors
        this.inflateStream.on('error', function(err) {
            _this.onError(err);
        });
    }
    var _proto = DeflateStreamHandler.prototype;
    _proto.write = function write(chunk) {
        if (this.inflateStream) this.inflateStream.write(chunk);
    };
    _proto.finish = function finish(expectedCrc) {
        var _this = this;
        if (this.waiting) {
            return {
                continue: false
            };
        }
        this.waiting = true;
        var inflateStream = this.inflateStream;
        (0, _onone.default)(inflateStream, [
            'end',
            'close'
        ], function(_err) {
            _this.waiting = false;
            // Verify CRC
            if (_this.verifyCrc) {
                if (_this.runningCrc !== expectedCrc) {
                    _this.onError(_constantsts.createZipError("CRC32 mismatch: expected ".concat(expectedCrc.toString(16), ", got ").concat(_this.runningCrc.toString(16)), _constantsts.ZipErrorCode.CRC_MISMATCH));
                    return;
                }
            }
            // Signal completion
            _this.onComplete();
        });
        inflateStream.end();
        return {
            continue: false
        }; // Async completion
    };
    _proto.getRunningCrc = function getRunningCrc() {
        return this.runningCrc;
    };
    _proto.isWaiting = function isWaiting() {
        return this.waiting;
    };
    _proto.destroy = function destroy() {
        this.inflateStream = null;
        this.runningCrc = 0;
        this.waiting = false;
    };
    return DeflateStreamHandler;
}();
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
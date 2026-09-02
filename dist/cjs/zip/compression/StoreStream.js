/**
 * StoreHandler - Passthrough for uncompressed (STORE) entries
 *
 * Simply passes data through while calculating CRC for verification.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StoreHandler", {
    enumerable: true,
    get: function() {
        return StoreHandler;
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
var StoreHandler = /*#__PURE__*/ function() {
    "use strict";
    function StoreHandler(options) {
        _class_call_check(this, StoreHandler);
        this.runningCrc = 0;
        this.outputStream = options.outputStream;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        this.verifyCrc = options.verifyCrc !== false;
    }
    var _proto = StoreHandler.prototype;
    _proto.write = function write(chunk) {
        if (this.verifyCrc) {
            this.runningCrc = (0, _extractbaseiterator.crc32)(chunk, this.runningCrc);
        }
        this.outputStream.write(chunk);
    };
    _proto.finish = function finish(expectedCrc) {
        // Verify CRC
        if (this.verifyCrc) {
            if (this.runningCrc !== expectedCrc) {
                this.onError(_constantsts.createZipError("CRC32 mismatch: expected ".concat(expectedCrc.toString(16), ", got ").concat(this.runningCrc.toString(16)), _constantsts.ZipErrorCode.CRC_MISMATCH));
                return {
                    continue: false
                };
            }
        }
        // End the stream and complete
        this.outputStream.end();
        this.onComplete();
        return {
            continue: true
        };
    };
    _proto.getRunningCrc = function getRunningCrc() {
        return this.runningCrc;
    };
    _proto.isWaiting = function isWaiting() {
        return false; // Store handler is synchronous
    };
    _proto.destroy = function destroy() {
        this.runningCrc = 0;
    };
    return StoreHandler;
}();
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
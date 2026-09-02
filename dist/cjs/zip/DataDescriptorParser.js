/**
 * DataDescriptorParser - Boundary scanning for entries with data descriptors
 *
 * When entries use data descriptors (streaming ZIP creation), we don't know
 * the compressed size upfront. This module handles scanning for boundary
 * signatures to find where file data ends and the data descriptor begins.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get bufferIndexOf () {
        return bufferIndexOf;
    },
    get findDeflateBoundary () {
        return findDeflateBoundary;
    },
    get findStoreDataEnd () {
        return findStoreDataEnd;
    },
    get getSafetyBufferSize () {
        return getSafetyBufferSize;
    }
});
var _constantsts = /*#__PURE__*/ _interop_require_wildcard(require("./constants.js"));
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
function bufferIndexOf(buf, sig) {
    if (sig.length === 0) return 0;
    if (buf.length < sig.length) return -1;
    outer: for(var i = 0; i <= buf.length - sig.length; i++){
        for(var j = 0; j < sig.length; j++){
            if (buf[i + j] !== sig[j]) {
                continue outer;
            }
        }
        return i;
    }
    return -1;
}
function findDeflateBoundary(combined, isZip64) {
    // Look for next structure signature (definitive end markers)
    var boundaryPos = -1;
    for(var _i = 0, _iter = [
        _constantsts.SIG_LOCAL_FILE,
        _constantsts.SIG_CENTRAL_DIR,
        _constantsts.SIG_END_OF_CENTRAL_DIR
    ]; _i < _iter.length; _i++){
        var sig = _iter[_i];
        var pos = bufferIndexOf(combined, sig);
        if (pos >= 0 && (boundaryPos < 0 || pos < boundaryPos)) {
            boundaryPos = pos;
        }
    }
    if (boundaryPos < 0) {
        return null; // No boundary found yet
    }
    // Data descriptor is immediately before the boundary
    var descSize = isZip64 ? _constantsts.ZIP64_DATA_DESCRIPTOR_SIZE : _constantsts.DATA_DESCRIPTOR_SIZE;
    // Check if data descriptor has optional signature
    var descStart = boundaryPos - descSize;
    var hasSignature = false;
    if (descStart >= _constantsts.SIGNATURE_SIZE) {
        // Check for data descriptor signature
        if (combined[descStart - 4] === _constantsts.SIG_DATA_DESCRIPTOR[0] && combined[descStart - 3] === _constantsts.SIG_DATA_DESCRIPTOR[1] && combined[descStart - 2] === _constantsts.SIG_DATA_DESCRIPTOR[2] && combined[descStart - 1] === _constantsts.SIG_DATA_DESCRIPTOR[3]) {
            descStart -= _constantsts.SIGNATURE_SIZE;
            hasSignature = true;
        }
    }
    if (descStart < 0) {
        return null; // Not enough data
    }
    return {
        dataEnd: descStart,
        hasSignature: hasSignature
    };
}
function findStoreDataEnd(buffer, isZip64) {
    // Look for data descriptor signature
    var descriptorPos = buffer.indexOf(_constantsts.SIG_DATA_DESCRIPTOR);
    // Also look for next local header as a boundary
    var nextHeaderPos = buffer.indexOf(_constantsts.SIG_LOCAL_FILE);
    // Determine where data ends
    var dataEnd = -1;
    if (descriptorPos >= 0) {
        dataEnd = descriptorPos;
    }
    if (nextHeaderPos >= 0) {
        // If we found a header before descriptor, the descriptor might not have signature
        if (dataEnd < 0 || nextHeaderPos < dataEnd) {
            // Try to find descriptor without signature before the header
            var descSize = isZip64 ? _constantsts.ZIP64_DATA_DESCRIPTOR_SIZE : _constantsts.DATA_DESCRIPTOR_SIZE;
            if (nextHeaderPos >= descSize) {
                dataEnd = nextHeaderPos - descSize;
            }
        }
    }
    return dataEnd;
}
function getSafetyBufferSize() {
    return Math.max(_constantsts.ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG, _constantsts.LOCAL_HEADER_FIXED_SIZE);
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
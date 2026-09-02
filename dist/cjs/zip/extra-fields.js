/**
 * ZIP Extra Field Parsing
 *
 * Handles parsing of specific extra field types:
 * - ZIP64 Extended Information (0x0001)
 * - Info-ZIP Unix Extra Field (0x5855 / 0x7875)
 * - Extended Timestamp (0x5455)
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
    get findAsiInfo () {
        return findAsiInfo;
    },
    get findExtendedTimestamp () {
        return findExtendedTimestamp;
    },
    get findUnixInfo () {
        return findUnixInfo;
    },
    get parseAsiExtraField () {
        return parseAsiExtraField;
    },
    get parseExtendedTimestamp () {
        return parseExtendedTimestamp;
    },
    get parseUnixExtraFieldNew () {
        return parseUnixExtraFieldNew;
    },
    get parseUnixExtraFieldOld () {
        return parseUnixExtraFieldOld;
    },
    get parseZip64ExtraField () {
        return parseZip64ExtraField;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
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
function parseZip64ExtraField(field, needUncompressed, needCompressed) {
    if (field.id !== _constantsts.EXTID_ZIP64) {
        return null;
    }
    var data = field.data;
    var offset = 0;
    var result = {
        uncompressedSize: 0,
        compressedSize: 0
    };
    // Fields appear in order but only if the corresponding header field was 0xFFFFFFFF
    if (needUncompressed) {
        if (offset + 8 > data.length) return null;
        result.uncompressedSize = (0, _extractbaseiterator.readUInt64LE)(data, offset);
        offset += 8;
    }
    if (needCompressed) {
        if (offset + 8 > data.length) return null;
        result.compressedSize = (0, _extractbaseiterator.readUInt64LE)(data, offset);
        offset += 8;
    }
    // Header offset and disk start are only in Central Directory entries
    // In Local File Headers we typically only have sizes
    if (offset + 8 <= data.length) {
        result.headerOffset = (0, _extractbaseiterator.readUInt64LE)(data, offset);
        offset += 8;
    }
    if (offset + 4 <= data.length) {
        result.diskStart = data.readUInt32LE(offset);
    }
    return result;
}
function parseUnixExtraFieldOld(field) {
    if (field.id !== _constantsts.EXTID_UNIX_OLD) {
        return null;
    }
    var data = field.data;
    if (data.length < 8) {
        return null;
    }
    var result = {
        atime: data.readUInt32LE(0),
        mtime: data.readUInt32LE(4)
    };
    // UID and GID are optional (present in Central Directory)
    if (data.length >= 12) {
        result.uid = data.readUInt16LE(8);
        result.gid = data.readUInt16LE(10);
    }
    return result;
}
function parseUnixExtraFieldNew(field) {
    if (field.id !== _constantsts.EXTID_UNIX_NEW) {
        return null;
    }
    var data = field.data;
    if (data.length < 3) {
        return null;
    }
    var version = data[0];
    if (version !== 1) {
        return null; // Unknown version
    }
    var offset = 1;
    var result = {};
    // Parse UID
    var uidSize = data[offset++];
    if (offset + uidSize > data.length) {
        return null;
    }
    result.uid = readVariableInt(data, offset, uidSize);
    offset += uidSize;
    // Parse GID
    if (offset >= data.length) {
        return result;
    }
    var gidSize = data[offset++];
    if (offset + gidSize > data.length) {
        return null;
    }
    result.gid = readVariableInt(data, offset, gidSize);
    return result;
}
function parseExtendedTimestamp(field) {
    if (field.id !== _constantsts.EXTID_EXTENDED_TIMESTAMP) {
        return null;
    }
    var data = field.data;
    if (data.length < 1) {
        return null;
    }
    var flags = data[0];
    var offset = 1;
    var result = {};
    // Modification time
    if ((flags & 0x01) !== 0 && offset + 4 <= data.length) {
        result.mtime = data.readUInt32LE(offset);
        offset += 4;
    }
    // Access time (Local header only)
    if ((flags & 0x02) !== 0 && offset + 4 <= data.length) {
        result.atime = data.readUInt32LE(offset);
        offset += 4;
    }
    // Creation time (Local header only)
    if ((flags & 0x04) !== 0 && offset + 4 <= data.length) {
        result.ctime = data.readUInt32LE(offset);
    }
    return result;
}
function parseAsiExtraField(field) {
    if (field.id !== _constantsts.EXTID_ASI) {
        return null;
    }
    var data = field.data;
    // Minimum size: CRC(4) + Mode(2) + SizDev(4) + UID(2) + GID(2) = 14 bytes
    if (data.length < 14) {
        return null;
    }
    // Read and verify CRC (big-endian)
    var storedCrc = data.readUInt32BE(0);
    var dataAfterCrc = data.slice(4);
    var computedCrc = (0, _extractbaseiterator.crc32)(dataAfterCrc);
    if (storedCrc !== computedCrc) {
        // CRC mismatch - corrupt or wrong format
        return null;
    }
    // Parse fields (big-endian)
    var mode = data.readUInt16BE(4);
    var sizDev = data.readUInt32BE(6);
    var uid = data.readUInt16BE(10);
    var gid = data.readUInt16BE(12);
    var result = {
        mode: mode,
        uid: uid,
        gid: gid
    };
    // If this is a symlink (S_IFLNK = 0o120000 = 0xA000), read link path
    // Check file type bits: (mode & 0xF000) === 0xA000
    if ((mode & 0xf000) === 0xa000 && sizDev > 0 && data.length >= 14 + sizDev) {
        result.linkPath = data.toString('utf8', 14, 14 + sizDev);
    }
    return result;
}
function findAsiInfo(fields) {
    for(var i = 0; i < fields.length; i++){
        if (fields[i].id === _constantsts.EXTID_ASI) {
            var info = parseAsiExtraField(fields[i]);
            if (info) return info;
        }
    }
    return null;
}
// =============================================================================
// Helpers
// =============================================================================
/**
 * Read variable-length little-endian integer
 * Used for UID/GID in new Unix extra field format
 */ function readVariableInt(buf, offset, size) {
    var value = 0;
    for(var i = 0; i < size; i++){
        value += buf[offset + i] << i * 8;
    }
    return value;
}
function findUnixInfo(fields) {
    // Try new format first (more common in modern archives)
    for(var i = 0; i < fields.length; i++){
        if (fields[i].id === _constantsts.EXTID_UNIX_NEW) {
            var info = parseUnixExtraFieldNew(fields[i]);
            if (info) return info;
        }
    }
    // Fall back to old format
    for(var i1 = 0; i1 < fields.length; i1++){
        if (fields[i1].id === _constantsts.EXTID_UNIX_OLD) {
            var info1 = parseUnixExtraFieldOld(fields[i1]);
            if (info1) return info1;
        }
    }
    return null;
}
function findExtendedTimestamp(fields) {
    for(var i = 0; i < fields.length; i++){
        if (fields[i].id === _constantsts.EXTID_EXTENDED_TIMESTAMP) {
            var ts = parseExtendedTimestamp(fields[i]);
            if (ts) return ts;
        }
    }
    return null;
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
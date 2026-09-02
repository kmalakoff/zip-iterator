/**
 * ZIP Header Parsing
 *
 * Functions for parsing Local File Headers and Data Descriptors.
 * All parsing is forward-only - no seeking required.
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
    get decodeDateTime () {
        return decodeDateTime;
    },
    get findExtraField () {
        return findExtraField;
    },
    get getEntryType () {
        return getEntryType;
    },
    get isCentralDirectory () {
        return isCentralDirectory;
    },
    get isDataDescriptor () {
        return isDataDescriptor;
    },
    get isLocalFileHeader () {
        return isLocalFileHeader;
    },
    get parseDataDescriptor () {
        return parseDataDescriptor;
    },
    get parseExtraFields () {
        return parseExtraFields;
    },
    get parseLocalFileHeader () {
        return parseLocalFileHeader;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
var _constantsts = /*#__PURE__*/ _interop_require_wildcard(require("./constants.js"));
var _cp437ts = require("./cp437.js");
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
function isLocalFileHeader(buf, offset) {
    return (0, _extractbaseiterator.bufferEquals)(buf, offset, _constantsts.SIG_LOCAL_FILE);
}
function isCentralDirectory(buf, offset) {
    return (0, _extractbaseiterator.bufferEquals)(buf, offset, _constantsts.SIG_CENTRAL_DIR);
}
function isDataDescriptor(buf, offset) {
    return (0, _extractbaseiterator.bufferEquals)(buf, offset, _constantsts.SIG_DATA_DESCRIPTOR);
}
function parseLocalFileHeader(buf, offset) {
    // Fast path: check if buffer is large enough for minimal header
    var minHeaderSize = _constantsts.LOCAL_HEADER_FIXED_SIZE;
    if (buf.length < offset + minHeaderSize) {
        return null;
    }
    // Verify signature
    if (!isLocalFileHeader(buf, offset)) {
        return null;
    }
    // Parse fixed fields
    var versionNeeded = buf.readUInt16LE(offset + 4);
    var flags = buf.readUInt16LE(offset + 6);
    var compressionMethod = buf.readUInt16LE(offset + 8);
    var lastModTime = buf.readUInt16LE(offset + 10);
    var lastModDate = buf.readUInt16LE(offset + 12);
    var crc32 = buf.readUInt32LE(offset + 14);
    var compressedSize = buf.readUInt32LE(offset + 18);
    var uncompressedSize = buf.readUInt32LE(offset + 22);
    var fileNameLength = buf.readUInt16LE(offset + 26);
    var extraFieldLength = buf.readUInt16LE(offset + 28);
    // Calculate total header size
    var headerSize = _constantsts.LOCAL_HEADER_FIXED_SIZE + fileNameLength + extraFieldLength;
    // Check if we have the complete header (re-check with actual sizes)
    if (buf.length < offset + headerSize) {
        return null;
    }
    // Parse filename
    // UTF-8 flag indicates filename is UTF-8 encoded, otherwise use CP437
    var isUtf8 = (flags & _constantsts.FLAG_UTF8) !== 0;
    var fileName;
    if (isUtf8) {
        fileName = buf.toString('utf8', offset + 30, offset + 30 + fileNameLength);
    } else {
        // CP437 is the original IBM PC character set and ZIP default
        fileName = (0, _cp437ts.decodeCP437)(buf, offset + 30, offset + 30 + fileNameLength);
    }
    // Parse extra fields
    var extraFieldStart = offset + 30 + fileNameLength;
    var extraFields = parseExtraFields(buf.slice(extraFieldStart, extraFieldStart + extraFieldLength));
    // Check for ZIP64 markers
    var isZip64 = false;
    if (compressedSize === _constantsts.ZIP64_MARKER_32 || uncompressedSize === _constantsts.ZIP64_MARKER_32) {
        isZip64 = true;
        // Try to get actual sizes from ZIP64 extra field
        var zip64Extra = findExtraField(extraFields, _constantsts.EXTID_ZIP64);
        if (zip64Extra && zip64Extra.data.length >= 16) {
            uncompressedSize = (0, _extractbaseiterator.readUInt64LE)(zip64Extra.data, 0);
            compressedSize = (0, _extractbaseiterator.readUInt64LE)(zip64Extra.data, 8);
        }
    }
    // Compute derived values
    var isEncrypted = (flags & _constantsts.FLAG_ENCRYPTED) !== 0;
    var isStrongEncrypted = (flags & _constantsts.FLAG_STRONG_ENCRYPTION) !== 0;
    var hasDataDescriptor = (flags & _constantsts.FLAG_DATA_DESCRIPTOR) !== 0;
    var mtime = decodeDateTime(lastModDate, lastModTime);
    return {
        versionNeeded: versionNeeded,
        flags: flags,
        compressionMethod: compressionMethod,
        lastModTime: lastModTime,
        lastModDate: lastModDate,
        crc32: crc32,
        compressedSize: compressedSize,
        uncompressedSize: uncompressedSize,
        fileNameLength: fileNameLength,
        extraFieldLength: extraFieldLength,
        fileName: fileName,
        extraFields: extraFields,
        isEncrypted: isEncrypted,
        isStrongEncrypted: isStrongEncrypted,
        hasDataDescriptor: hasDataDescriptor,
        isUtf8: isUtf8,
        isZip64: isZip64,
        mtime: mtime,
        headerSize: headerSize
    };
}
function parseExtraFields(buf) {
    var fields = [];
    var offset = 0;
    while(offset + 4 <= buf.length){
        var id = buf.readUInt16LE(offset);
        var size = buf.readUInt16LE(offset + 2);
        if (offset + 4 + size > buf.length) {
            break; // Truncated extra field
        }
        fields.push({
            id: id,
            size: size,
            data: buf.slice(offset + 4, offset + 4 + size)
        });
        offset += 4 + size;
    }
    return fields;
}
function findExtraField(fields, id) {
    for(var i = 0; i < fields.length; i++){
        if (fields[i].id === id) {
            return fields[i];
        }
    }
    return null;
}
function parseDataDescriptor(buf, offset, isZip64) {
    // Determine expected sizes
    var sizeBytes = isZip64 ? 8 : 4;
    var minSize = 4 + sizeBytes * 2; // CRC + compressed + uncompressed
    var minSizeWithSig = 4 + minSize; // signature + above
    // Check if we have the optional signature
    var hasSignature = (0, _extractbaseiterator.bufferEquals)(buf, offset, _constantsts.SIG_DATA_DESCRIPTOR);
    var expectedSize = hasSignature ? minSizeWithSig : minSize;
    if (buf.length < offset + expectedSize) {
        return null;
    }
    // Adjust offset if signature is present
    var dataOffset = hasSignature ? offset + 4 : offset;
    var crc32 = buf.readUInt32LE(dataOffset);
    var compressedSize;
    var uncompressedSize;
    if (isZip64) {
        compressedSize = (0, _extractbaseiterator.readUInt64LE)(buf, dataOffset + 4);
        uncompressedSize = (0, _extractbaseiterator.readUInt64LE)(buf, dataOffset + 12);
    } else {
        compressedSize = buf.readUInt32LE(dataOffset + 4);
        uncompressedSize = buf.readUInt32LE(dataOffset + 8);
    }
    return {
        crc32: crc32,
        compressedSize: compressedSize,
        uncompressedSize: uncompressedSize,
        size: expectedSize
    };
}
function decodeDateTime(date, time) {
    var year = (date >> 9 & 0x7f) + 1980;
    var month = (date >> 5 & 0x0f) - 1; // 0-indexed for Date constructor
    var day = date & 0x1f;
    var hour = time >> 11 & 0x1f;
    var minute = time >> 5 & 0x3f;
    var second = (time & 0x1f) * 2;
    return new Date(year, month, day, hour, minute, second);
}
function getEntryType(fileName, externalAttributes, platform) {
    // Directory detection: filename ends with /
    if (fileName.charAt(fileName.length - 1) === '/') {
        return 'directory';
    }
    // Unix platform: check file type bits
    if (platform === _constantsts.PLATFORM_UNIX) {
        var unixType = externalAttributes >> 28 & 0x0f;
        if (unixType === _constantsts.UNIX_TYPE_DIR) return 'directory';
        if (unixType === _constantsts.UNIX_TYPE_SYMLINK) return 'symlink';
    // Note: Hard links are stored differently in ZIP
    }
    return 'file';
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
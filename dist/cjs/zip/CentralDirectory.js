/**
 * Central Directory Reader
 *
 * Reads the Central Directory from seekable files to get
 * external file attributes (needed for symlink detection).
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "readCentralDirectory", {
    enumerable: true,
    get: function() {
        return readCentralDirectory;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
var _gracefulfs = /*#__PURE__*/ _interop_require_default(require("graceful-fs"));
var _constantsts = /*#__PURE__*/ _interop_require_wildcard(require("./constants.js"));
var _cp437ts = require("./cp437.js");
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
function readCentralDirectory(filePath, callback) {
    _gracefulfs.default.stat(filePath, function(err, stats) {
        if (err) return callback(err);
        var fileSize = stats.size;
        // EOCD is at most 65557 bytes from end (22 bytes min + 65535 max comment)
        var searchSize = Math.min(65557, fileSize);
        var searchBuffer = (0, _extractbaseiterator.allocBuffer)(searchSize);
        var searchStart = fileSize - searchSize;
        _gracefulfs.default.open(filePath, 'r', function(err, fd) {
            if (err) return callback(err);
            _gracefulfs.default.read(fd, searchBuffer, 0, searchSize, searchStart, function(err, bytesRead) {
                if (err) {
                    _gracefulfs.default.close(fd, function() {
                        return callback(err);
                    });
                    return;
                }
                // Find End of Central Directory signature
                var eocdPos = -1;
                for(var i = bytesRead - 22; i >= 0; i--){
                    if ((0, _extractbaseiterator.bufferEquals)(searchBuffer, i, _constantsts.SIG_END_OF_CENTRAL_DIR)) {
                        eocdPos = i;
                        break;
                    }
                }
                if (eocdPos < 0) {
                    _gracefulfs.default.close(fd, function() {
                        return callback(new Error('Cannot find End of Central Directory'));
                    });
                    return;
                }
                // Parse EOCD
                var eocd = searchBuffer.slice(eocdPos);
                var cdOffset = eocd.readUInt32LE(16);
                var cdSize = eocd.readUInt32LE(12);
                // Check for ZIP64
                if (cdOffset === _constantsts.ZIP64_MARKER_32) {
                    // Need to find ZIP64 EOCD locator
                    if (eocdPos >= 20) {
                        var locatorPos = eocdPos - 20;
                        if ((0, _extractbaseiterator.bufferEquals)(searchBuffer, locatorPos, _constantsts.SIG_ZIP64_EOCD_LOCATOR)) {
                            // Get ZIP64 EOCD position
                            var zip64EocdOffset = (0, _extractbaseiterator.readUInt64LE)(searchBuffer, locatorPos + 8);
                            // Read ZIP64 EOCD
                            var zip64EocdBuf = (0, _extractbaseiterator.allocBuffer)(56);
                            _gracefulfs.default.read(fd, zip64EocdBuf, 0, 56, zip64EocdOffset, function(err) {
                                if (err) {
                                    _gracefulfs.default.close(fd, function() {
                                        return callback(err);
                                    });
                                    return;
                                }
                                if (!(0, _extractbaseiterator.bufferEquals)(zip64EocdBuf, 0, _constantsts.SIG_ZIP64_END_OF_CENTRAL_DIR)) {
                                    _gracefulfs.default.close(fd, function() {
                                        return callback(new Error('Invalid ZIP64 EOCD'));
                                    });
                                    return;
                                }
                                cdSize = (0, _extractbaseiterator.readUInt64LE)(zip64EocdBuf, 40);
                                cdOffset = (0, _extractbaseiterator.readUInt64LE)(zip64EocdBuf, 48);
                                readCentralDirEntries(fd, cdOffset, cdSize, function(err, map) {
                                    _gracefulfs.default.close(fd, function() {
                                        return callback(err, map);
                                    });
                                });
                            });
                            return;
                        }
                    }
                }
                readCentralDirEntries(fd, cdOffset, cdSize, function(err, map) {
                    _gracefulfs.default.close(fd, function() {
                        return callback(err, map);
                    });
                });
            });
        });
    });
}
/**
 * Read and parse Central Directory entries
 */ function readCentralDirEntries(fd, offset, size, callback) {
    var buffer = (0, _extractbaseiterator.allocBuffer)(size);
    _gracefulfs.default.read(fd, buffer, 0, size, offset, function(err, bytesRead) {
        if (err) return callback(err);
        var map = {};
        var pos = 0;
        while(pos + 46 <= bytesRead){
            // Check signature
            if (!(0, _extractbaseiterator.bufferEquals)(buffer, pos, _constantsts.SIG_CENTRAL_DIR)) {
                break;
            }
            var platform = buffer.readUInt8(pos + 5); // Version made by - high byte is platform
            var flags = buffer.readUInt16LE(pos + 8); // General purpose bit flags
            var fileNameLength = buffer.readUInt16LE(pos + 28);
            var extraFieldLength = buffer.readUInt16LE(pos + 30);
            var commentLength = buffer.readUInt16LE(pos + 32);
            var externalAttributes = buffer.readUInt32LE(pos + 38);
            var headerSize = 46 + fileNameLength + extraFieldLength + commentLength;
            if (pos + headerSize > bytesRead) {
                break;
            }
            // Check UTF-8 flag (bit 11) to determine filename encoding
            var isUtf8 = (flags & _constantsts.FLAG_UTF8) !== 0;
            var fileName = void 0;
            if (isUtf8) {
                fileName = buffer.toString('utf8', pos + 46, pos + 46 + fileNameLength);
            } else {
                // CP437 is the original IBM PC character set and ZIP default
                fileName = (0, _cp437ts.decodeCP437)(buffer, pos + 46, pos + 46 + fileNameLength);
            }
            map[fileName] = {
                fileName: fileName,
                externalAttributes: externalAttributes,
                platform: platform
            };
            pos += headerSize;
        }
        callback(null, map);
    });
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
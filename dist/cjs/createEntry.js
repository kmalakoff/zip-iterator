/**
 * Create Entry from ZIP Header
 *
 * Creates the appropriate entry type (File, Directory, SymbolicLink, Link)
 * based on the parsed LocalFileHeader and Central Directory info.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, /**
 * Create an entry from a LocalFileHeader and stream
 */ "default", {
    enumerable: true,
    get: function() {
        return createEntry;
    }
});
var _calloncefn = /*#__PURE__*/ _interop_require_default(require("call-once-fn"));
var _extractbaseiterator = require("extract-base-iterator");
var _FileEntryts = /*#__PURE__*/ _interop_require_default(require("./FileEntry.js"));
var _parseExternalFileAttributests = /*#__PURE__*/ _interop_require_default(require("./lib/parseExternalFileAttributes.js"));
var _constantsts = require("./zip/constants.js");
var _extrafieldsts = require("./zip/extra-fields.js");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function createEntry(header, stream, lock, next, callback, cdEntry) {
    var cb = (0, _calloncefn.default)(function(err, entry) {
        next();
        setTimeout(function() {
            if (err) return callback(err);
            entry ? callback(undefined, {
                done: false,
                value: entry
            }) : callback(undefined, {
                done: true,
                value: undefined
            });
        }, 0);
    });
    // Parse external attributes for type and permissions
    var attributes = getAttributes(header, cdEntry);
    switch(attributes.type){
        case 'directory':
            cb(null, new _extractbaseiterator.DirectoryEntry(attributes));
            return;
        case 'symlink':
        case 'link':
            (0, _extractbaseiterator.streamToString)(stream, function(err, target) {
                if (err) return cb(err);
                var linkAttributes = _object_spread_props(_object_spread({}, attributes), {
                    linkpath: target || ''
                });
                var LinkClass = attributes.type === 'symlink' ? _extractbaseiterator.SymbolicLinkEntry : _extractbaseiterator.LinkEntry;
                cb(null, new LinkClass(linkAttributes));
            });
            return;
        case 'file':
            cb(null, new _FileEntryts.default(attributes, stream, lock));
            return;
        default:
            cb(new Error("Unrecognized entry type: ".concat(attributes.type)));
    }
}
/**
 * Extract attributes from header and Central Directory entry
 */ function getAttributes(header, cdEntry) {
    // Normalize path - remove leading/trailing slashes, normalize separators
    var filePath = (0, _extractbaseiterator.normalizePath)(header.fileName);
    // Detect directory by trailing slash in original filename
    var isDirectory = header.fileName.charAt(header.fileName.length - 1) === '/';
    // Default type based on filename pattern
    var type = isDirectory ? 'directory' : 'file';
    // Default mode
    var mode = isDirectory ? _constantsts.MODE_DEFAULT_DIR : _constantsts.MODE_DEFAULT_FILE;
    // If we have Central Directory entry, use external attributes for accurate type detection
    if (cdEntry) {
        var parsed = (0, _parseExternalFileAttributests.default)(cdEntry.externalAttributes, cdEntry.platform);
        type = parsed.type;
        mode = parsed.mode;
    } else {
        // Try ASi extra field for symlink detection in streaming mode
        var asiInfo = (0, _extrafieldsts.findAsiInfo)(header.extraFields);
        if (asiInfo) {
            var fileType = asiInfo.mode & 0xf000;
            if (fileType === _constantsts.S_IFLNK) {
                type = 'symlink';
            } else if (fileType === _constantsts.S_IFDIR) {
                type = 'directory';
            } else if (fileType === _constantsts.S_IFREG) {
                type = 'file';
            }
            // Use lower 12 bits as permissions
            mode = asiInfo.mode & 0x0fff;
        }
    }
    // Get modification time as timestamp
    var mtime = header.mtime.getTime();
    // Try to get extended timestamp for better precision
    var extTimestamp = (0, _extrafieldsts.findExtendedTimestamp)(header.extraFields);
    if (extTimestamp && extTimestamp.mtime) {
        mtime = extTimestamp.mtime * 1000;
    }
    return {
        type: type,
        path: filePath,
        mode: mode,
        mtime: mtime
    };
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
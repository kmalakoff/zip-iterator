"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return nextEntry;
    }
});
var _path = /*#__PURE__*/ _interop_require_default(require("path"));
var _lodashcompact = /*#__PURE__*/ _interop_require_default(require("lodash.compact"));
var _once = /*#__PURE__*/ _interop_require_default(require("once"));
var _extractbaseiterator = require("extract-base-iterator");
var _FileEntry = /*#__PURE__*/ _interop_require_default(require("./FileEntry.js"));
var _parseExternalFileAttributes = /*#__PURE__*/ _interop_require_default(require("./lib/parseExternalFileAttributes.js"));
var _streamToString = /*#__PURE__*/ _interop_require_default(require("./lib/streamToString.js"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function nextEntry(iterator, callback) {
    if (!iterator.iterator) return callback(new Error('iterator missing'));
    var entry = null;
    while(!entry){
        try {
            entry = iterator.iterator.next();
        } catch (err) {
            if (err === 'stop-iteration') break;
            if (err === 'skip-iteration') continue;
            throw err;
        }
    }
    var _callback = callback;
    callback = (0, _once.default)(function callback(err, entry) {
        // keep processing
        if (entry) iterator.stack.push(nextEntry);
        err ? _callback(err) : _callback(null, entry);
    });
    // done: use null to indicate iteration is complete
    if (iterator.done || !entry) return callback(null, null);
    var localHeader = entry.localHeader;
    var centralHeader = entry.centralHeader;
    var attributes = (0, _parseExternalFileAttributes.default)(centralHeader.external_file_attributes, centralHeader.version >> 8);
    attributes.path = (0, _lodashcompact.default)(localHeader.file_name.split(_path.default.sep)).join(_path.default.sep);
    attributes.mtime = entry.lastModified();
    switch(attributes.type){
        case 'directory':
            return callback(null, new _extractbaseiterator.DirectoryEntry(attributes));
        case 'symlink':
        case 'link':
            return (0, _streamToString.default)(entry.getStream(), function(err, string) {
                if (err) return callback(err);
                attributes.linkpath = string;
                var Link = attributes.type === 'symlink' ? _extractbaseiterator.SymbolicLinkEntry : _extractbaseiterator.LinkEntry;
                return callback(null, new Link(attributes));
            });
        case 'file':
            return callback(null, new _FileEntry.default(attributes, entry, iterator.lock));
    }
    return callback(new Error("Unrecognized entry type: ".concat(attributes.type)));
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) exports.default[key] = exports[key]; module.exports = exports.default; }
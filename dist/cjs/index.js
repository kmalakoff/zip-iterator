"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    DirectoryEntry: function() {
        return _extractbaseiterator.DirectoryEntry;
    },
    FileEntry: function() {
        return _FileEntry.default;
    },
    LinkEntry: function() {
        return _extractbaseiterator.LinkEntry;
    },
    SymbolicLinkEntry: function() {
        return _extractbaseiterator.SymbolicLinkEntry;
    },
    default: function() {
        return _default;
    }
});
var _ZipIterator = /*#__PURE__*/ _interop_require_default(require("./ZipIterator.js"));
var _FileEntry = /*#__PURE__*/ _interop_require_default(require("./FileEntry.js"));
var _extractbaseiterator = require("extract-base-iterator");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
var _default = _ZipIterator.default;
/* CJS INTEROP */ if (exports.__esModule && exports.default) { module.exports = exports.default; for (var key in exports) module.exports[key] = exports[key]; }
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
    Zip: function() {
        return _Zipcjs.default;
    },
    default: function() {
        return _default;
    }
});
require("./polyfills.js");
var _Zipcjs = /*#__PURE__*/ _interop_require_default(require("./lib/Zip.js"));
var _extractbaseiterator = /*#__PURE__*/ _interop_require_default(require("extract-base-iterator"));
var _ZipIteratorcjs = /*#__PURE__*/ _interop_require_default(require("./ZipIterator.js"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
_ZipIteratorcjs.default.DirectoryEntry = _extractbaseiterator.default.DirectoryEntry;
_ZipIteratorcjs.default.FileEntry = require("./FileEntry.js");
_ZipIteratorcjs.default.LinkEntry = _extractbaseiterator.default.LinkEntry;
_ZipIteratorcjs.default.SymbolicLinkEntry = _extractbaseiterator.default.SymbolicLinkEntry;
var _default = _ZipIteratorcjs.default;

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  for (var key in exports) exports.default[key] = exports[key];
  module.exports = exports.default;
}
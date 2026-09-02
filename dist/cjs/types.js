/**
 * Type definitions for zip-iterator
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
    get DirectoryEntry () {
        return _extractbaseiterator.DirectoryEntry;
    },
    get FileEntry () {
        return _FileEntryts.default;
    },
    get LinkEntry () {
        return _extractbaseiterator.LinkEntry;
    },
    get Lock () {
        return _extractbaseiterator.Lock;
    },
    get SymbolicLinkEntry () {
        return _extractbaseiterator.SymbolicLinkEntry;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
var _FileEntryts = /*#__PURE__*/ _interop_require_default(require("./FileEntry.js"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
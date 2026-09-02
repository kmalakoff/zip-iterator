/**
 * ZIP Parser Module
 *
 * Forward-only ZIP parsing for streaming extraction.
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
    get BufferList () {
        return _extractbaseiterator.BufferList;
    },
    get ZipExtract () {
        return _ZipExtractts.default;
    },
    get crc32 () {
        return _extractbaseiterator.crc32;
    },
    get crc32Region () {
        return _extractbaseiterator.crc32Region;
    },
    get verifyCrc32 () {
        return _extractbaseiterator.verifyCrc32;
    },
    get verifyCrc32Region () {
        return _extractbaseiterator.verifyCrc32Region;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
_export_star(require("./CentralDirectory.js"), exports);
_export_star(require("./constants.js"), exports);
_export_star(require("./cp437.js"), exports);
_export_star(require("./extra-fields.js"), exports);
_export_star(require("./headers.js"), exports);
var _ZipExtractts = /*#__PURE__*/ _interop_require_default(require("./ZipExtract.js"));
function _export_star(from, to) {
    Object.keys(from).forEach(function(k) {
        if (k !== "default" && !Object.prototype.hasOwnProperty.call(to, k)) {
            Object.defineProperty(to, k, {
                enumerable: true,
                get: function() {
                    return from[k];
                }
            });
        }
    });
    return from;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
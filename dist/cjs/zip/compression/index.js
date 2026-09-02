/**
 * Compression Handlers for ZIP extraction
 *
 * Provides abstractions for DEFLATE and STORE compression methods.
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
    get DeflateBufferHandler () {
        return _DeflateBufferts.DeflateBufferHandler;
    },
    get DeflateStreamHandler () {
        return _DeflateStreamts.DeflateStreamHandler;
    },
    get StoreHandler () {
        return _StoreStreamts.StoreHandler;
    }
});
var _DeflateBufferts = require("./DeflateBuffer.js");
var _DeflateStreamts = require("./DeflateStream.js");
var _StoreStreamts = require("./StoreStream.js");
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
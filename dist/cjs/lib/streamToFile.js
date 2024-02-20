"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return streamToFile;
    }
});
var _fs = /*#__PURE__*/ _interop_require_default(require("fs"));
var _path = /*#__PURE__*/ _interop_require_default(require("path"));
var _endofstream = /*#__PURE__*/ _interop_require_default(require("end-of-stream"));
var _mkpath = /*#__PURE__*/ _interop_require_default(require("mkpath"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function streamToFile(source, filePath, callback) {
    _mkpath.default.sync(_path.default.dirname(filePath)); // sync to not pause the stream
    var err = null;
    function cleanup() {
        source.removeListener("error", onError);
    }
    function onError(_err) {
        err = _err;
        cleanup();
        callback(err);
    }
    source.on("error", onError);
    (0, _endofstream.default)(source.pipe(_fs.default.createWriteStream(filePath)), function(err) {
        if (err) return;
        cleanup();
        callback(err);
    });
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) exports.default[key] = exports[key]; module.exports = exports.default; }
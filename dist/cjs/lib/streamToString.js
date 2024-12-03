"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return streamToString;
    }
});
var _endofstream = /*#__PURE__*/ _interop_require_default(require("end-of-stream"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function streamToString(stream, callback) {
    var string = '';
    stream.on('data', function(chunk) {
        string += chunk.toString();
    });
    (0, _endofstream.default)(stream, function(err) {
        err ? callback(err) : callback(null, string);
    });
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
var _fs = /*#__PURE__*/ _interop_require_default(require("fs"));
var _extractbaseiterator = /*#__PURE__*/ _interop_require_default(require("extract-base-iterator"));
var _lifecycle = /*#__PURE__*/ _interop_require_default(require("lifecycle"));
var _rimraf2 = /*#__PURE__*/ _interop_require_default(require("rimraf2"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
var _default = _lifecycle.default.RefCountable.extend({
    constructor: function constructor() {
        _lifecycle.default.RefCountable.prototype.constructor.call(this);
    },
    __destroy: function __destroy() {
        if (this.tempPath) {
            try {
                _rimraf2.default.sync(this.tempPath, {
                    disableGlob: true
                });
            } catch (_err) {
            /* empty */ }
            this.tempPath = null;
        }
        if (this.fd) {
            _fs.default.closeSync(this.fd);
            this.fd = null;
        }
        if (this.iterator) {
            _extractbaseiterator.default.prototype.end.call(this.iterator, this.err || null);
            this.iterator = null;
        }
    }
});
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
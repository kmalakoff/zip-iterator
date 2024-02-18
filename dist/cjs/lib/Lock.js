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
var _rimraf = /*#__PURE__*/ _interop_require_default(require("rimraf"));
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
                _rimraf.default.sync(this.tempPath);
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
/* CJS INTEROP */ if (exports.__esModule && exports.default) { module.exports = exports.default; for (var key in exports) module.exports[key] = exports[key]; }
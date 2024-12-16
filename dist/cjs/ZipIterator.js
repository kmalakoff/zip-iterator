"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return ZipIterator;
    }
});
var _fs = /*#__PURE__*/ _interop_require_default(require("fs"));
var _path = /*#__PURE__*/ _interop_require_default(require("path"));
require("./polyfills.js");
var _extractbaseiterator = /*#__PURE__*/ _interop_require_default(require("extract-base-iterator"));
var _queuecb = /*#__PURE__*/ _interop_require_default(require("queue-cb"));
var _shorthash = /*#__PURE__*/ _interop_require_default(require("short-hash"));
var _tempsuffix = /*#__PURE__*/ _interop_require_default(require("temp-suffix"));
var _Lock = /*#__PURE__*/ _interop_require_default(require("./lib/Lock.js"));
var _Zip = /*#__PURE__*/ _interop_require_default(require("./lib/Zip.js"));
var _fifoRemove = /*#__PURE__*/ _interop_require_default(require("./lib/fifoRemove.js"));
var _streamToFile = /*#__PURE__*/ _interop_require_default(require("./lib/streamToFile.js"));
var _nextEntry = /*#__PURE__*/ _interop_require_default(require("./nextEntry.js"));
var _os = /*#__PURE__*/ _interop_require_default(require("os"));
var _osshim = /*#__PURE__*/ _interop_require_default(require("os-shim"));
function _assert_this_initialized(self) {
    if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
}
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _get_prototype_of(o) {
    _get_prototype_of = Object.setPrototypeOf ? Object.getPrototypeOf : function getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _get_prototype_of(o);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _set_prototype_of(subClass, superClass);
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) {
        return call;
    }
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
}
var tmpdir = _os.default.tmpdir || _osshim.default.tmpdir;
var ZipIterator = /*#__PURE__*/ function(BaseIterator) {
    "use strict";
    _inherits(ZipIterator, BaseIterator);
    function ZipIterator(source, options) {
        _class_call_check(this, ZipIterator);
        var _this;
        var setup = function setup() {
            cancelled = true;
        };
        _this = _call_super(this, ZipIterator, [
            options
        ]);
        _this.lock = new _Lock.default();
        _this.lock.iterator = _this;
        var queue = new _queuecb.default(1);
        var cancelled = false;
        _this.processing.push(setup);
        if (typeof source !== 'string') {
            _this.lock.tempPath = _path.default.join(tmpdir(), 'zip-iterator', (0, _shorthash.default)(process.cwd()), (0, _tempsuffix.default)('tmp.zip'));
            queue.defer(_streamToFile.default.bind(null, source, _this.lock.tempPath));
        }
        // open zip
        queue.defer(function(callback) {
            _fs.default.open(_this.lock.tempPath || source, 'r', '0666', function(err, fd) {
                if (_this.done || cancelled) return; // done
                if (err) return callback(err);
                var reader = new _Zip.default(fd);
                _this.lock.fd = fd;
                _this.iterator = reader.iterator();
                callback();
            });
        });
        // start processing
        queue.await(function(err) {
            (0, _fifoRemove.default)(_this.processing, setup);
            if (_this.done || cancelled) return; // done
            err ? _this.end(err) : _this.push(_nextEntry.default);
        });
        return _this;
    }
    var _proto = ZipIterator.prototype;
    _proto.end = function end(err) {
        if (this.lock) {
            this.lock.err = err;
            this.lock.release();
            this.lock = null;
        } else {
            _extractbaseiterator.default.prototype.end.call(this, err); // call in lock release so end is properly handled
        }
        this.iterator = null;
    };
    return ZipIterator;
}(_extractbaseiterator.default);
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
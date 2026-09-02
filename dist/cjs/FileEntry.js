/**
 * FileEntry for ZIP archives
 *
 * Wraps a decompressed stream with the entry lifecycle.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return ZipFileEntry;
    }
});
var _calloncefn = /*#__PURE__*/ _interop_require_default(require("call-once-fn"));
var _extractbaseiterator = require("extract-base-iterator");
var _gracefulfs = /*#__PURE__*/ _interop_require_default(require("graceful-fs"));
var _onone = /*#__PURE__*/ _interop_require_default(require("on-one"));
function _assert_this_initialized(self) {
    if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return self;
}
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _get(target, property, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.get) _get = Reflect.get;
    else {
        _get = function get(target, property, receiver) {
            var base = _super_prop_base(target, property);
            if (!base) return;
            var desc = Object.getOwnPropertyDescriptor(base, property);
            if (desc.get) return desc.get.call(receiver || target);
            return desc.value;
        };
    }
    return _get(target, property, receiver || target);
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
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) return call;
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _super_prop_base(object, property) {
    while(!Object.prototype.hasOwnProperty.call(object, property)){
        object = _get_prototype_of(object);
        if (object === null) break;
    }
    return object;
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var ZipFileEntry = /*#__PURE__*/ function(FileEntry) {
    "use strict";
    _inherits(ZipFileEntry, FileEntry);
    function ZipFileEntry(attributes, stream, lock) {
        _class_call_check(this, ZipFileEntry);
        var _this;
        _this = _call_super(this, ZipFileEntry, [
            attributes
        ]);
        _this.stream = stream;
        _this.lock = lock;
        _this.lock.retain();
        return _this;
    }
    var _proto = ZipFileEntry.prototype;
    _proto.create = function create(dest, options, callback) {
        var _this = this;
        callback = typeof options === 'function' ? options : callback;
        options = typeof options === 'function' ? {} : options || {};
        if (typeof callback === 'function') {
            var cb = function cb(err) {
                callback(err);
                if (_this.lock) {
                    _this.lock.release();
                    _this.lock = null;
                }
            };
            _get(_get_prototype_of(ZipFileEntry.prototype), "create", this).call(this, dest, options, cb);
            return;
        }
        return new Promise(function(resolve, reject) {
            return _this.create(dest, options, function(err) {
                return err ? reject(err) : resolve(true);
            });
        });
    };
    _proto._writeFile = function _writeFile(fullPath, _options, callback) {
        if (!this.stream) {
            callback(new Error('Zip FileEntry missing stream. Check for calling create multiple times'));
            return;
        }
        var stream = this.stream;
        this.stream = null; // Prevent reuse
        var cb = (0, _calloncefn.default)(function(err) {
            err ? callback(err) : (0, _extractbaseiterator.waitForAccess)(fullPath, callback);
        });
        try {
            var writeStream = _gracefulfs.default.createWriteStream(fullPath);
            stream.on('error', function(streamErr) {
                var ws = writeStream;
                writeStream.on('error', function() {});
                if (typeof ws.destroy === 'function') ws.destroy();
                cb(streamErr);
            });
            stream.pipe(writeStream);
            (0, _onone.default)(writeStream, [
                'error',
                'close',
                'finish'
            ], cb);
        } catch (err) {
            cb(err);
        }
    };
    _proto.destroy = function destroy() {
        _get(_get_prototype_of(ZipFileEntry.prototype), "destroy", this).call(this);
        if (this.stream) {
            this.stream.resume(); // drain stream
            this.stream = null;
        }
        if (this.lock) {
            this.lock.release();
            this.lock = null;
        }
    };
    return ZipFileEntry;
}(_extractbaseiterator.FileEntry);
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
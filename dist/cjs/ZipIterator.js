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
var _extractbaseiterator = /*#__PURE__*/ _interop_require_wildcard(require("extract-base-iterator"));
var _gracefulfs = /*#__PURE__*/ _interop_require_default(require("graceful-fs"));
var _mkdirpclassic = /*#__PURE__*/ _interop_require_default(require("mkdirp-classic"));
var _onone = /*#__PURE__*/ _interop_require_default(require("on-one"));
var _os = /*#__PURE__*/ _interop_require_default(require("os"));
var _path = /*#__PURE__*/ _interop_require_default(require("path"));
var _createEntryts = /*#__PURE__*/ _interop_require_default(require("./createEntry.js"));
var _indexts = require("./zip/index.js");
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
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) return obj;
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") return {
        default: obj
    };
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) return cache.get(obj);
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) Object.defineProperty(newObj, key, desc);
            else newObj[key] = obj[key];
        }
    }
    newObj.default = obj;
    if (cache) cache.set(obj, newObj);
    return newObj;
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
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// Get temp directory
var tmpdir = _os.default.tmpdir || _os.default.tmpdir || function() {
    return '/tmp';
};
var ZipIterator = /*#__PURE__*/ function(BaseIterator) {
    "use strict";
    _inherits(ZipIterator, BaseIterator);
    function ZipIterator(source) {
        var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        _class_call_check(this, ZipIterator);
        var _this;
        _this = _call_super(this, ZipIterator, [
            options
        ]);
        var lock = new _extractbaseiterator.Lock();
        _this.lock = lock;
        lock.onDestroy = function(err) {
            return _extractbaseiterator.default.prototype.end.call(_this, err);
        };
        _this.centralDir = null;
        _this.tempPath = null;
        _this.streamingMode = options.streaming === true;
        // Keep a setup function in processing to prevent BaseIterator from calling end()
        // prematurely when stack becomes empty between entry events.
        // This is removed in end() when the iterator actually completes.
        var cancelled = false;
        var setup = function setup() {
            cancelled = true;
        };
        _this.processing.push(setup);
        lock.setup = setup;
        // Create the forward-only parser
        _this.extract = new _indexts.ZipExtract();
        if (typeof source === 'string') {
            // For file inputs, read Central Directory first for better type detection
            (0, _indexts.readCentralDirectory)(source, function(err, map) {
                // Check if iterator was destroyed while we were reading CD
                if (_this.done || cancelled) return;
                if (!err && map) {
                    _this.centralDir = map;
                }
                // Even if CD read fails, continue with forward-only parsing
                _this.startStreaming(_gracefulfs.default.createReadStream(source));
            });
        } else if (_this.streamingMode) {
            // Pure streaming mode - no temp file, rely on ASi extra fields for symlinks
            _this.startStreaming(source);
        } else {
            // Default: buffer stream to temp file to get Central Directory access
            _this.bufferStreamAndStart(source);
        }
        return _this;
    }
    var _proto = ZipIterator.prototype;
    _proto.bufferStreamAndStart = function bufferStreamAndStart(source) {
        var _this = this;
        // Ensure temp directory exists (may not exist on Windows with Node 0.8 fallback to /tmp)
        var _tmpdir = tmpdir();
        _mkdirpclassic.default.sync(_tmpdir);
        // Generate temp file path
        this.tempPath = _path.default.join(_tmpdir, "zip-iterator-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2), ".tmp"));
        // Register cleanup for temp file
        var tempPath = this.tempPath;
        this.lock.registerCleanup(function() {
            _gracefulfs.default.unlink(tempPath, function() {});
        });
        var writeStream = _gracefulfs.default.createWriteStream(this.tempPath);
        // Handle source errors
        source.on('error', function(err) {
            var ws = writeStream;
            if (typeof ws.destroy === 'function') ws.destroy();
            _this.end(err);
        });
        // Handle write completion using on-one for Node 0.8 compatibility
        // Note: Node 0.8 may only emit 'close', not 'finish'. We use waitForAccess
        // to handle Windows where 'close' can fire before file is fully written.
        (0, _onone.default)(writeStream, [
            'error',
            'finish',
            'close'
        ], function(err) {
            if (err) {
                _this.end(err);
                return;
            }
            if (_this.done) return;
            // Wait for file to be accessible (handles Windows timing issues)
            (0, _extractbaseiterator.waitForAccess)(tempPath, function() {
                if (_this.done) return;
                // Read Central Directory from temp file
                (0, _indexts.readCentralDirectory)(tempPath, function(cdErr, map) {
                    if (_this.done) return;
                    if (!cdErr && map) _this.centralDir = map;
                    // Start streaming from temp file
                    _this.startStreaming(_gracefulfs.default.createReadStream(tempPath));
                });
            });
        });
        source.pipe(writeStream);
    };
    _proto.startStreaming = function startStreaming(stream) {
        var _this = this;
        // Guard: if iterator was destroyed before async callback, clean up and exit
        if (!this.lock) {
            var s = stream;
            if (typeof s.destroy === 'function') s.destroy();
            return;
        }
        // Register cleanup for source stream
        this.lock.registerCleanup(function() {
            var s = stream;
            if (typeof s.destroy === 'function') {
                s.destroy();
            }
        });
        var extract = this.extract;
        this.lock.registerCleanup(function() {
            extract.end();
        });
        extract.on('entry', function(header, entryStream, next) {
            if (_this.done) {
                next();
                return;
            }
            var cdEntry = _this.centralDir ? _this.centralDir[header.fileName] : null;
            _this.push(function(_iterator, callback) {
                if (!_this.lock) {
                    next();
                    callback();
                    return;
                }
                (0, _createEntryts.default)(header, entryStream, _this.lock, next, callback, cdEntry);
            });
        });
        extract.on('error', function(err) {
            _this.end(err);
        });
        extract.on('finish', function() {
            if (!_this.done) {
                _this.end();
            }
        });
        // NOW set up stream handlers - data will start flowing after 'data' handler is attached
        stream.on('data', function(chunk) {
            if (!_this.done && _this.extract) {
                _this.extract.write(chunk);
            }
        });
        // Handle stream end/error using on-one for Node 0.8 compatibility
        (0, _onone.default)(stream, [
            'error',
            'end',
            'close'
        ], function(err) {
            if (err) {
                _this.end(err);
            } else if (_this.extract) {
                // Signal end to parser - it will emit 'finish' or 'error' which will trigger cleanup
                _this.extract.end();
            }
        });
    };
    _proto.end = function end(err) {
        var lock = this.lock;
        if (lock) {
            this.lock = null; // Clear FIRST to prevent re-entrancy
            // Remove setup from processing before release
            if (lock.setup) {
                this.processing.remove(lock.setup);
                lock.setup = null;
            }
            lock.err = err !== null && err !== void 0 ? err : null;
            lock.release();
        }
        // Clear local refs (always runs, safe/idempotent)
        this.extract = null;
        this.centralDir = null;
        this.tempPath = null;
    };
    return ZipIterator;
}(_extractbaseiterator.default);
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return Zip;
    }
});
var _zip = require("zip");
var _fs = /*#__PURE__*/ _interop_require_default(require("fs"));
var _stream = require("stream");
var _zlib = /*#__PURE__*/ _interop_require_default(require("zlib"));
function _assert_this_initialized(self) {
    if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
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
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;
    try {
        Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
        return true;
    } catch (e) {
        return false;
    }
}
function _create_super(Derived) {
    var hasNativeReflectConstruct = _is_native_reflect_construct();
    return function _createSuperInternal() {
        var Super = _get_prototype_of(Derived), result;
        if (hasNativeReflectConstruct) {
            var NewTarget = _get_prototype_of(this).constructor;
            result = Reflect.construct(Super, arguments, NewTarget);
        } else {
            result = Super.apply(this, arguments);
        }
        return _possible_constructor_return(this, result);
    };
}
var decodeDateTime = function(date, time) {
    return new Date((date >>> 9) + 1980, (date >>> 5 & 15) - 1, date & 31, time >>> 11 & 31, time >>> 5 & 63, (time & 63) * 2);
};
var Zip = /*#__PURE__*/ function(Reader) {
    "use strict";
    _inherits(Zip, Reader);
    var _super = _create_super(Zip);
    function Zip(fd) {
        _class_call_check(this, Zip);
        var _this;
        _this = _super.call(this, fd);
        // patch pos
        _this._source.read = function(start, length) {
            var result = Buffer.alloc(length);
            var pos = 0;
            while(length > 0){
                var toRead = Math.min(length, 8192);
                _fs.default.readSync(fd, result, pos, toRead, start);
                length -= toRead;
                start += toRead;
                pos += toRead;
            }
            return result;
        };
        return _this;
    }
    _create_class(Zip, [
        {
            key: "iterator",
            value: function iterator() {
                var stream = this;
                // find the end record and read it
                stream.locateEndOfCentralDirectoryRecord();
                var endRecord = stream.readEndOfCentralDirectoryRecord();
                // seek to the beginning of the central directory
                stream.seek(endRecord.central_dir_offset);
                var count = endRecord.central_dir_disk_records;
                return {
                    next: function() {
                        if (count-- === 0) throw "stop-iteration";
                        // read the central directory header
                        var centralHeader = stream.readCentralDirectoryFileHeader();
                        // save our new position so we can restore it
                        var saved = stream.position();
                        // seek to the local header and read it
                        stream.seek(centralHeader.local_file_header_offset);
                        var localHeader = stream.readLocalFileHeader();
                        // dont read the content just save the position for later use
                        var start = stream.position();
                        // seek back to the next central directory header
                        stream.seek(saved);
                        return {
                            localHeader: localHeader,
                            stream: stream,
                            start: start,
                            centralHeader: centralHeader,
                            lastModified: function() {
                                return decodeDateTime(localHeader.last_mod_file_date, localHeader.last_mod_file_time);
                            },
                            getStream: function() {
                                var offset = start;
                                var remaining = centralHeader.compressed_size;
                                var res = new _stream.Readable();
                                res._read = function(size) {
                                    if (remaining <= 0) return this.push(null); // done
                                    if (size > remaining) size = remaining; // clamp
                                    var bookmark = stream.position(); // save
                                    stream.seek(offset);
                                    var chunk = stream.read(size);
                                    remaining -= size;
                                    offset += size;
                                    stream.seek(bookmark); // restore
                                    this.push(chunk);
                                };
                                if (centralHeader.compression_method !== 0) res = res.pipe(_zlib.default.createInflateRaw());
                                return res;
                            }
                        };
                    }
                };
            }
        }
    ]);
    return Zip;
}(_zip.Reader);
/* CJS INTEROP */ if (exports.__esModule && exports.default) { module.exports = exports.default; for (var key in exports) module.exports[key] = exports[key]; }
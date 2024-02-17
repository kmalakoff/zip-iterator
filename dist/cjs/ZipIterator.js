"use strict";
function _instanceof(left, right) {
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
var fs = require("fs");
var path = require("path");
var inherits = require("inherits");
var BaseIterator = require("extract-base-iterator").default;
var Queue = require("queue-cb");
var tmpdir = require("os").tmpdir || require("os-shim").tmpdir;
var shortHash = require("short-hash");
var tempSuffix = require("temp-suffix");
var nextEntry = require("./nextEntry.js");
var fifoRemove = require("./lib/fifoRemove.js");
var Zip = require("./lib/Zip.js");
var Lock = require("./lib/Lock.js");
var streamToFile = require("./lib/streamToFile.js");
function ZipIterator(source, options) {
    var _this = this;
    if (!_instanceof(this, ZipIterator)) return new ZipIterator(source, options);
    BaseIterator.call(this, options);
    this.lock = new Lock();
    this.lock.iterator = this;
    var queue = Queue(1);
    var cancelled = false;
    function setup() {
        cancelled = true;
    }
    this.processing.push(setup);
    if (typeof source !== "string") {
        this.lock.tempPath = path.join(tmpdir(), "zip-iterator", shortHash(process.cwd()), tempSuffix("tmp.zip"));
        queue.defer(streamToFile.bind(null, source, this.lock.tempPath));
    }
    // open zip
    queue.defer(function(callback) {
        fs.open(_this.lock.tempPath || source, "r", "0666", function(err, fd) {
            if (_this.done || cancelled) return; // done
            if (err) return callback(err);
            var reader = Zip(fd);
            _this.lock.fd = fd;
            _this.iterator = reader.iterator();
            callback();
        });
    });
    // start processing
    queue.await(function(err) {
        fifoRemove(_this.processing, setup);
        if (_this.done || cancelled) return; // done
        err ? _this.end(err) : _this.push(nextEntry);
    });
}
inherits(ZipIterator, BaseIterator);
ZipIterator.prototype.end = function end(err) {
    if (this.lock) {
        this.lock.err = err;
        this.lock.release();
        this.lock = null;
    } else {
        BaseIterator.prototype.end.call(this, err); // call in lock release so end is properly handled
    }
    this.iterator = null;
};
module.exports = ZipIterator;

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  for (var key in exports) exports.default[key] = exports[key];
  module.exports = exports.default;
}
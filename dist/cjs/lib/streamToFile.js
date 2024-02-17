"use strict";
var fs = require("fs");
var path = require("path");
var mkpath = require("mkpath");
var eos = require("end-of-stream");
module.exports = function streamToFile(source, filePath, callback) {
    mkpath.sync(path.dirname(filePath)); // sync to not pause the stream
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
    eos(source.pipe(fs.createWriteStream(filePath)), function(err) {
        if (err) return;
        cleanup();
        callback(err);
    });
};

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  for (var key in exports) exports.default[key] = exports[key];
  module.exports = exports.default;
}
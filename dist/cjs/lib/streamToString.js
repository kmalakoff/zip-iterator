"use strict";
var eos = require("end-of-stream");
module.exports = function streamToString(stream, callback) {
    var string = "";
    stream.on("data", function(chunk) {
        string += chunk.toString();
    });
    eos(stream, function(err) {
        err ? callback(err) : callback(null, string);
    });
};

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  for (var key in exports) exports.default[key] = exports[key];
  module.exports = exports.default;
}
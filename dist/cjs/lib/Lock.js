"use strict";
var LC = require("lifecycle");
var rimraf = require("rimraf");
var fs = require("fs");
var BaseIterator = require("extract-base-iterator").default;
module.exports = LC.RefCountable.extend({
    constructor: function constructor() {
        LC.RefCountable.prototype.constructor.call(this);
    },
    __destroy: function __destroy() {
        if (this.tempPath) {
            try {
                rimraf.sync(this.tempPath);
            } catch (_err) {
            /* empty */ }
            this.tempPath = null;
        }
        if (this.fd) {
            fs.closeSync(this.fd);
            this.fd = null;
        }
        if (this.iterator) {
            BaseIterator.prototype.end.call(this.iterator, this.err || null);
            this.iterator = null;
        }
    }
});

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  for (var key in exports) exports.default[key] = exports[key];
  module.exports = exports.default;
}
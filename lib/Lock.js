var LC = require('lifecycle');
var rimraf = require('rimraf');
var fs = require('fs');
var BaseIterator = require('extract-base-iterator');

module.exports = LC.RefCountable.extend({
  constructor: function () {
    LC.RefCountable.prototype.constructor.apply(this, arguments);
  },
  __destroy: function () {
    if (this.tempPath) {
      try {
        rimraf.sync(this.tempPath);
      } catch (err) {
        /* empty */
      }
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
  },
});

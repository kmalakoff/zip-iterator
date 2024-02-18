import fs from 'fs';
import BaseIterator from 'extract-base-iterator';
import LC from 'lifecycle';
import rimraf from 'rimraf';

export default LC.RefCountable.extend({
  constructor: function () {
    LC.RefCountable.prototype.constructor.call(this);
  },
  __destroy: function () {
    if (this.tempPath) {
      try {
        rimraf.sync(this.tempPath);
      } catch (_err) {
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

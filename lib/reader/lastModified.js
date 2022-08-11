// adapted from https://github.com/kriskowal/zip/blob/master/zip.js

var decodeDateTime = function (date, time) {
  return new Date((date >>> 9) + 1980, ((date >>> 5) & 15) - 1, date & 31, (time >>> 11) & 31, (time >>> 5) & 63, (time & 63) * 2);
};

module.exports = function lastModified(entry) {
  return decodeDateTime(entry.localHeader.last_mod_file_date, entry.localHeader.last_mod_file_time);
};

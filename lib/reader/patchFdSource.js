var bops = require("bops");
var fs = require("fs");

// https://github.com/kriskowal/zip/pull/15
module.exports = function patchFdSource(reader, fd) {
  reader._source.read = function(start, length) {
		var result = bops.create(length);
    var pos = 0;
		while (length > 0) {
			var toRead = length > 8192 ? 8192: length;
			fs.readSync(fd, result, pos, toRead, start);
			length -= toRead;
			start += toRead;
			pos += toRead;
		}
		return result;
	}
}


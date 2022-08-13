var once = require('once');
var path = require('path');
var compact = require('lodash.compact');

var BaseIterator = require('extract-base-iterator');
var DirectoryEntry = BaseIterator.DirectoryEntry;
var FileEntry = require('./FileEntry');
var LinkEntry = BaseIterator.LinkEntry;
var SymbolicLinkEntry = BaseIterator.SymbolicLinkEntry;

var parseExternalFileAttributes = require('./parseExternalFileAttributes');
var lastModified = require('./reader/lastModified');
var getStream = require('./reader/getStream');
var streamToString = require('./streamToString');

function nextEntry(iterator, callback) {
  if (!iterator.iterator) return callback(new Error('iterator missing'));

  var entry = null;
  while (!entry) {
    try {
      entry = iterator.iterator.next();
    } catch (err) {
      if (err === 'stop-iteration') break;
      if (err === 'skip-iteration') continue;
      throw err;
    }
  }

  var _callback = callback;
  callback = once(function callback(err, entry) {
    // keep processing
    if (entry) iterator.stack.push(nextEntry);
    err ? _callback(err) : _callback(null, entry);
  });

  // done: use null to indicate iteration is complete
  if (iterator.done || !entry) return callback(null, null);

  var localHeader = entry.localHeader;
  var centralHeader = entry.centralHeader;

  var attributes = parseExternalFileAttributes(centralHeader.external_file_attributes, centralHeader.version >> 8);
  attributes.path = compact(localHeader.file_name.split(path.sep)).join(path.sep);
  attributes.mtime = lastModified(entry);

  switch (attributes.type) {
    case 'directory':
      return callback(null, new DirectoryEntry(attributes));
    case 'symlink':
    case 'link':
      return streamToString(getStream(entry), function(err, string) {
        if (err) return callback(err);

        attributes.linkpath = string;
        var Link = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
        return callback(null, new Link(attributes));
            });

    case 'file':
      return callback(null, new FileEntry(attributes, entry));
  }

  return callback(new Error('Unrecognized entry type: ' + attributes.type));
}

module.exports = nextEntry;

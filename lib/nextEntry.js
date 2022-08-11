var once = require('once');
var path = require('path');
var compact = require('lodash.compact');

var BaseIterator = require('extract-base-iterator');
var DirectoryEntry = BaseIterator.DirectoryEntry;
var FileEntry = require('./FileEntry');
var LinkEntry = BaseIterator.LinkEntry;
var SymbolicLinkEntry = BaseIterator.SymbolicLinkEntry;

var streamToString = require('./streamToString');
var parseExternalFileAttributes = require('./parseExternalFileAttributes');

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

  // console.log(entry.getName(), entry.lastModified(), entry.getMode(), entry.getData().toString('utf8'));

  var _callback = callback;
  callback = once(function callback(err, entry) {
    // keep processing
    if (entry) iterator.stack.push(nextEntry);

    // use null to indicate iteration is complete
    _callback(err, err || !entry ? null : entry);
  });

  // done
  if (iterator.done || !entry) return callback(null, null);

  
  var header = entry._header;
  // var attributes = parseExternalFileAttributes(header.externalFileAttributes, header.versionMadeBy >> 8);
  var attributes = parseExternalFileAttributes(header.externalFileAttributes, header.versionMadeBy >> 8);
  if (header.file_name[header.file_name.length-1] === '/') {
    attributes.type = 'directory'
  }
  attributes.path = compact(header.file_name.split(path.sep)).join(path.sep);
  attributes.mtime = entry.lastModified();
  // attributes.mode = +entry.getMode();
 
  switch (attributes.type) {
    case 'directory':
      return callback(null, new DirectoryEntry(attributes));
    case 'symlink':
    case 'link':
      var string = entry.getData().toString('utf8');
      attributes.linkpath = string;
      var Link = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
      return callback(null, new Link(attributes));
    case 'file':
      return callback(null, new FileEntry(attributes, entry));
  }

  return callback(new Error('Unrecognized entry type: ' + attributes.type));
}

module.exports = nextEntry;

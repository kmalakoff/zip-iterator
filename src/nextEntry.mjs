import once from 'once';
import path from 'path';
import compact from 'lodash.compact';

import {DirectoryEntry, LinkEntry, SymbolicLinkEntry} from 'extract-base-iterator';
import FileEntry from './FileEntry.mjs';
import parseExternalFileAttributes from './lib/parseExternalFileAttributes.mjs';
import streamToString from './lib/streamToString.mjs';

export default function nextEntry(iterator, callback) {
  if (!iterator.iterator) return callback(new Error('iterator missing'));

  let entry = null;
  while (!entry) {
    try {
      entry = iterator.iterator.next();
    } catch (err) {
      if (err === 'stop-iteration') break;
      if (err === 'skip-iteration') continue;
      throw err;
    }
  }

  const _callback = callback;
  callback = once(function callback(err, entry) {
    // keep processing
    if (entry) iterator.stack.push(nextEntry);
    err ? _callback(err) : _callback(null, entry);
  });

  // done: use null to indicate iteration is complete
  if (iterator.done || !entry) return callback(null, null);

  const localHeader = entry.localHeader;
  const centralHeader = entry.centralHeader;

  const attributes = parseExternalFileAttributes(centralHeader.external_file_attributes, centralHeader.version >> 8);
  attributes.path = compact(localHeader.file_name.split(path.sep)).join(path.sep);
  attributes.mtime = entry.lastModified();

  switch (attributes.type) {
    case 'directory':
      return callback(null, new DirectoryEntry(attributes));
    case 'symlink':
    case 'link':
      return streamToString(entry.getStream(), (err, string) => {
        if (err) return callback(err);

        attributes.linkpath = string;
        const Link = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
        return callback(null, new Link(attributes));
      });

    case 'file':
      return callback(null, new FileEntry(attributes, entry, iterator.lock));
  }

  return callback(new Error(`Unrecognized entry type: ${attributes.type}`));
}

import path from 'path';
import once from 'call-once-fn';
import compact from 'lodash.compact';

import { type DirectoryAttributes, DirectoryEntry, type FileAttributes, type LinkAttributes, LinkEntry, SymbolicLinkEntry } from 'extract-base-iterator';
import FileEntry from './FileEntry.js';
import parseExternalFileAttributes from './lib/parseExternalFileAttributes.js';
import streamToString from './lib/streamToString.js';

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
      return callback(null, new DirectoryEntry(attributes as DirectoryAttributes));
    case 'symlink':
    case 'link':
      return streamToString(entry.getStream(), (err, string) => {
        if (err) return callback(err);

        const linkAttributes = attributes as unknown as LinkAttributes;
        linkAttributes.linkpath = string;
        const Link = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
        return callback(null, new Link(linkAttributes));
      });

    case 'file':
      return callback(null, new FileEntry(attributes as FileAttributes, entry, iterator.lock));
  }

  return callback(new Error(`Unrecognized entry type: ${attributes.type}`));
}

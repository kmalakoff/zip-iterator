import path from 'path';
import once from 'call-once-fn';
import compact from 'lodash.compact';

import FileEntry from './FileEntry.js';
import parseExternalFileAttributes from './lib/parseExternalFileAttributes.js';
import streamToString from './lib/streamToString.js';

import { type DirectoryAttributes, DirectoryEntry, type FileAttributes, type LinkAttributes, LinkEntry, SymbolicLinkEntry } from 'extract-base-iterator';
import type { AbstractZipIterator, Entry, EntryCallback } from './types.js';

export type NextCallback = (error?: Error, entry?: Entry) => undefined;

export default function nextEntry<_T>(iterator: AbstractZipIterator, callback: EntryCallback): undefined {
  if (!iterator.iterator) {
    callback(new Error('iterator missing'));
    return;
  }

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

  const nextCallback = once((err?: Error, entry?: Entry) => {
    // keep processing
    if (entry) iterator.stack.push(nextEntry);
    err ? callback(err) : callback(null, entry ? { done: false, value: entry } : { done: true, value: null });
  }) as NextCallback;

  // done: use null to indicate iteration is complete
  if (iterator.done || !entry) return callback(null, null);

  const localHeader = entry.localHeader;
  const centralHeader = entry.centralHeader;

  const attributes = parseExternalFileAttributes(centralHeader.external_file_attributes, centralHeader.version >> 8);
  attributes.path = compact(localHeader.file_name.split(path.sep)).join(path.sep);
  attributes.mtime = entry.lastModified();

  switch (attributes.type) {
    case 'directory':
      return nextCallback(null, new DirectoryEntry(attributes as DirectoryAttributes));
    case 'symlink':
    case 'link':
      streamToString(entry.getStream(), (err, string) => {
        if (err) return callback(err);

        const linkAttributes = attributes as unknown as LinkAttributes;
        linkAttributes.linkpath = string;
        const Link = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
        return nextCallback(null, new Link(linkAttributes));
      });
      return;

    case 'file':
      return nextCallback(null, new FileEntry(attributes as FileAttributes, entry, iterator.lock));
  }

  return callback(new Error(`Unrecognized entry type: ${attributes.type}`));
}

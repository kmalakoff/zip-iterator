import './polyfills.cjs';

export { default as Zip } from './lib/Zip.cjs';

import BaseIterator from 'extract-base-iterator';
import ZipIterator from './ZipIterator.cjs';

ZipIterator.DirectoryEntry = BaseIterator.DirectoryEntry;
ZipIterator.FileEntry = require('./FileEntry.cjs');
ZipIterator.LinkEntry = BaseIterator.LinkEntry;
ZipIterator.SymbolicLinkEntry = BaseIterator.SymbolicLinkEntry;
export default ZipIterator;

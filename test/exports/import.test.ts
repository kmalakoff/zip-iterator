import assert from 'assert';
import BaseIterator, { DirectoryEntry, FileEntry, LinkEntry, SymbolicLinkEntry } from 'zip-iterator';

describe('exports .ts', () => {
  it('signature', () => {
    assert.ok(BaseIterator);
    assert.ok(DirectoryEntry);
    assert.ok(FileEntry);
    assert.ok(LinkEntry);
    assert.ok(SymbolicLinkEntry);
  });
});

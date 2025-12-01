# Test Matrix

## Feature Coverage

| Feature | Test Fixture | Location | Size |
|---------|-------------|----------|------|
| **Compression Methods** | | | |
| STORE (method 0) | store.zip | Local | ~100B |
| DEFLATE (method 8) | fixture.zip | Local | ~1KB |
| **Size Handling** | | | |
| Known sizes | fixture.zip, store.zip | Local | Small |
| Data descriptor (DEFLATE) | data-descriptor.zip | Local | ~200B |
| Data descriptor (STORE) | store-data-descriptor.zip | Local | ~200B |
| ZIP64 format | lorem-zip64.zip | [Remote](https://raw.githubusercontent.com/gildas-lormeau/zip.js/master/tests/data/lorem-zip64.zip) | ~800B |
| **Entry Types** | | | |
| Regular files | fixture.zip | Local | Small |
| Directories | fixture.zip | Local | Small |
| Symlinks | fixture.zip | Local | Small |
| Hardlinks | fixture.zip | Local | Small |
| **Input Sources** | | | |
| File path | All local tests | Local | N/A |
| Stream input | callback/promise tests | Local | N/A |
| HTTP stream | ZIP64 test | Remote | N/A |
| **Encoding** | | | |
| UTF-8 filenames | Most fixtures | Local | Small |
| Non-UTF-8 (binary) | non-utf8.zip | Local | ~100B | (TDD: not yet implemented)
| **Multi-entry** | | | |
| Multiple files | fixture.zip | Local | Small |
| Multi-file data descriptor | multi-data-descriptor.zip | Local | ~300B |

## External Test Sources (for large files)

| Feature | URL | Notes |
|---------|-----|-------|
| ZIP64 | https://raw.githubusercontent.com/gildas-lormeau/zip.js/master/tests/data/lorem-zip64.zip | Small ZIP64 test file |
| Large file (>4GB) | N/A | Not practical for CI; relies on ZIP64 format test |

## Local Fixtures (in git)

All local fixtures are intentionally small (<1KB each):
- `fixture.zip` - Main test fixture with directories, files, symlinks, hardlinks
- `store.zip` - STORE compression test
- `data-descriptor.zip` - DEFLATE with data descriptor
- `store-data-descriptor.zip` - STORE with data descriptor
- `multi-data-descriptor.zip` - Multiple entries with data descriptors

**TDD (future):**
- `non-utf8.zip` - Non-UTF-8 filename encoding (not yet implemented)

## Node Version Compatibility

| Version | Local Tests | Network Tests |
|---------|-------------|---------------|
| 0.8.x | ✅ | ⏭ skipped |
| 0.10.x | ✅ | ⏭ skipped |
| 0.12.x | ✅ | ⏭ skipped |
| 4.x+ | ✅ | ✅ |

Network tests (ZIP64 from remote URL) are skipped on Node 0.x due to HTTPS API differences.
Use guard clause pattern: `if (major === 0) return;`

## Test Coverage Gaps

| Gap | Status | Notes |
|-----|--------|-------|
| Very large files (>4GB actual) | Won't fix | ZIP64 format test sufficient |
| Encrypted archives | Won't fix | Not supported by library |
| Split archives | Won't fix | Not supported by library |
| Unsupported compression | Error test | Should error gracefully |

## TDD Recommendations

### Adding New Features

1. **Add failing test first** in `test/unit/formats.test.ts`
2. **Create fixture** if needed (keep <1KB, or use remote URL)
3. **Implement feature** in `src/zip/*.ts`
4. **Run tests**: `npm test`
5. **Validate**: `npx tsds validate`

### Test Pattern (callback style for Node 0.8+ compatibility)

```typescript
describe('new feature', () => {
  // Skip on old Node if using modern APIs
  const major = +process.versions.node.split('.')[0];
  if (major === 0 && needsModernApi) return;

  it('should do something', (done) => {
    collectEntries(path.join(DATA_DIR, 'new-fixture.zip'), (err, entries) => {
      if (err) return done(err);
      assert.strictEqual(entries?.length, 1);
      done();
    });
  });
});
```

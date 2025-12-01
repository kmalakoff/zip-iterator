import assert from 'assert';
import cr from 'cr';
import fs from 'fs';
import getRemote from 'get-remote';
import mkdirp from 'mkdirp-classic';
import path from 'path';
import rimraf2 from 'rimraf2';

import ZipIterator from 'zip-iterator';
import { DATA_DIR, TMP_DIR } from '../lib/constants.ts';

const FORMATS_TMP = path.join(TMP_DIR, 'formats');

/**
 * Helper to extract all entries to a temp directory and collect results
 * Uses the PUBLIC API (entry.create) - not private stream access
 */
function extractAndCollect(zipPath: string, callback: (err: Error | null, results?: Array<{ path: string; type: string; content?: string }>) => void): void {
  const extractDir = path.join(FORMATS_TMP, `extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const zip = new ZipIterator(zipPath);
  const results: Array<{ path: string; type: string; content?: string }> = [];

  mkdirp(extractDir, (mkErr) => {
    if (mkErr) return callback(mkErr);

    zip.forEach(
      (entry, next) => {
        results.push({ path: entry.path, type: entry.type });

        // Use public API to create the entry
        entry.create(extractDir, {}, (err?: Error) => {
          if (err) return next(err);
          next();
        });
      },
      { callbacks: true },
      (err): undefined => {
        if (err) {
          callback(err);
          return;
        }

        // Read back the file contents
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.type === 'file') {
            const fullPath = path.join(extractDir, result.path);
            try {
              result.content = cr(fs.readFileSync(fullPath).toString());
            } catch (_readErr) {
              // File might not exist if extraction failed
              result.content = '';
            }
          }
        }

        callback(null, results);
      }
    );
  });
}

interface CodedError extends Error {
  code?: string;
}

/**
 * Helper to attempt extraction and expect an error with specific code
 */
function expectExtractionError(zipPath: string, expectedErrorMatch: RegExp, expectedCode: string, callback: (err: Error | null) => void): void {
  const extractDir = path.join(FORMATS_TMP, `extract-err-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const zip = new ZipIterator(zipPath);

  mkdirp(extractDir, (mkErr) => {
    if (mkErr) return callback(mkErr);

    let foundError: CodedError | null = null;

    zip.forEach(
      (entry, next) => {
        entry.create(extractDir, {}, (err?: Error) => {
          if (err) {
            foundError = err as CodedError;
            return next(err);
          }
          next();
        });
      },
      { callbacks: true },
      (err): undefined => {
        const errorToCheck = (err || foundError) as CodedError | null;
        if (errorToCheck && expectedErrorMatch.test(errorToCheck.message)) {
          // Verify error code property
          if (errorToCheck.code !== expectedCode) {
            callback(new Error(`Expected error code '${expectedCode}', got '${errorToCheck.code}'`));
            return;
          }
          // Expected error found with correct code
          callback(null);
        } else if (errorToCheck) {
          // Wrong error
          callback(new Error(`Expected error matching ${expectedErrorMatch}, got: ${errorToCheck.message}`));
        } else {
          callback(new Error(`Expected error matching ${expectedErrorMatch}, but no error occurred`));
        }
      }
    );
  });
}

describe('formats', () => {
  beforeEach((done) => {
    rimraf2(FORMATS_TMP, { disableGlob: true }, () => {
      mkdirp(FORMATS_TMP, done);
    });
  });

  describe('STORE compression', () => {
    it('should extract STORE compressed entry with correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'store.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        assert.strictEqual(results?.[0].path, 'test.txt');
        assert.strictEqual(results?.[0].type, 'file');
        assert.strictEqual(results?.[0].content, 'STORE compression test content\n');
        done();
      });
    });
  });

  describe('data descriptor (DEFLATE)', () => {
    it('should extract from file path with correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'data-descriptor.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        assert.strictEqual(results?.[0].path, 'test.txt');
        assert.strictEqual(results?.[0].type, 'file');
        assert.strictEqual(results?.[0].content, 'Data descriptor DEFLATE test content\n');
        done();
      });
    });

    it('should extract from stream with correct content', (done) => {
      const extractDir = path.join(FORMATS_TMP, 'stream-extract');
      const zipPath = path.join(DATA_DIR, 'data-descriptor.zip');
      const zip = new ZipIterator(fs.createReadStream(zipPath));
      let foundPath = '';
      let foundType = '';

      mkdirp(extractDir, (mkErr) => {
        if (mkErr) return done(mkErr);

        zip.forEach(
          (entry, next) => {
            foundPath = entry.path;
            foundType = entry.type;
            entry.create(extractDir, {}, (err?: Error) => {
              if (err) return next(err);
              next();
            });
          },
          { callbacks: true },
          (err): undefined => {
            if (err) {
              done(err);
              return;
            }
            assert.strictEqual(foundPath, 'test.txt');
            assert.strictEqual(foundType, 'file');
            const content = cr(fs.readFileSync(path.join(extractDir, 'test.txt')).toString());
            assert.strictEqual(content, 'Data descriptor DEFLATE test content\n');
            done();
          }
        );
      });
    });
  });

  describe('data descriptor (STORE)', () => {
    it('should extract STORE with data descriptor and correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'store-data-descriptor.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        assert.strictEqual(results?.[0].path, 'test.txt');
        assert.strictEqual(results?.[0].type, 'file');
        assert.strictEqual(results?.[0].content, 'STORE with data descriptor test\n');
        done();
      });
    });
  });

  describe('multi-entry data descriptor', () => {
    it('should extract multiple entries with data descriptors and correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'multi-data-descriptor.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 3);

        // Verify each entry by path and content
        const byPath: { [key: string]: { type: string; content?: string } } = {};
        if (results) {
          for (let i = 0; i < results.length; i++) {
            byPath[results[i].path] = { type: results[i].type, content: results[i].content };
          }
        }

        assert.strictEqual(byPath['file1.txt'].type, 'file');
        assert.strictEqual(byPath['file1.txt'].content, 'First file content\n');
        assert.strictEqual(byPath['file2.txt'].type, 'file');
        assert.strictEqual(byPath['file2.txt'].content, 'Second file content with more text\n');
        assert.strictEqual(byPath['file3.txt'].type, 'file');
        assert.strictEqual(byPath['file3.txt'].content, 'Third file\n');
        done();
      });
    });
  });

  describe('CP437 filename encoding', () => {
    it('should decode CP437 encoded filename to Unicode and extract correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'cp437-filename.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        // CP437 byte 0x82 = é (Latin small letter e with acute)
        assert.strictEqual(results?.[0].path, 'café.txt');
        assert.strictEqual(results?.[0].type, 'file');
        assert.strictEqual(results?.[0].content, 'Test content for CP437 filename\n');
        done();
      });
    });
  });

  describe('UTF-8 filename encoding', () => {
    it('should decode UTF-8 encoded filenames (Chinese and Japanese) and extract correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'unicode.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 5);

        // Verify all expected paths and types
        const byPath: { [key: string]: { type: string; content?: string } } = {};
        if (results) {
          for (let i = 0; i < results.length; i++) {
            byPath[results[i].path] = { type: results[i].type, content: results[i].content };
          }
        }

        // Directories
        assert.strictEqual(byPath.data_unicode.type, 'directory');
        assert.strictEqual(byPath['data_unicode/中文'].type, 'directory');
        assert.strictEqual(byPath['data_unicode/日本語'].type, 'directory');

        // Files - verify both presence and content
        assert.strictEqual(byPath['data_unicode/中文/测试.js'].type, 'file');
        assert.ok(byPath['data_unicode/中文/测试.js'].content, 'Chinese file should have content');

        assert.strictEqual(byPath['data_unicode/日本語/テスト.js'].type, 'file');
        assert.ok(byPath['data_unicode/日本語/テスト.js'].content, 'Japanese file should have content');

        done();
      });
    });
  });

  describe('CRC32 verification', () => {
    it('should detect CRC mismatch in corrupted STORE entry', (done) => {
      expectExtractionError(path.join(DATA_DIR, 'corrupted-crc.zip'), /CRC32 mismatch/, 'ZIP_CRC_MISMATCH', done);
    });

    it('should detect corruption in DEFLATE entry', (done) => {
      // Corrupted DEFLATE will either fail CRC or fail decompression
      expectExtractionError(path.join(DATA_DIR, 'corrupted-deflate.zip'), /CRC32 mismatch|incorrect|invalid/i, 'ZIP_CRC_MISMATCH', done);
    });

    it('should pass CRC verification for valid STORE entry', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'store.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        assert.strictEqual(results?.[0].content, 'STORE compression test content\n');
        done();
      });
    });

    it('should pass CRC verification for valid DEFLATE entry', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'data-descriptor.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        assert.strictEqual(results?.[0].content, 'Data descriptor DEFLATE test content\n');
        done();
      });
    });
  });

  describe('truncated archive', () => {
    it('should error on truncated header', (done) => {
      expectExtractionError(path.join(DATA_DIR, 'truncated-header.zip'), /Unexpected end of input|Truncated/, 'ZIP_TRUNCATED_ARCHIVE', done);
    });

    it('should error on truncated file data', (done) => {
      expectExtractionError(path.join(DATA_DIR, 'truncated-data.zip'), /Truncated/, 'ZIP_TRUNCATED_ARCHIVE', done);
    });
  });

  describe('long path (>256 chars)', () => {
    // Path is 258 characters (>256)
    const LONG_PATH = 'a/very/long/path/that/exceeds/the/traditional/256/character/limit/for/windows/and/other/systems/that/have/historically/had/issues/with/long/paths/so/we/need/to/test/this/properly/in/our/zip/iterator/implementation/to/ensure/proper/compatibility/here/test.txt';

    it('should extract file with path longer than 256 characters', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'long-path.zip'), (err, results) => {
        if (err) return done(err);
        // 41 directories + 1 file = 42 entries
        assert.strictEqual(results?.length, 42);

        // Find the file entry
        let fileEntry: { path: string; type: string; content?: string } | undefined;
        if (results) {
          for (let i = 0; i < results.length; i++) {
            if (results[i].type === 'file') {
              fileEntry = results[i];
              break;
            }
          }
        }

        assert.ok(fileEntry, 'Should have a file entry');
        assert.strictEqual(fileEntry?.path, LONG_PATH);
        assert.strictEqual(fileEntry?.path.length, 258, 'Path should be exactly 258 characters');
        assert.strictEqual(fileEntry?.content, 'Long path test content\n');
        done();
      });
    });
  });

  describe('ZIP64', () => {
    // Local ZIP64 fixture (primary test - no network dependency)
    it('should extract local ZIP64 archive with correct content', (done) => {
      extractAndCollect(path.join(DATA_DIR, 'zip64.zip'), (err, results) => {
        if (err) return done(err);
        assert.strictEqual(results?.length, 1);
        assert.strictEqual(results?.[0].path, 'lorem.txt');
        assert.strictEqual(results?.[0].type, 'file');
        // Verify content starts with Lorem ipsum
        assert.ok(results?.[0].content?.indexOf('Lorem ipsum dolor sit amet') === 0, 'Content should start with Lorem ipsum');
        assert.ok((results?.[0].content?.length ?? 0) > 1000, 'Content should be > 1000 chars');
        done();
      });
    });

    // Remote ZIP64 test (kept for backwards compatibility and network test coverage)
    const ZIP64_URL = 'https://raw.githubusercontent.com/gildas-lormeau/zip.js/master/tests/data/lorem-zip64.zip';
    const ZIP64_DIR = path.join(TMP_DIR, 'zip64-download');
    const ZIP64_PATH = path.join(ZIP64_DIR, 'lorem-zip64.zip');

    before((done) => {
      fs.stat(ZIP64_PATH, (err) => {
        if (!err) {
          done();
          return;
        }
        getRemote(ZIP64_URL).file(ZIP64_DIR, done);
      });
    });

    it('should extract remote ZIP64 archive with correct content', (done) => {
      const extractDir = path.join(FORMATS_TMP, 'zip64-extract');
      const zip = new ZipIterator(ZIP64_PATH);
      let foundPath = '';
      let foundType = '';

      mkdirp(extractDir, (mkErr) => {
        if (mkErr) return done(mkErr);

        zip.forEach(
          (entry, next) => {
            foundPath = entry.path;
            foundType = entry.type;
            entry.create(extractDir, {}, (err?: Error) => {
              if (err) return next(err);
              next();
            });
          },
          { callbacks: true },
          (err): undefined => {
            if (err) {
              done(err);
              return;
            }
            assert.strictEqual(foundPath, 'lorem.txt');
            assert.strictEqual(foundType, 'file');
            const content = fs.readFileSync(path.join(extractDir, 'lorem.txt')).toString();
            assert.ok(content.indexOf('Lorem ipsum dolor sit amet') === 0, 'Content should start with Lorem ipsum');
            assert.ok(content.length > 1000, 'Content should be > 1000 chars');
            done();
          }
        );
      });
    });
  });
});

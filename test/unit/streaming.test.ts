/**
 * Streaming mode tests
 *
 * Tests the `streaming: true` option which enables pure forward-only parsing
 * without buffering to temp files. This is more memory efficient but has
 * limitations for symlink detection.
 */

import assert from 'assert';
import cr from 'cr';
import fs from 'fs';
import mkdirp from 'mkdirp-classic';
import path from 'path';
import rimraf2 from 'rimraf2';

import ZipIterator from 'zip-iterator';
import { DATA_DIR, TMP_DIR } from '../lib/constants.ts';

const STREAMING_TMP = path.join(TMP_DIR, 'streaming');

describe('streaming mode', () => {
  beforeEach((done) => {
    rimraf2(STREAMING_TMP, { disableGlob: true }, () => {
      mkdirp(STREAMING_TMP, done);
    });
  });

  describe('with no symlinks', () => {
    it('should extract STORE compressed file correctly', (done) => {
      const extractDir = path.join(STREAMING_TMP, 'store-streaming');
      const zipPath = path.join(DATA_DIR, 'store.zip');
      const zip = new ZipIterator(fs.createReadStream(zipPath), { streaming: true });
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
            assert.strictEqual(content, 'STORE compression test content\n');
            done();
          }
        );
      });
    });

    it('should extract DEFLATE with data descriptor correctly', (done) => {
      const extractDir = path.join(STREAMING_TMP, 'deflate-streaming');
      const zipPath = path.join(DATA_DIR, 'data-descriptor.zip');
      const zip = new ZipIterator(fs.createReadStream(zipPath), { streaming: true });
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

    it('should extract multiple files correctly', (done) => {
      const extractDir = path.join(STREAMING_TMP, 'multi-streaming');
      const zipPath = path.join(DATA_DIR, 'multi-data-descriptor.zip');
      const zip = new ZipIterator(fs.createReadStream(zipPath), { streaming: true });
      const results: Array<{ path: string; type: string }> = [];

      mkdirp(extractDir, (mkErr) => {
        if (mkErr) return done(mkErr);

        zip.forEach(
          (entry, next) => {
            results.push({ path: entry.path, type: entry.type });
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
            assert.strictEqual(results.length, 3);

            // Verify contents
            const file1 = cr(fs.readFileSync(path.join(extractDir, 'file1.txt')).toString());
            const file2 = cr(fs.readFileSync(path.join(extractDir, 'file2.txt')).toString());
            const file3 = cr(fs.readFileSync(path.join(extractDir, 'file3.txt')).toString());

            assert.strictEqual(file1, 'First file content\n');
            assert.strictEqual(file2, 'Second file content with more text\n');
            assert.strictEqual(file3, 'Third file\n');
            done();
          }
        );
      });
    });
  });

  describe('with symlinks (Info-ZIP format)', () => {
    // Info-ZIP archives store symlink info in Central Directory only.
    // In streaming mode, without Central Directory access, symlinks
    // cannot be detected and will be extracted as regular files.
    // This is expected and documented behavior.

    it('should extract symlinks as files (no ASi extra field)', (done) => {
      const extractDir = path.join(STREAMING_TMP, 'symlink-streaming');
      const zipPath = path.join(DATA_DIR, 'fixture.zip');
      const zip = new ZipIterator(fs.createReadStream(zipPath), { streaming: true });
      const results: Array<{ path: string; type: string }> = [];

      mkdirp(extractDir, (mkErr) => {
        if (mkErr) return done(mkErr);

        zip.forEach(
          (entry, next) => {
            results.push({ path: entry.path, type: entry.type });
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

            // Find what would normally be symlinks
            const symlinks = results.filter((r) => r.path.indexOf('symlink') >= 0);
            assert.ok(symlinks.length > 0, 'Should have entries with symlink in name');

            // In streaming mode with Info-ZIP, they are extracted as files (not symlinks)
            // because the symlink type info is only in Central Directory
            for (let i = 0; i < symlinks.length; i++) {
              assert.strictEqual(symlinks[i].type, 'file', `Entry "${symlinks[i].path}" should be extracted as file in streaming mode (no CD access)`);
            }

            done();
          }
        );
      });
    });

    it('should detect symlinks correctly when NOT in streaming mode (default)', (done) => {
      // This test confirms that default mode (with temp file) correctly detects symlinks
      const extractDir = path.join(STREAMING_TMP, 'symlink-default');
      const zipPath = path.join(DATA_DIR, 'fixture.zip');
      // Note: NOT passing streaming: true, so this uses temp file buffering
      const zip = new ZipIterator(fs.createReadStream(zipPath));
      const results: Array<{ path: string; type: string }> = [];

      mkdirp(extractDir, (mkErr) => {
        if (mkErr) return done(mkErr);

        zip.forEach(
          (entry, next) => {
            results.push({ path: entry.path, type: entry.type });
            // Skip creating symlinks for this test - just check detection
            if (entry.type === 'symlink') {
              next();
              return;
            }
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

            // Find symlinks - they should be detected correctly
            const symlinks = results.filter((r) => r.type === 'symlink');
            assert.ok(symlinks.length > 0, 'Should detect symlinks in default mode (with CD access)');

            // Verify at least one symlink was detected
            const symlinkPaths = symlinks.map((s) => s.path);
            assert.ok(
              symlinkPaths.some((p) => p.indexOf('symlink') >= 0),
              'Should have detected symlink entries'
            );

            done();
          }
        );
      });
    });
  });

  describe('comparison: streaming vs default mode', () => {
    it('should produce same file content in both modes', (done) => {
      const zipPath = path.join(DATA_DIR, 'data-descriptor.zip');

      // Extract with streaming mode
      const streamingDir = path.join(STREAMING_TMP, 'compare-streaming');
      const defaultDir = path.join(STREAMING_TMP, 'compare-default');

      let streamingContent = '';
      let defaultContent = '';
      let completed = 0;

      const checkDone = () => {
        if (++completed === 2) {
          assert.strictEqual(streamingContent, defaultContent, 'Content should match between modes');
          done();
        }
      };

      // Streaming mode
      mkdirp(streamingDir, (err1) => {
        if (err1) return done(err1);

        const zipStreaming = new ZipIterator(fs.createReadStream(zipPath), { streaming: true });
        zipStreaming.forEach(
          (entry, next) => {
            entry.create(streamingDir, {}, (err?: Error) => {
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
            streamingContent = cr(fs.readFileSync(path.join(streamingDir, 'test.txt')).toString());
            checkDone();
          }
        );
      });

      // Default mode
      mkdirp(defaultDir, (err2) => {
        if (err2) return done(err2);

        const zipDefault = new ZipIterator(fs.createReadStream(zipPath));
        zipDefault.forEach(
          (entry, next) => {
            entry.create(defaultDir, {}, (err?: Error) => {
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
            defaultContent = cr(fs.readFileSync(path.join(defaultDir, 'test.txt')).toString());
            checkDone();
          }
        );
      });
    });
  });
});

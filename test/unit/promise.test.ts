import '../lib/polyfills.ts';
import assert from 'assert';
import fs from 'fs';
import mkdirp from 'mkdirp-classic';
import path from 'path';
import Pinkie from 'pinkie-promise';
import Queue from 'queue-cb';
import rimraf2 from 'rimraf2';
import bz2 from 'unbzip2-stream';
// @ts-ignore
import ZipIterator from 'zip-iterator';
import zlib from 'zlib';
import { DATA_DIR, TARGET, TMP_DIR } from '../lib/constants.ts';
import validateFiles from '../lib/validateFiles.ts';

function extract(iterator, dest, options, callback) {
  const links = [];
  iterator
    .forEach(
      (entry) => {
        if (entry.type === 'link') links.unshift(entry);
        else if (entry.type === 'symlink') links.push(entry);
        else return entry.create(dest, options);
      },
      { concurrency: options.concurrency }
    )
    .then(() => {
      // create links after directories and files
      const queue = new Queue(1);
      for (let index = 0; index < links.length; index++) {
        ((entry) => {
          queue.defer((callback) => {
            entry.create(dest, options).then(callback).catch(callback);
          });
        })(links[index]);
      }
      queue.await(callback);
    })
    .catch(callback);
}

describe('promise', () => {
  (() => {
    // patch and restore promise
    if (typeof global === 'undefined') return;
    const globalPromise = global.Promise;
    before(() => {
      global.Promise = Pinkie;
    });
    after(() => {
      global.Promise = globalPromise;
    });
  })();

  beforeEach((callback) => {
    rimraf2(TMP_DIR, { disableGlob: true }, () => {
      mkdirp(TMP_DIR, callback);
    });
  });

  describe('happy path', () => {
    it('destroy iterator', () => {
      const iterator = new ZipIterator(path.join(DATA_DIR, 'fixture.zip'));
      iterator.destroy();
      assert.ok(true);
    });

    it('destroy entries', (done) => {
      const iterator = new ZipIterator(path.join(DATA_DIR, 'fixture.zip'));
      iterator.forEach(
        (entry) => {
          entry.destroy();
        },
        (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        }
      );
    });

    it('extract - no strip - concurrency 1', (done) => {
      const options = { now: new Date(), concurrency: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'zip', (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        });
      });
    });

    it('extract - no strip - concurrency Infinity', (done) => {
      const options = { now: new Date(), concurrency: Infinity };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'zip', (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        });
      });
    });

    it('extract - stream', (done) => {
      const options = { now: new Date() };
      const source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip'));
      extract(new ZipIterator(source), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'tar', (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        });
      });
    });

    it('extract - stream bz2', (done) => {
      const options = { now: new Date() };
      let source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip.bz2'));
      source = source.pipe(bz2());
      extract(new ZipIterator(source), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'tar', (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        });
      });
    });

    it('extract - stream gz', (done) => {
      const options = { now: new Date() };
      const source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip.gz'));
      const pipeline = source.pipe(zlib.createUnzip());
      extract(new ZipIterator(pipeline), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'tar', (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        });
      });
    });

    it('extract - strip 1', (done) => {
      const options = { now: new Date(), strip: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'zip', (err) => {
          if (err) {
            done(err.message);
            return;
          }
          done();
        });
      });
    });

    it('extract multiple times', (done) => {
      const options = { now: new Date(), strip: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        if (err) {
          done(err.message);
          return;
        }

        validateFiles(options, 'tar', (err) => {
          if (err) {
            done(err.message);
            return;
          }

          extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
            assert.ok(err);

            extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, { force: true, ...options }, (err) => {
              if (err) {
                done(err.message);
                return;
              }

              validateFiles(options, 'tar', (err) => {
                if (err) {
                  done(err.message);
                  return;
                }
                done();
              });
            });
          });
        });
      });
    });
  });

  // TODO: investigate the throwing and promise race condition in node 0.8
  describe.skip('unhappy path', () => {
    it('should fail with bad path', (done) => {
      const options = { now: new Date(), strip: 2 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip' + 'does-not-exist')), TARGET, options, (err) => {
        assert.ok(!!err);
        done();
      });
    });

    it('should fail with bad stream', (done) => {
      const options = { now: new Date(), strip: 2 };
      extract(new ZipIterator(fs.createReadStream(path.join(DATA_DIR, 'fixture.zip' + 'does-not-exist'))), TARGET, options, (err) => {
        assert.ok(!!err);
        done();
      });
    });

    it('should fail with too large strip', (done) => {
      const options = { now: new Date(), strip: 2 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        assert.ok(!!err);
        done();
      });
    });
  });
});

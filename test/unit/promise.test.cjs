require('../lib/patch.cjs');
const assert = require('assert');
const rimraf2 = require('rimraf2');
const mkpath = require('mkpath');
const path = require('path');
const fs = require('fs');
const Queue = require('queue-cb');
const bz2 = require('unbzip2-stream');
const zlib = require('zlib');

const ZipIterator = require('zip-iterator');
const validateFiles = require('../lib/validateFiles.cjs');

const constants = require('../lib/constants.cjs');
const TMP_DIR = constants.TMP_DIR;
const TARGET = constants.TARGET;
const DATA_DIR = constants.DATA_DIR;

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
  if (typeof Promise === 'undefined') return;

  beforeEach((callback) => {
    rimraf2(TMP_DIR, { disableGlob: true }, (err) => {
      if (err && err.code !== 'EEXIST') return callback(err);
      mkpath(TMP_DIR, callback);
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
          assert.ok(!err, err ? err.message : '');
          done();
        }
      );
    });

    it('extract - no strip - concurrency 1', (done) => {
      const options = { now: new Date(), concurrency: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'zip', (err) => {
          assert.ok(!err, err ? err.message : '');
          done();
        });
      });
    });

    it('extract - no strip - concurrency Infinity', (done) => {
      const options = { now: new Date(), concurrency: Infinity };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'zip', (err) => {
          assert.ok(!err, err ? err.message : '');
          done();
        });
      });
    });

    it('extract - stream', (done) => {
      const options = { now: new Date() };
      const source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip'));
      extract(new ZipIterator(source), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'tar', (err) => {
          assert.ok(!err, err ? err.message : '');
          done();
        });
      });
    });

    it('extract - stream bz2', (done) => {
      const options = { now: new Date() };
      let source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip.bz2'));
      source = source.pipe(bz2());
      extract(new ZipIterator(source), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'tar', (err) => {
          assert.ok(!err, err ? err.message : '');
          done();
        });
      });
    });

    it('extract - stream gz', (done) => {
      const options = { now: new Date() };
      let source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip.gz'));
      source = source.pipe(zlib.createUnzip());
      extract(new ZipIterator(source), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'tar', (err) => {
          assert.ok(!err, err ? err.message : '');
          done();
        });
      });
    });

    it('extract - strip 1', (done) => {
      const options = { now: new Date(), strip: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'zip', (err) => {
          assert.ok(!err, err ? err.message : '');
          done();
        });
      });
    });

    it('extract multiple times', (done) => {
      const options = { now: new Date(), strip: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
        assert.ok(!err, err ? err.message : '');

        validateFiles(options, 'tar', (err) => {
          assert.ok(!err, err ? err.message : '');

          extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, (err) => {
            assert.ok(err);

            extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, Object.assign({ force: true }, options), (err) => {
              assert.ok(!err, err ? err.message : '');

              validateFiles(options, 'tar', (err) => {
                assert.ok(!err, err ? err.message : '');
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

require('../lib/patch');
var assert = require('assert');
var rimraf = require('rimraf');
var mkpath = require('mkpath');
var path = require('path');
var fs = require('fs');
var Queue = require('queue-cb');
var bz2 = require('unbzip2-stream');
var zlib = require('zlib');

var ZipIterator = require('../..');
var validateFiles = require('../lib/validateFiles');

var constants = require('../lib/constants');
var TMP_DIR = constants.TMP_DIR;
var TARGET = constants.TARGET;
var DATA_DIR = constants.DATA_DIR;

function extract(iterator, dest, options, callback) {
  var links = [];
  iterator.forEach(
    function (entry, callback) {
      if (entry.type === 'link') {
        links.unshift(entry);
        callback();
      } else if (entry.type === 'symlink') {
        links.push(entry);
        callback();
      } else entry.create(dest, options, callback);
    },
    { callbacks: true, concurrency: options.concurrency },
    function (err) {
      if (err) return callback(err);

      // create links after directories and files
      var queue = new Queue(1);
      for (var index = 0; index < links.length; index++) {
        var entry = links[index];
        queue.defer(entry.create.bind(entry, dest, options));
      }
      queue.await(callback);
    }
  );
}

function extractPromise(iterator, dest, options, callback) {
  var links = [];
  iterator
    .forEach(
      function (entry) {
        if (entry.type === 'link') links.unshift(entry);
        else if (entry.type === 'symlink') links.push(entry);
        else return entry.create(dest, options);
      },
      { concurrency: options.concurrency }
    )
    .then(function () {
      // create links after directories and files
      var queue = new Queue(1);
      for (var index = 0; index < links.length; index++) {
        (function (entry) {
          queue.defer(function (callback) {
            entry.create(dest, options).then(callback).catch(callback);
          });
        })(links[index]);
      }
      queue.await(callback);
    })
    .catch(callback);
}

describe('iterator', function () {
  beforeEach(function (callback) {
    rimraf(TMP_DIR, function (err) {
      if (err && err.code !== 'EEXIST') return callback(err);
      mkpath(TMP_DIR, callback);
    });
  });

  describe('happy path', function () {
    it('destroy iterator', function () {
      var iterator = new ZipIterator(path.join(DATA_DIR, 'fixture.zip'));
      iterator.destroy();
      assert.ok(true);
    });

    it('destroy entries', function (done) {
      var iterator = new ZipIterator(path.join(DATA_DIR, 'fixture.zip'));
      var lock = iterator.lock;
      iterator.forEach(
        function (entry) {
          entry.destroy();
        },
        function (err) {
          assert.ok(!err);
          assert.ok(!iterator.lock);
          assert.equal(lock.__LC.ref_count, 0);
          done();
        }
      );
    });

    it('extract - no strip - concurrency 1', function (done) {
      var options = { now: new Date(), concurrency: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'zip', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract - no strip - concurrency Infinity', function (done) {
      var options = { now: new Date(), concurrency: Infinity };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'zip', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract - no strip - promise', function (done) {
      if (typeof Promise === 'undefined') return done();

      var options = { now: new Date() };
      extractPromise(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'zip', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract - stream', function (done) {
      var options = { now: new Date() };
      var source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip'));
      extract(new ZipIterator(source), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'tar', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract - stream bz2', function (done) {
      var options = { now: new Date() };
      var source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip.bz2'));
      source = source.pipe(bz2());
      extract(new ZipIterator(source), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'tar', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract - stream gz', function (done) {
      var options = { now: new Date() };
      var source = fs.createReadStream(path.join(DATA_DIR, 'fixture.zip.gz'));
      source = source.pipe(zlib.createUnzip());
      extract(new ZipIterator(source), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'tar', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract - strip 1', function (done) {
      var options = { now: new Date(), strip: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'zip', function (err) {
          assert.ok(!err);
          done();
        });
      });
    });

    it('extract multiple times', function (done) {
      var options = { now: new Date(), strip: 1 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
        assert.ok(!err);

        validateFiles(options, 'zip', function (err) {
          assert.ok(!err);

          extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
            assert.ok(!err);

            validateFiles(options, 'zip', function (err) {
              assert.ok(!err);
              done();
            });
          });
        });
      });
    });
  });

  describe('unhappy path', function () {
    it('should fail with bad path', function (done) {
      var options = { now: new Date(), strip: 2 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip' + 'does-not-exist')), TARGET, options, function (err) {
        assert.ok(!!err);
        done();
      });
    });

    it('should fail with bad stream', function (done) {
      var options = { now: new Date(), strip: 2 };
      extract(new ZipIterator(fs.createReadStream(path.join(DATA_DIR, 'fixture.zip' + 'does-not-exist'))), TARGET, options, function (err) {
        assert.ok(!!err);
        done();
      });
    });

    it('should fail with too large strip', function (done) {
      var options = { now: new Date(), strip: 2 };
      extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options, function (err) {
        assert.ok(!!err);
        done();
      });
    });
  });
});

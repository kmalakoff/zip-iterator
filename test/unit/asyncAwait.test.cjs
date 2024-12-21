require('../lib/patch.cjs');
const assert = require('assert');
const rimraf2 = require('rimraf2');
const mkdirp = require('mkdirp-classic');
const path = require('path');

const ZipIterator = require('zip-iterator');
const validateFiles = require('../lib/validateFiles.cjs');

const constants = require('../lib/constants.cjs');
const TMP_DIR = constants.TMP_DIR;
const TARGET = constants.TARGET;
const DATA_DIR = constants.DATA_DIR;

async function extract(iterator, dest, options) {
  const links = [];
  let entry = await iterator.next();
  while (entry) {
    if (entry.type === 'link') links.unshift(entry);
    else if (entry.type === 'symlink') links.push(entry);
    else await entry.create(dest, options);
    entry = await iterator.next();
  }

  // create links then symlinks after directories and files
  for (const entry of links) await entry.create(dest, options);
}

async function extractForEach(iterator, dest, options) {
  const links = [];
  await iterator.forEach(
    async (entry) => {
      if (entry.type === 'link') links.unshift(entry);
      else if (entry.type === 'symlink') links.push(entry);
      else await entry.create(dest, options);
    },
    { concurrency: options.concurrency }
  );

  // create links then symlinks after directories and files
  for (const entry of links) await entry.create(dest, options);
}

describe('asyncAwait', () => {
  if (typeof Symbol === 'undefined' || !Symbol.asyncIterator) return;

  beforeEach((callback) => {
    rimraf2(TMP_DIR, { disableGlob: true }, (err) => {
      if (err && err.code !== 'EEXIST') return callback(err);
      mkdirp(TMP_DIR, callback);
    });
  });

  describe('happy path', () => {
    it('extract - no strip - concurrency 1', async () => {
      const options = { now: new Date(), concurrency: 1 };
      try {
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        await validateFiles(options, 'zip');
      } catch (err) {
        assert.ok(!err, err ? err.message : '');
      }
    });

    it('extract - no strip - concurrency Infinity', async () => {
      const options = { now: new Date(), concurrency: Infinity };
      try {
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        await validateFiles(options, 'zip');
      } catch (err) {
        assert.ok(!err, err ? err.message : '');
      }
    });

    it('extract - no strip - forEach', async () => {
      const options = { now: new Date(), concurrency: Infinity };
      try {
        await extractForEach(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        await validateFiles(options, 'zip');
      } catch (err) {
        assert.ok(!err, err ? err.message : '');
      }
    });

    it('extract - strip 1', async () => {
      const options = { now: new Date(), strip: 1 };
      try {
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        await validateFiles(options, 'zip');
      } catch (err) {
        assert.ok(!err, err ? err.message : '');
      }
    });

    it('extract multiple times', async () => {
      const options = { now: new Date(), strip: 1 };
      try {
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        await validateFiles(options, 'tar');
        try {
          await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
          assert.ok(false);
        } catch (err) {
          assert.ok(err);
        }
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, Object.assign({ force: true }, options));
        await validateFiles(options, 'tar');
      } catch (err) {
        assert.ok(!err, err ? err.message : '');
      }
    });
  });

  describe('unhappy path', () => {
    it('should fail with too large strip', async () => {
      const options = { now: new Date(), strip: 2 };
      try {
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        assert.ok(false);
      } catch (err) {
        assert.ok(!!err);
      }
    });
  });
});

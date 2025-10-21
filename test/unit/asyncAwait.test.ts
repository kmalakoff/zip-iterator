import '../lib/polyfills.ts';
import assert from 'assert';
import mkdirp from 'mkdirp-classic';
import path from 'path';
import Pinkie from 'pinkie-promise';
import rimraf2 from 'rimraf2';

import ZipIterator from 'zip-iterator';
import { DATA_DIR, TARGET, TMP_DIR } from '../lib/constants.ts';
import validateFiles from '../lib/validateFiles.ts';

async function extract(iterator, dest, options) {
  const links = [];
  let value = await iterator.next();
  while (!value.done) {
    const entry = value.value;
    if (entry.type === 'link') links.unshift(entry);
    else if (entry.type === 'symlink') links.push(entry);
    else await entry.create(dest, options);
    value = await iterator.next();
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
    it('extract - no strip - concurrency 1', async () => {
      const options = { now: new Date(), concurrency: 1 };
      await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
      await validateFiles(options, 'zip');
    });

    it('extract - no strip - concurrency Infinity', async () => {
      const options = { now: new Date(), concurrency: Infinity };
      await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
      await validateFiles(options, 'zip');
    });

    it('extract - no strip - forEach', async () => {
      const options = { now: new Date(), concurrency: Infinity };
      await extractForEach(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
      await validateFiles(options, 'zip');
    });

    it('extract - strip 1', async () => {
      const options = { now: new Date(), strip: 1 };
      await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
      await validateFiles(options, 'zip');
    });

    it('extract multiple times', async () => {
      const options = { now: new Date(), strip: 1 };
      await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
      await validateFiles(options, 'tar');
      try {
        await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, options);
        assert.ok(false);
      } catch (err) {
        assert.ok(err);
      }
      await extract(new ZipIterator(path.join(DATA_DIR, 'fixture.zip')), TARGET, { force: true, ...options });
      await validateFiles(options, 'tar');
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

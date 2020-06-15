var path = require('path');
var fs = require('graceful-fs');
var rimraf = require('rimraf');
var BenchmarkSuite = require('benchmark-suite');

var constants = require('../../test/lib/constants');
var TMP_DIR = constants.TMP_DIR;
var DATA_DIR = constants.DATA_DIR;

module.exports = async function run({ ZipIterator, version }) {
  var suite = new BenchmarkSuite('ZipIterator ' + version, 'Memory');

  function testFn(type, concurrency, fn) {
    return new Promise(function (resolve, reject) {
      var iterator = ZipIterator(path.join(DATA_DIR, 'fixture' + type), TMP_DIR, { concurrency: concurrency });
      iterator.forEach(fn, function (err) {
        iterator.destroy();
        iterator = null;
        err ? reject(err) : resolve();
      });
    });
  }

  suite.add(`.zip concurrency 1`, function (fn) {
    return testFn('.zip', 1, fn);
  });
  suite.add(`.zip concurrency Infinity`, function (fn) {
    return testFn('.zip', Infinity, fn);
  });

  suite.on('cycle', (results) => {
    for (var key in results) console.log(`${results[key].name.padStart(8, ' ')}| ${suite.formatStats(results[key].stats)} - ${key}`);
  });
  suite.on('complete', function (results) {
    console.log('-----Largest-----');
    for (var key in results) console.log(`${results[key].name.padStart(8, ' ')}| ${suite.formatStats(results[key].stats)} - ${key}`);
  });

  console.log('----------' + suite.name + '----------');
  try {
    rimraf.sync(TMP_DIR);
    fs.mkdirSync(TMP_DIR);
  } catch (err) {}
  await suite.run({ time: 1000 });
  console.log('');
};

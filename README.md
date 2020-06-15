## zip-iterator

Extract contents from zip archive type using an iterator API using streams or paths.

// asyncIterator

```js
var assert = require('assert');
var ZipIterator = require('zip-iterator'));


(async function() {
  let iterator = new ZipIterator('/path/to/archive');

  const links = [];
  for await (const entry of iterator) {
    if (entry.type === 'symlink' || entry.type === 'link') links.push(entry);
    else await entry.create(dest, options);
  }

  // create links after directories and files
  for (const entry of links) {
    await entry.create(dest, options);
  }

  iterator.destroy();
  iterator = null;
})();


```

// Async / Await

```js
var assert = require('assert');
var ZipIterator = require('zip-iterator'));

// one by one
(async function() {
  let iterator = new ZipIterator('/path/to/archive');

  const links = [];
  let entry = await iterator.next();
  while (entry) {
    if (entry.type === 'symlink' || entry.type === 'link') links.push(entry);
    else await entry.create(dest, options);
    entry = await iterator.next();
  }

  // create links after directories and files
  for (entry of links) {
    await entry.create(dest, options);
  }
  iterator.destroy();
  iterator = null;
})();

// infinite concurrency
(async function() {
  let iterator = new ZipIterator('/path/to/archive');

  const links = [];
  await iterator.forEach(
    async function (entry) {
      if (entry.type === 'symlink' || entry.type === 'link') links.push(entry);
      else await entry.create(dest, options);
    },
    { concurrency: Infinity }
  );

  // create links after directories and files
  for (const entry of links) {
    await entry.create(dest, options);
  }
  iterator.destroy();
  iterator = null;
})();
```

// Callbacks

```js
var assert = require('assert');
var Queue = require('queue-cb');
var ZipIterator = require('zip-iterator'));

var iterator = new ZipIterator('/path/to/archive');

// one by one
var links = [];
iterator.forEach(
  function (entry, callback) {
    if (entry.type === 'symlink' || entry.type === 'link') {
      links.push(entry);
      callback();
    } else entry.create(dest, options, callback);
  },
  { callbacks: true, concurrency: 1 },
  function (err) {
    if (err) return callback(err);

    // create links after directories and files
    var queue = new Queue();
    for (var index = 0; index < links.length; index++) {
      var entry = links[index];
      queue.defer(entry.create.bind(entry, dest, options));
    }
    queue.await(callback);
  }
);
```

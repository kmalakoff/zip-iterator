# zip-iterator

Read entries from a ZIP archive with an iterator. Sources can be archive paths or readable streams.

## Install

```sh
npm install zip-iterator
```

## Extract an archive

```js
const ZipIterator = require('zip-iterator');

async function extract(archivePath, destination) {
  const iterator = new ZipIterator(archivePath);
  const links = [];

  try {
    for await (const entry of iterator) {
      if (entry.type === 'link') links.unshift(entry);
      else if (entry.type === 'symlink') links.push(entry);
      else await entry.create(destination, { strip: 1 });
    }
    for (const entry of links) await entry.create(destination, { strip: 1 });
  } finally {
    iterator.destroy();
  }
}

extract('./archive.zip', './output').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

`entry.create(destination, options)` writes a file, directory, or link. Use `{ force: true }` to overwrite existing entries. A readable stream can be passed instead of an archive path. Node.js 0.8+ is supported; use the callback form in older Node.js versions that cannot parse `async` functions or `for await`.

Stream sources are buffered to a temporary file by default so the Central Directory can identify symlinks. Set `{ streaming: true }` for forward-only parsing and lower memory use. In that mode, archives without ASi symlink fields may yield symlinks as regular files.

## Callback form

```js
var ZipIterator = require('zip-iterator');
var iterator = new ZipIterator('./archive.zip');
var links = [];

function createLinks(index, callback) {
  if (index === links.length) return callback();
  links[index].create('./output', { strip: 1 }, function(error) {
    if (error) return callback(error);
    createLinks(index + 1, callback);
  });
}

iterator.forEach(function(entry, callback) {
  if (entry.type === 'link') { links.unshift(entry); callback(); }
  else if (entry.type === 'symlink') { links.push(entry); callback(); }
  else entry.create('./output', { strip: 1 }, callback);
}, { callbacks: true, concurrency: 1 }, function(error) {
  if (error) { iterator.destroy(); throw error; }
  createLinks(0, function(error) {
    iterator.destroy();
    if (error) throw error;
    console.log('Extraction complete');
  });
});
```

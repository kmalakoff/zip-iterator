/**
 * Comparison test between native unzip and zip-iterator
 *
 * This test downloads a real-world zip file (Node.js Windows distribution) and compares
 * the extracted results between system unzip and zip-iterator to verify they
 * produce identical output.
 */

import assert from 'assert';
import { exec } from 'child_process';
import fs from 'fs';
import Iterator from 'fs-iterator';
import { rmSync } from 'fs-remove-compat';
import getFile from 'get-file-compat';
import mkdirp from 'mkdirp-classic';
import path from 'path';
import url from 'url';
import ZipIterator from 'zip-iterator';

const __dirname = path.dirname(typeof __filename !== 'undefined' ? __filename : url.fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', '..', '.tmp');

// Test configuration
const NODEJS_ZIP_URL = 'https://nodejs.org/dist/v24.12.0/node-v24.12.0-win-x64.zip';
const CACHE_DIR = path.join(__dirname, '..', '..', '.cache');
const ZIP_FILE = path.join(CACHE_DIR, 'node-v24.12.0-win-x64.zip');
const NATIVE_EXTRACT_DIR = path.join(TMP_DIR, 'zip');
const ITERATOR_EXTRACT_DIR = path.join(TMP_DIR, 'zip-iterator');

/**
 * Interface for file stats collected from directory tree
 */
interface FileStats {
  size: number;
  mode: number;
  mtime: number;
  type: 'directory' | 'file' | 'symlink' | 'other';
}

function downloadZipFile(callback: (err: Error | null) => void): void {
  if (fs.existsSync(ZIP_FILE)) {
    callback(null);
    return;
  }

  mkdirp.sync(CACHE_DIR);
  console.log('Downloading Node.js zip file...');

  getFile(NODEJS_ZIP_URL, ZIP_FILE, (err) => {
    if (err) {
      callback(err);
    } else {
      console.log('Download complete!');
      callback(null);
    }
  });
}

/**
 * Extract using native unzip CLI
 */
function extractWithNative(zipPath: string, destPath: string, callback: (err: Error | null) => void): void {
  // Clean up destination directory if it exists
  rmSync(destPath, { recursive: true, force: true });
  mkdirp(destPath, (err) => {
    if (err) return callback(err);

    // Extract using native unzip CLI
    exec(`unzip -q "${zipPath}" -d "${destPath}"`, callback);
  });
}

/**
 * Extract using zip-iterator
 */
function extractWithZipIterator(zipPath: string, destPath: string, callback: (err: Error | null) => void): void {
  // Clean up destination directory if it exists
  rmSync(destPath, { recursive: true, force: true });
  mkdirp(destPath, (err) => {
    if (err) return callback(err);

    // Extract using zip-iterator
    const iterator = new ZipIterator(zipPath);
    const options = { now: new Date() };

    iterator.forEach(
      (entry, callback): void => {
        entry.create(destPath, options, (err) => {
          callback(err || undefined);
        });
      },
      { callbacks: true },
      (err): void => {
        callback(err || undefined);
      }
    );
  });
}

/**
 * Collect file stats from a directory tree
 * Returns a map of relative paths to their FileStats
 */
function collectStats(dirPath: string, callback: (err: Error | null, stats?: Record<string, FileStats>) => void): void {
  const stats: Record<string, FileStats> = {};

  const iterator = new Iterator(dirPath, {
    lstat: true,
    filter: (entry): boolean => {
      // Skip .git directories
      return !(entry.stats.isDirectory() && entry.basename === '.git');
    },
    error: (_err): boolean => {
      // Filter errors
      return true;
    },
  });

  iterator.forEach(
    (entry): void => {
      const relativePath = path.relative(dirPath, entry.fullPath);

      stats[relativePath] = {
        size: entry.stats.size,
        mode: entry.stats.mode,
        mtime: entry.stats.mtime instanceof Date ? entry.stats.mtime.getTime() : 0,
        type: entry.stats.isDirectory() ? 'directory' : entry.stats.isFile() ? 'file' : entry.stats.isSymbolicLink() ? 'symlink' : 'other',
      };
    },
    { concurrency: 1024 },
    (err) => {
      if (err) {
        callback(err);
      } else {
        callback(null, stats);
      }
    }
  );
}

/**
 * Remove directory if it exists
 */
function removeDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Check if a native tool is available
 */
function checkToolAvailable(checkCmd: string, callback: (available: boolean) => void): void {
  exec(checkCmd, (err) => {
    callback(!err);
  });
}

describe('Comparison - zip-iterator vs native unzip', () => {
  let toolAvailable = false;

  before(function (done) {
    // Increase timeout for this test (downloading and extracting large archive)
    this.timeout(120000);

    // Check if native unzip is available
    checkToolAvailable('which unzip', (available) => {
      toolAvailable = available;
      if (!available) {
        console.log('    Skipping zip comparison tests - native unzip not available');
        done();
        return;
      }

      // Download zip file if not already present
      downloadZipFile((err) => {
        if (err) {
          done(err);
          return;
        }

        // Clean up previous extractions
        removeDir(NATIVE_EXTRACT_DIR);
        removeDir(ITERATOR_EXTRACT_DIR);

        // Extract with native unzip
        console.log('Extracting with native unzip...');
        extractWithNative(ZIP_FILE, NATIVE_EXTRACT_DIR, (err) => {
          if (err) {
            done(err);
            return;
          }

          // Extract with zip-iterator
          console.log('Extracting with zip-iterator...');
          extractWithZipIterator(ZIP_FILE, ITERATOR_EXTRACT_DIR, (err) => {
            if (err) {
              done(err);
            } else {
              console.log('Both extractions complete');
              done();
            }
          });
        });
      });
    });
  });

  it('should extract identical files when comparing native unzip and zip-iterator', function (done) {
    if (!toolAvailable) {
      this.skip();
      return;
    }

    // Collect stats from both extractions
    console.log('Collecting stats from native extraction...');
    collectStats(NATIVE_EXTRACT_DIR, (err, nativeStats) => {
      if (err) {
        done(err);
        return;
      }

      console.log('Collecting stats from zip-iterator extraction...');
      collectStats(ITERATOR_EXTRACT_DIR, (err, iteratorStats) => {
        if (err) {
          done(err);
          return;
        }

        // Compare the sets of files
        const nativeFiles = Object.keys(nativeStats).sort();
        const iteratorFiles = Object.keys(iteratorStats).sort();

        console.log(`Native extraction: ${nativeFiles.length} files`);
        console.log(`zip-iterator extraction: ${iteratorFiles.length} files`);

        // Check if both extractions have the same files
        try {
          assert.deepEqual(nativeFiles, iteratorFiles, 'Both extractions should produce the same set of files');
        } catch (err) {
          done(err);
          return;
        }

        // Compare stats for each file
        const differences: string[] = [];

        for (let i = 0; i < nativeFiles.length; i++) {
          const filePath = nativeFiles[i];
          const nativeFileStats = nativeStats[filePath];
          const iteratorFileStats = iteratorStats[filePath];

          // Compare file type
          if (nativeFileStats.type !== iteratorFileStats.type) {
            differences.push(`Type mismatch for ${filePath}: native=${nativeFileStats.type}, zip-iterator=${iteratorFileStats.type}`);
          }

          // Compare file size (only for files, not directories or symlinks)
          if (nativeFileStats.type === 'file' && nativeFileStats.size !== iteratorFileStats.size) {
            differences.push(`Size mismatch for ${filePath}: native=${nativeFileStats.size}, zip-iterator=${iteratorFileStats.size}`);
          }

          // Compare permissions/mode, but allow for minor differences due to umask
          const modeDiff = Math.abs(nativeFileStats.mode - iteratorFileStats.mode);
          if (modeDiff > 0o22) {
            // Allow up to umask differences (typically 0o022)
            differences.push(`Mode mismatch for ${filePath}: native=${nativeFileStats.mode.toString(8)}, zip-iterator=${iteratorFileStats.mode.toString(8)}`);
          }
        }

        // Assert no differences found
        if (differences.length > 0) {
          console.error('\n=== DIFFERENCES FOUND ===');
          for (let i = 0; i < differences.length; i++) {
            console.error(differences[i]);
          }
          console.error('=========================\n');

          done(new Error(`Found ${differences.length} differences:\n${differences.join('\n')}`));
          return;
        }

        console.log(`✓ Successfully compared ${nativeFiles.length} files - all match!`);
        done();
      });
    });
  });
});

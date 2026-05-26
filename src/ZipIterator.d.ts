import BaseIterator from 'extract-base-iterator';
import type { Entry, ZipIteratorOptions } from './types.ts';
export default class ZipIterator extends BaseIterator<Entry> {
  private lock;
  private extract;
  private centralDir;
  private tempPath;
  private streamingMode;
  constructor(source: string | NodeJS.ReadableStream, options?: ZipIteratorOptions);
  private bufferStreamAndStart;
  private startStreaming;
  end(err?: Error): void;
}

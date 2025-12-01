/**
 * Buffer List for Streaming
 *
 * Simple linked list for accumulating buffer chunks during streaming.
 * Provides efficient append, consume, and slice operations.
 */

import { allocBuffer } from 'extract-base-iterator';

interface BufferNode {
  data: Buffer;
  next: BufferNode | null;
}

export default class BufferList {
  private head: BufferNode | null = null;
  private tail: BufferNode | null = null;

  /** Total bytes in the buffer list */
  public length = 0;

  /**
   * Append a buffer to the end of the list
   */
  append(buf: Buffer): void {
    if (buf.length === 0) return;

    const node: BufferNode = { data: buf, next: null };

    if (this.tail) {
      this.tail.next = node;
      this.tail = node;
    } else {
      this.head = this.tail = node;
    }

    this.length += buf.length;
  }

  /**
   * Prepend a buffer to the front of the list
   */
  prepend(buf: Buffer): void {
    if (buf.length === 0) return;

    const node: BufferNode = { data: buf, next: this.head };

    if (!this.tail) {
      this.tail = node;
    }
    this.head = node;

    this.length += buf.length;
  }

  /**
   * Consume n bytes from the front of the list
   * Returns a new buffer containing the consumed bytes
   */
  consume(n: number): Buffer {
    if (n <= 0) return allocBuffer(0);
    if (n > this.length) n = this.length;

    const result = allocBuffer(n);
    let offset = 0;

    while (offset < n && this.head) {
      const chunk = this.head.data;
      const needed = n - offset;

      if (chunk.length <= needed) {
        // Use entire chunk
        chunk.copy(result, offset);
        offset += chunk.length;
        this.head = this.head.next;
        if (!this.head) this.tail = null;
      } else {
        // Use partial chunk
        chunk.copy(result, offset, 0, needed);
        this.head.data = chunk.slice(needed);
        offset = n;
      }
    }

    this.length -= n;
    return result;
  }

  /**
   * Get a slice of the buffer without consuming
   * Returns a new buffer containing the bytes
   */
  slice(start: number, end: number): Buffer {
    const len = end - start;
    if (len <= 0) return allocBuffer(0);
    if (start >= this.length) return allocBuffer(0);

    const result = allocBuffer(Math.min(len, this.length - start));
    let resultOffset = 0;
    let bufOffset = 0;
    let node = this.head;

    // Skip to start position
    while (node && bufOffset + node.data.length <= start) {
      bufOffset += node.data.length;
      node = node.next;
    }

    // Copy data
    while (node && resultOffset < result.length) {
      const chunk = node.data;
      const chunkStart = Math.max(0, start - bufOffset);
      const chunkEnd = Math.min(chunk.length, end - bufOffset);
      const toCopy = chunkEnd - chunkStart;

      if (toCopy > 0) {
        chunk.copy(result, resultOffset, chunkStart, chunkEnd);
        resultOffset += toCopy;
      }

      bufOffset += chunk.length;
      node = node.next;
    }

    return result;
  }

  /**
   * Read a single byte at offset without consuming
   */
  readByte(offset: number): number {
    if (offset < 0 || offset >= this.length) return -1;

    let bufOffset = 0;
    let node = this.head;

    while (node) {
      if (offset < bufOffset + node.data.length) {
        return node.data[offset - bufOffset];
      }
      bufOffset += node.data.length;
      node = node.next;
    }

    return -1;
  }

  /**
   * Search for a byte sequence in the buffer
   * Returns offset of first match, or -1 if not found
   */
  indexOf(signature: number[], startOffset = 0): number {
    if (signature.length === 0) return startOffset;
    if (startOffset + signature.length > this.length) return -1;

    // Simple byte-by-byte search
    // Could be optimized with KMP/Boyer-Moore for larger signatures
    for (let i = startOffset; i <= this.length - signature.length; i++) {
      let match = true;
      for (let j = 0; j < signature.length; j++) {
        if (this.readByte(i + j) !== signature[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }

    return -1;
  }

  /**
   * Skip (consume) n bytes without returning them
   */
  skip(n: number): void {
    if (n <= 0) return;
    if (n >= this.length) {
      this.clear();
      return;
    }

    let remaining = n;

    while (remaining > 0 && this.head) {
      const chunk = this.head.data;

      if (chunk.length <= remaining) {
        remaining -= chunk.length;
        this.head = this.head.next;
        if (!this.head) this.tail = null;
      } else {
        this.head.data = chunk.slice(remaining);
        remaining = 0;
      }
    }

    this.length -= n;
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  /**
   * Check if the buffer starts with a signature at offset 0
   */
  startsWith(signature: number[]): boolean {
    if (signature.length > this.length) return false;
    for (let i = 0; i < signature.length; i++) {
      if (this.readByte(i) !== signature[i]) return false;
    }
    return true;
  }

  /**
   * Get a consolidated buffer of the entire contents
   * Note: This creates a copy, so use sparingly for large buffers
   */
  toBuffer(): Buffer {
    if (this.length === 0) return allocBuffer(0);
    return this.slice(0, this.length);
  }
}

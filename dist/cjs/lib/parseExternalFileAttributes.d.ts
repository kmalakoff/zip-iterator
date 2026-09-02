/**
 * Parse External File Attributes
 *
 * Extracts file type and permissions from ZIP external attributes.
 * Based on: https://github.com/bower/decompress-zip/blob/master/lib/structures.js
 */
import type { Mode } from 'fs';
export interface Attributes {
    platform: string;
    type: 'file' | 'directory' | 'link' | 'symlink';
    mode: Mode;
    mtime?: number;
    path?: string;
}
export default function parseExternalFileAttributes(externalAttributes: number, platform: number): Attributes;

/**
 * Create Entry from ZIP Header
 *
 * Creates the appropriate entry type (File, Directory, SymbolicLink, Link)
 * based on the parsed LocalFileHeader and Central Directory info.
 */ import once from 'call-once-fn';
import { DirectoryEntry, LinkEntry, normalizePath, SymbolicLinkEntry, streamToString } from 'extract-base-iterator';
import FileEntry from './FileEntry.js';
import parseExternalFileAttributes from './lib/parseExternalFileAttributes.js';
import { MODE_DEFAULT_DIR, MODE_DEFAULT_FILE, S_IFDIR, S_IFLNK, S_IFREG } from './zip/constants.js';
import { findAsiInfo, findExtendedTimestamp } from './zip/extra-fields.js';
/**
 * Create an entry from a LocalFileHeader and stream
 */ export default function createEntry(header, stream, lock, next, callback, cdEntry) {
    const cb = once((err, entry)=>{
        next();
        setTimeout(()=>{
            if (err) return callback(err);
            entry ? callback(undefined, {
                done: false,
                value: entry
            }) : callback(undefined, {
                done: true,
                value: undefined
            });
        }, 0);
    });
    // Parse external attributes for type and permissions
    const attributes = getAttributes(header, cdEntry);
    switch(attributes.type){
        case 'directory':
            cb(null, new DirectoryEntry(attributes));
            return;
        case 'symlink':
        case 'link':
            streamToString(stream, (err, target)=>{
                if (err) return cb(err);
                const linkAttributes = {
                    ...attributes,
                    linkpath: target || ''
                };
                const LinkClass = attributes.type === 'symlink' ? SymbolicLinkEntry : LinkEntry;
                cb(null, new LinkClass(linkAttributes));
            });
            return;
        case 'file':
            cb(null, new FileEntry(attributes, stream, lock));
            return;
        default:
            cb(new Error(`Unrecognized entry type: ${attributes.type}`));
    }
}
/**
 * Extract attributes from header and Central Directory entry
 */ function getAttributes(header, cdEntry) {
    // Normalize path - remove leading/trailing slashes, normalize separators
    const filePath = normalizePath(header.fileName);
    // Detect directory by trailing slash in original filename
    const isDirectory = header.fileName.charAt(header.fileName.length - 1) === '/';
    // Default type based on filename pattern
    let type = isDirectory ? 'directory' : 'file';
    // Default mode
    let mode = isDirectory ? MODE_DEFAULT_DIR : MODE_DEFAULT_FILE;
    // If we have Central Directory entry, use external attributes for accurate type detection
    if (cdEntry) {
        const parsed = parseExternalFileAttributes(cdEntry.externalAttributes, cdEntry.platform);
        type = parsed.type;
        mode = parsed.mode;
    } else {
        // Try ASi extra field for symlink detection in streaming mode
        const asiInfo = findAsiInfo(header.extraFields);
        if (asiInfo) {
            const fileType = asiInfo.mode & 0xf000;
            if (fileType === S_IFLNK) {
                type = 'symlink';
            } else if (fileType === S_IFDIR) {
                type = 'directory';
            } else if (fileType === S_IFREG) {
                type = 'file';
            }
            // Use lower 12 bits as permissions
            mode = asiInfo.mode & 0x0fff;
        }
    }
    // Get modification time as timestamp
    let mtime = header.mtime.getTime();
    // Try to get extended timestamp for better precision
    const extTimestamp = findExtendedTimestamp(header.extraFields);
    if (extTimestamp && extTimestamp.mtime) {
        mtime = extTimestamp.mtime * 1000;
    }
    return {
        type,
        path: filePath,
        mode,
        mtime
    };
}

/**
 * Parse External File Attributes
 *
 * Extracts file type and permissions from ZIP external attributes.
 * Based on: https://github.com/bower/decompress-zip/blob/master/lib/structures.js
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return parseExternalFileAttributes;
    }
});
// Permission constants (decimal equivalents of octal for Node 0.8 compatibility)
var MODE_READ_ALL = 292; // 0o0444 - r--r--r--
var MODE_WRITE_ALL = 146; // 0o0222 - -w--w--w-
var MODE_EXEC_ALL = 73; // 0o0111 - --x--x--x
function parseExternalFileAttributes(externalAttributes, platform) {
    var types = {
        // In theory, any of these could be set. Realistically, though, it will
        // be regular, directory or symlink
        1: 'namedpipe',
        2: 'character',
        4: 'directory',
        6: 'block',
        8: 'file',
        10: 'symlink',
        12: 'socket'
    };
    switch(platform){
        case 3:
            return {
                platform: 'Unix',
                type: types[externalAttributes >> 28 & 0x0f] || 'file',
                mode: externalAttributes >> 16 & 0xfff
            };
        // case 0: // MSDOS
        default:
            {
                if (platform !== 0) {
                    console.warn("Possibly unsupported ZIP platform type, ".concat(platform));
                }
                var attribs = {
                    A: externalAttributes >> 5 & 0x01,
                    D: externalAttributes >> 4 & 0x01,
                    V: externalAttributes >> 3 & 0x01,
                    S: externalAttributes >> 2 & 0x01,
                    H: externalAttributes >> 1 & 0x01,
                    R: externalAttributes & 0x01
                };
                // With no better guidance we'll make the default permissions ugo+r
                var mode = MODE_READ_ALL;
                if (attribs.D) {
                    mode |= MODE_EXEC_ALL; // Set the execute bit
                }
                if (!attribs.R) {
                    mode |= MODE_WRITE_ALL; // Set the write bit
                }
                mode &= ~process.umask();
                return {
                    platform: 'DOS',
                    type: attribs.D ? 'directory' : 'file',
                    mode: mode
                };
            }
    }
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
// From: https://github.com/bower/decompress-zip/blob/master/lib/structures.js
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return parseExternalFileAttributes;
    }
});
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
                type: types[externalAttributes >> 28 & 0x0f],
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
                var mode = 292;
                if (attribs.D) {
                    mode |= 73; // Set the execute bit
                }
                if (!attribs.R) {
                    mode |= 146; // Set the write bit
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
/* CJS INTEROP */ if (exports.__esModule && exports.default) { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) exports.default[key] = exports[key]; module.exports = exports.default; }
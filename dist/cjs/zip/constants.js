/**
 * ZIP Format Constants
 *
 * All values based on PKWARE APPNOTE.TXT specification.
 * Byte arrays used for signature detection with bufferEquals().
 * Decimal values used instead of octal literals for Node 0.8 compatibility.
 */ // =============================================================================
// Signatures (as byte arrays for bufferEquals - little-endian)
// =============================================================================
/** Local File Header signature: PK\x03\x04 (0x04034b50) */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get DATA_DESCRIPTOR_SIZE () {
        return DATA_DESCRIPTOR_SIZE;
    },
    get DATA_DESCRIPTOR_SIZE_WITH_SIG () {
        return DATA_DESCRIPTOR_SIZE_WITH_SIG;
    },
    get EXTID_ASI () {
        return EXTID_ASI;
    },
    get EXTID_EXTENDED_TIMESTAMP () {
        return EXTID_EXTENDED_TIMESTAMP;
    },
    get EXTID_PKWARE_UNIX () {
        return EXTID_PKWARE_UNIX;
    },
    get EXTID_UNIX_NEW () {
        return EXTID_UNIX_NEW;
    },
    get EXTID_UNIX_OLD () {
        return EXTID_UNIX_OLD;
    },
    get EXTID_ZIP64 () {
        return EXTID_ZIP64;
    },
    get FLAG_DATA_DESCRIPTOR () {
        return FLAG_DATA_DESCRIPTOR;
    },
    get FLAG_ENCRYPTED () {
        return FLAG_ENCRYPTED;
    },
    get FLAG_STRONG_ENCRYPTION () {
        return FLAG_STRONG_ENCRYPTION;
    },
    get FLAG_UTF8 () {
        return FLAG_UTF8;
    },
    get LOCAL_HEADER_FIXED_SIZE () {
        return LOCAL_HEADER_FIXED_SIZE;
    },
    get METHOD_BZIP2 () {
        return METHOD_BZIP2;
    },
    get METHOD_DEFLATE () {
        return METHOD_DEFLATE;
    },
    get METHOD_LZMA () {
        return METHOD_LZMA;
    },
    get METHOD_STORE () {
        return METHOD_STORE;
    },
    get MODE_DEFAULT_DIR () {
        return MODE_DEFAULT_DIR;
    },
    get MODE_DEFAULT_FILE () {
        return MODE_DEFAULT_FILE;
    },
    get MODE_EXEC_ALL () {
        return MODE_EXEC_ALL;
    },
    get MODE_READ_ALL () {
        return MODE_READ_ALL;
    },
    get MODE_WRITE_ALL () {
        return MODE_WRITE_ALL;
    },
    get PLATFORM_MSDOS () {
        return PLATFORM_MSDOS;
    },
    get PLATFORM_NTFS () {
        return PLATFORM_NTFS;
    },
    get PLATFORM_OSX () {
        return PLATFORM_OSX;
    },
    get PLATFORM_UNIX () {
        return PLATFORM_UNIX;
    },
    get SIGNATURE_SIZE () {
        return SIGNATURE_SIZE;
    },
    get SIG_CENTRAL_DIR () {
        return SIG_CENTRAL_DIR;
    },
    get SIG_DATA_DESCRIPTOR () {
        return SIG_DATA_DESCRIPTOR;
    },
    get SIG_END_OF_CENTRAL_DIR () {
        return SIG_END_OF_CENTRAL_DIR;
    },
    get SIG_LOCAL_FILE () {
        return SIG_LOCAL_FILE;
    },
    get SIG_ZIP64_END_OF_CENTRAL_DIR () {
        return SIG_ZIP64_END_OF_CENTRAL_DIR;
    },
    get SIG_ZIP64_EOCD_LOCATOR () {
        return SIG_ZIP64_EOCD_LOCATOR;
    },
    get S_IFDIR () {
        return S_IFDIR;
    },
    get S_IFLNK () {
        return S_IFLNK;
    },
    get S_IFREG () {
        return S_IFREG;
    },
    get UNIX_TYPE_BLOCK () {
        return UNIX_TYPE_BLOCK;
    },
    get UNIX_TYPE_CHAR () {
        return UNIX_TYPE_CHAR;
    },
    get UNIX_TYPE_DIR () {
        return UNIX_TYPE_DIR;
    },
    get UNIX_TYPE_FIFO () {
        return UNIX_TYPE_FIFO;
    },
    get UNIX_TYPE_FILE () {
        return UNIX_TYPE_FILE;
    },
    get UNIX_TYPE_SOCKET () {
        return UNIX_TYPE_SOCKET;
    },
    get UNIX_TYPE_SYMLINK () {
        return UNIX_TYPE_SYMLINK;
    },
    get ZIP64_DATA_DESCRIPTOR_SIZE () {
        return ZIP64_DATA_DESCRIPTOR_SIZE;
    },
    get ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG () {
        return ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG;
    },
    get ZIP64_MARKER_16 () {
        return ZIP64_MARKER_16;
    },
    get ZIP64_MARKER_32 () {
        return ZIP64_MARKER_32;
    },
    get ZipErrorCode () {
        return ZipErrorCode;
    },
    get createZipError () {
        return createZipError;
    }
});
var SIG_LOCAL_FILE = [
    0x50,
    0x4b,
    0x03,
    0x04
];
var SIG_DATA_DESCRIPTOR = [
    0x50,
    0x4b,
    0x07,
    0x08
];
var SIG_CENTRAL_DIR = [
    0x50,
    0x4b,
    0x01,
    0x02
];
var SIG_END_OF_CENTRAL_DIR = [
    0x50,
    0x4b,
    0x05,
    0x06
];
var SIG_ZIP64_END_OF_CENTRAL_DIR = [
    0x50,
    0x4b,
    0x06,
    0x06
];
var SIG_ZIP64_EOCD_LOCATOR = [
    0x50,
    0x4b,
    0x06,
    0x07
];
var METHOD_STORE = 0;
var METHOD_DEFLATE = 8;
var METHOD_BZIP2 = 12;
var METHOD_LZMA = 14;
var FLAG_ENCRYPTED = 1;
var FLAG_DATA_DESCRIPTOR = 8;
var FLAG_STRONG_ENCRYPTION = 64;
var FLAG_UTF8 = 2048;
var EXTID_ZIP64 = 0x0001;
var EXTID_UNIX_OLD = 0x5855;
var EXTID_UNIX_NEW = 0x7875;
var EXTID_PKWARE_UNIX = 0x000d;
var EXTID_EXTENDED_TIMESTAMP = 0x5455;
var EXTID_ASI = 0x756e;
var LOCAL_HEADER_FIXED_SIZE = 30;
var SIGNATURE_SIZE = 4;
var DATA_DESCRIPTOR_SIZE = 12;
var DATA_DESCRIPTOR_SIZE_WITH_SIG = 16;
var ZIP64_DATA_DESCRIPTOR_SIZE = 20;
var ZIP64_DATA_DESCRIPTOR_SIZE_WITH_SIG = 24;
var ZIP64_MARKER_32 = 0xffffffff;
var ZIP64_MARKER_16 = 0xffff;
var MODE_READ_ALL = 292;
var MODE_WRITE_ALL = 146;
var MODE_EXEC_ALL = 73;
var MODE_DEFAULT_FILE = 420;
var MODE_DEFAULT_DIR = 493;
var PLATFORM_MSDOS = 0;
var PLATFORM_UNIX = 3;
var PLATFORM_NTFS = 10;
var PLATFORM_OSX = 19;
var S_IFLNK = 0xa000; // Symbolic link
var S_IFDIR = 0x4000; // Directory
var S_IFREG = 0x8000; // Regular file
var UNIX_TYPE_FIFO = 1;
var UNIX_TYPE_CHAR = 2;
var UNIX_TYPE_DIR = 4;
var UNIX_TYPE_BLOCK = 6;
var UNIX_TYPE_FILE = 8;
var UNIX_TYPE_SYMLINK = 10;
var UNIX_TYPE_SOCKET = 12;
var ZipErrorCode = {
    INVALID_SIGNATURE: 'ZIP_INVALID_SIGNATURE',
    CRC_MISMATCH: 'ZIP_CRC_MISMATCH',
    UNSUPPORTED_METHOD: 'ZIP_UNSUPPORTED_METHOD',
    ENCRYPTED_ENTRY: 'ZIP_ENCRYPTED_ENTRY',
    TRUNCATED_ARCHIVE: 'ZIP_TRUNCATED_ARCHIVE',
    SIZE_EXCEEDED: 'ZIP_SIZE_EXCEEDED',
    INVALID_SIZE: 'ZIP_INVALID_SIZE',
    BUFFER_OVERFLOW: 'ZIP_BUFFER_OVERFLOW'
};
function createZipError(message, code) {
    var err = new Error(message);
    err.code = code;
    return err;
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
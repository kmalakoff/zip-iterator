/**
 * EntryEmitter - Entry stream creation and lifecycle management
 *
 * Handles creating PassThrough streams for entries and manages the
 * deferred error emission pattern for race conditions.
 */ "use strict";
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
    get PassThrough () {
        return _extractbaseiterator.PassThrough;
    },
    get createEntryStream () {
        return createEntryStream;
    },
    get emitErrorToStream () {
        return emitErrorToStream;
    },
    get emitStreamError () {
        return emitStreamError;
    },
    get endEntryStream () {
        return endEntryStream;
    }
});
var _extractbaseiterator = require("extract-base-iterator");
function createEntryStream() {
    var stream = new _extractbaseiterator.PassThrough();
    // Pause the output stream so data events aren't lost before consumer attaches listeners
    // Consumer should call resume() or attach listeners which will auto-resume
    if (typeof stream.pause === 'function') {
        stream.pause();
    }
    return stream;
}
function emitErrorToStream(stream, err) {
    // Check if there are already error listeners
    var hasListeners = stream.listeners && stream.listeners('error').length > 0;
    if (hasListeners) {
        // Emit immediately if listeners exist
        stream.emit('error', err);
    } else {
        // Defer emission: patch on/addListener to emit when listener is attached
        // Store error on stream object for deferred emission
        var streamWithError = stream;
        streamWithError._deferredError = err;
        // Wrap the on/addListener methods to check for deferred error
        var origOn = stream.on;
        var patchedOn = function patchedOn(event, listener) {
            var _this = this;
            var result = origOn.call(this, event, listener);
            // If attaching error listener and we have a deferred error, emit it
            if (event === 'error' && this._deferredError) {
                var deferredErr = this._deferredError;
                this._deferredError = undefined;
                // Emit asynchronously to ensure listener is fully attached
                setTimeout(function() {
                    _this.emit('error', deferredErr);
                }, 0);
            }
            return result;
        };
        stream.on = patchedOn;
        stream.addListener = patchedOn;
    }
}
function emitStreamError(stream, err) {
    if (!stream) return;
    var listeners = stream.listeners && stream.listeners('error');
    if (listeners && listeners.length > 0) {
        stream.emit('error', err);
    } else {
        emitErrorToStream(stream, err);
    }
}
function endEntryStream(stream) {
    if (stream) {
        stream.end();
    }
}
/* CJS INTEROP */ if (exports.__esModule && exports.default) { try { Object.defineProperty(exports.default, '__esModule', { value: true }); for (var key in exports) { exports.default[key] = exports[key]; } } catch (_) {}; module.exports = exports.default; }
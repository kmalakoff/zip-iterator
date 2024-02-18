/// <reference types="node" />
export default class ZipIterator {
    constructor(source: any, options: any);
    lock: any;
    iterator: {
        next: () => {
            localHeader: any;
            stream: Zip;
            start: any;
            centralHeader: any;
            lastModified: () => Date;
            getStream: () => import("stream").Readable;
        };
    };
    end(err: any): void;
}
import Zip from './lib/Zip.mjs';

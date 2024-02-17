/// <reference types="node" />
export = ZipIterator;
declare function ZipIterator(source: any, options: any): ZipIterator;
declare class ZipIterator {
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
import Zip = require("./lib/Zip");

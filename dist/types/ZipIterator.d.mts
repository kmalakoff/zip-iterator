export default class ZipIterator {
    constructor(source: any, options: any);
    lock: any;
    iterator: {
        next: () => {
            localHeader: any;
            stream: Reader;
            start: any;
            centralHeader: any;
            lastModified: () => Date;
            getStream: () => import("stream").Readable;
        };
    };
    end(err: any): void;
}

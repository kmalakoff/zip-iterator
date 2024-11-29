import { Reader } from 'zip';
import { Readable } from 'stream';
export default class Zip extends Reader {
    constructor(fd: any);
    iterator(): {
        next: () => {
            localHeader: any;
            stream: Reader;
            start: any;
            centralHeader: any;
            lastModified: () => Date;
            getStream: () => Readable;
        };
    };
}

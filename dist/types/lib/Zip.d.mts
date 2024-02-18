export default class Zip {
    constructor(fd: any);
    iterator(): {
        next: () => {
            localHeader: any;
            stream: this;
            start: any;
            centralHeader: any;
            lastModified: () => Date;
            getStream: () => Readable;
        };
    };
}
import { Readable } from 'stream';

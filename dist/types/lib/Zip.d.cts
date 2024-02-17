export = Zip;
declare function Zip(fd: any, filePath: any): Zip;
declare class Zip {
    constructor(fd: any, filePath: any);
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
import Readable_1 = require("stream");
import Readable = Readable_1.Readable;

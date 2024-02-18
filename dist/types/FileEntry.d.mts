export default class ZipFileEntry {
    constructor(attributes: any, entry: any, lock: any);
    entry: any;
    lock: any;
    create(dest: any, options: any, callback: any): any;
    _writeFile(fullPath: any, _: any, callback: any): any;
    destroy(): void;
}

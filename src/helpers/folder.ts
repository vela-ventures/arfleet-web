import { Sliceable } from "./slice";

export class Folder extends Sliceable {
    private files: FileMetadata[] = [];

    constructor() {
        super();
    }

    getParts() {
        return this.files;
    }
}
import { FileMetadata } from "@/types";
import { Sliceable, SlicePart, SliceParts } from "./slice";
import { DataItem } from "./dataitemmod";

export class Folder extends Sliceable {
    private files: FileMetadata[] = [];

    constructor(files: FileMetadata[]) {
        super();
        this.files = files;
    }

    async buildParts(): Promise<SliceParts> {
        const parts = await Promise.all(this.files.map(async file => {
            const byteLength = await file.encryptedDataItem.getByteLength();
            return [byteLength, file.encryptedDataItem] as SlicePart;
        }));
        return parts;
    }
}

export async function createFolder(files: FileMetadata[]) {
    return new Folder(files);
}
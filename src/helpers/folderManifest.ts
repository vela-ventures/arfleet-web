import { FileMetadata } from "../contexts/ArFleetContext";
import { stringToBuffer } from "./buf";
import { stringToB64Url } from "./encodeUtils";
import { Folder } from "./folder";
import { Sliceable, SliceParts } from "./sliceable";

export class FolderManifest extends Sliceable {
    private files: FileMetadata[] = [];

    constructor(files: FileMetadata[]) {
        super();
        this.files = files;
    }

    async buildParts(): Promise<SliceParts> {
        const manifestTemplate = await this.getManifest(true);

        return [
            [manifestTemplate.length, this.sliceManifest.bind(this)]
        ];
    }

    async sliceManifest(start: number, end: number): Promise<Uint8Array> {
        return stringToBuffer(await this.getManifest(false)).slice(start, end);
    }

    async getManifest(dryRun: boolean = false): Promise<string> {
        let paths: any = {};
        for (const file of this.files) {
            paths[file.name] = {
            //    id: dryRun ? stringToB64Url(' '.repeat(32)) : await file.encryptedDataItem!.getDataItemId(),
               id: dryRun ? stringToB64Url(' '.repeat(32)) : await file.dataItem!.getDataItemId(),
               size: file.size
            };
        }

        const root = {
            "manifest": "arweave/paths",
            "version": "0.2.0",
            // "index": {
            //   "path": "index.html"
            // },
            // "fallback": {
            //   "id": "cG7Hdi_iTQPoEYgQJFqJ8NMpN4KoZ-vH_j7pG4iP7NI"
            // },
            "paths": paths
        };

        return JSON.stringify(root);
    }
}

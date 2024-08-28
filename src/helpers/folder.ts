import { FileMetadata } from "../contexts/ArFleetContext";
import { AES_IV_BYTE_LENGTH, AESEncryptedContainer } from "./aes";
import { DataItem, DataItemFactory } from "./dataitemmod";
import { createSalt, encKeyFromMasterKeyAndSalt } from "./encrypt";
import { FolderManifest } from "./folderManifest";
import { PassthroughAES } from "./passthroughAES";
import { PLACEMENT_BLOB_CHUNK_SIZE } from "./placementBlob";
import { Sliceable, SlicePart, SliceParts } from "./sliceable";

export class Folder extends Sliceable {
    private files: FileMetadata[] = [];
    private dataItemFactory: DataItemFactory;
    encryptedManifestDataItem: DataItem | null = null;
    signer: any;
    masterKey: Uint8Array;
    chunkIdxToFile: Map<number, [ FileMetadata, number ]> = new Map();

    constructor(files: FileMetadata[], dataItemFactory: DataItemFactory, signer: any, masterKey: Uint8Array) {
        super();
        this.files = files;
        this.dataItemFactory = dataItemFactory;
        this.signer = signer;
        this.masterKey = masterKey;
    }

    async buildParts(): Promise<SliceParts> {
        let parts: SliceParts = [];

        let c = 0;

        console.log('FILES:', this.files);
        for (const file of this.files) {
            console.log({file})
            const boundary = PLACEMENT_BLOB_CHUNK_SIZE;
            const byteLength = await file.encryptedDataItem!.getByteLength();
            const expandedLength = Math.ceil(byteLength / boundary) * boundary;
            parts.push([byteLength, file.encryptedDataItem] as SlicePart);
            const diff = expandedLength - byteLength;
            console.log({diff, expandedLength, byteLength});
            if (diff > 0) {
                parts.push([diff, this.zeroes.bind(this, 0, diff)] as SlicePart);
            }

            const totalChunks = Math.ceil(byteLength / boundary);

            for(let q = 0; q < totalChunks; q++) {
                this.chunkIdxToFile.set(c, [ file, q ]);
                c++;
            }
        }
        
        // let parts = await Promise.all(this.files.map(async file => {
        //     const byteLength = await file.encryptedDataItem!.getByteLength();
        //     return [byteLength, file.encryptedDataItem] as SlicePart;
        // }));

        const manifest = new FolderManifest(this.files);
        const manifestDataItem = await this.dataItemFactory.createDataItemWithSliceable(manifest, [
            {name: "Content-type", value: "application/x.arweave-manifest+json" },
            {name: "ArFleet-DataItem-Type", value: "AESPathManifest" }
        ], this.signer);

        const salt = createSalt();
        const iv = createSalt(AES_IV_BYTE_LENGTH);
        const secretKey = await encKeyFromMasterKeyAndSalt(this.masterKey, salt);  
        const encContainer = new PassthroughAES(manifestDataItem, salt, secretKey, iv);

        this.encryptedManifestDataItem = await this.dataItemFactory.createDataItemWithSliceable(encContainer, [
            {name: "ArFleet-DataItem-Type", value: "EncryptedAESPathManifest" }
        ], this.signer);

        parts.push([ await this.encryptedManifestDataItem.getByteLength(), this.encryptedManifestDataItem ]);

        console.log('PARTS:', parts);
        return parts;
    }
}

export async function createFolder(files: FileMetadata[], dataItemFactory: DataItemFactory, signer: any, masterKey: Uint8Array) {
    return new Folder(files, dataItemFactory, signer, masterKey);
}
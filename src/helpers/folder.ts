import { FileMetadata } from "../contexts/ArFleetContext";
import { AES_IV_BYTE_LENGTH, AESEncryptedContainer } from "./aes";
import { DataItem, DataItemFactory } from "./dataitemmod";
import { createSalt, encKeyFromMasterKeyAndSalt } from "./encrypt";
import { FolderManifest } from "./folderManifest";
import { Sliceable, SlicePart, SliceParts } from "./sliceable";

export class Folder extends Sliceable {
    private files: FileMetadata[] = [];
    private dataItemFactory: DataItemFactory;
    encryptedManifestDataItem: DataItem | null = null;
    signer: any;
    masterKey: Uint8Array;

    constructor(files: FileMetadata[], dataItemFactory: DataItemFactory, signer: any, masterKey: Uint8Array) {
        super();
        this.files = files;
        this.dataItemFactory = dataItemFactory;
        this.signer = signer;
        this.masterKey = masterKey;
    }

    async buildParts(): Promise<SliceParts> {
        let parts = await Promise.all(this.files.map(async file => {
            const byteLength = await file.encryptedDataItem!.getByteLength();
            return [byteLength, file.encryptedDataItem] as SlicePart;
        }));

        const manifest = new FolderManifest(this.files);
        const manifestDataItem = await this.dataItemFactory.createDataItemWithSliceable(manifest, [
            {name: "Content-type", value: "application/x.arweave-manifest+json" },
            {name: "ArFleet-DataItem-Type", value: "AESPathManifest" }
        ], this.signer);

        const salt = createSalt();
        const iv = createSalt(AES_IV_BYTE_LENGTH);
        const secretKey = await encKeyFromMasterKeyAndSalt(this.masterKey, salt);  
        const encContainer = new AESEncryptedContainer(manifestDataItem, salt, secretKey, iv);

        this.encryptedManifestDataItem = await this.dataItemFactory.createDataItemWithSliceable(encContainer, [
            {name: "ArFleet-DataItem-Type", value: "EncryptedAESPathManifest" }
        ], this.signer);

        parts.push([ await this.encryptedManifestDataItem.getByteLength(), this.encryptedManifestDataItem ]);

        return parts;
    }
}

export async function createFolder(files: FileMetadata[], dataItemFactory: DataItemFactory, signer: any, masterKey: Uint8Array) {
    return new Folder(files, dataItemFactory, signer, masterKey);
}
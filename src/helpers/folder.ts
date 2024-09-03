import { FileMetadata } from "../contexts/ArFleetContext";
import { AES_IV_BYTE_LENGTH, AESEncryptedContainer } from "./aes";
import { concatBuffers } from "./buf";
import { DataItem, DataItemFactory } from "./dataitemmod";
import { createSalt, encKeyFromMasterKeyAndSalt } from "./encrypt";
import { downloadUint8ArrayAsFile } from "./extra";
import { FolderManifest } from "./folderManifest";
import { sha256hex } from "./hash";
import { PassthroughAES } from "./passthroughAES";
import { PLACEMENT_BLOB_CHUNK_SIZE } from "./placementBlob";
import { RSA_ENCRYPTED_CHUNK_SIZE, RSA_HEADER_SIZE, RSA_UNDERLYING_CHUNK_SIZE } from "./rsa";
import { Sliceable, SlicePart, SliceParts } from "./sliceable";

const FOLDER_FILE_BOUNDARY = (PLACEMENT_BLOB_CHUNK_SIZE / RSA_ENCRYPTED_CHUNK_SIZE) * RSA_UNDERLYING_CHUNK_SIZE;

export class Folder extends Sliceable {
    files: FileMetadata[] = [];
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

    async remainingZeroes(byteLength: number, boundary: number) {
        const expandedLength = Math.ceil(byteLength / boundary) * boundary;
        const diff = expandedLength - byteLength;
        if (diff > 0) {
            return diff;
        }
        return 0;
    }

    async sliceThroughFileDataItem(file: FileMetadata, start: number, end: number) {
        const byteLength = await file.encryptedDataItem!.getByteLength();
        
        const chunkIdxStart = Math.floor(start / FOLDER_FILE_BOUNDARY);
        const chunkIdxFinal = Math.floor((end-1) / FOLDER_FILE_BOUNDARY);

        const chunkBufs = [];

        for(let curChunkIdx = chunkIdxStart; curChunkIdx <= chunkIdxFinal; curChunkIdx++) {
            // const chunk = await file.encryptedDataItem!.slice(curChunkIdx * FOLDER_FILE_BOUNDARY, Math.min(curChunkIdx * FOLDER_FILE_BOUNDARY + FOLDER_FILE_BOUNDARY, byteLength));
            const chunkStartByte = curChunkIdx * FOLDER_FILE_BOUNDARY;
            const chunkSize = (curChunkIdx === chunkIdxFinal) ? byteLength % FOLDER_FILE_BOUNDARY : FOLDER_FILE_BOUNDARY;
            const chunk = await file.encryptedDataItem!.slice(chunkStartByte, chunkStartByte + chunkSize);
            const hash = await sha256hex(chunk);
            console.log('effective hash of chunk:', new TextDecoder().decode(chunk), chunk.byteLength, hash, curChunkIdx, file);
            file.chunkHashes[curChunkIdx] = hash;

            chunkBufs.push(chunk);
        }

        const chunkBufConcat = concatBuffers(chunkBufs);

        const finalStart = start - (chunkIdxStart * FOLDER_FILE_BOUNDARY);
        const finalEnd = end - (chunkIdxFinal * FOLDER_FILE_BOUNDARY);

        return chunkBufConcat.slice(finalStart, finalEnd);
    }

    async buildParts(): Promise<SliceParts> {
        let parts: SliceParts = [];

        let c = 0;

        console.log('FILES:', this.files);
        for (const file of this.files) {
            console.log({file})

            // File

            const byteLength = await file.encryptedDataItem!.getByteLength();
            parts.push([byteLength, this.sliceThroughFileDataItem.bind(this, file)] as SlicePart);

            // Align with zeroes to the boundary

            console.log("FOLDER_FILE_BOUNDARY", FOLDER_FILE_BOUNDARY);
            const diff = await this.remainingZeroes(byteLength, FOLDER_FILE_BOUNDARY);
            console.log("diff", diff);
            if (diff > 0) {
                parts.push([diff, this.zeroes.bind(this, 0, diff)] as SlicePart);
            }

            // -

            const totalChunks = Math.ceil(byteLength / FOLDER_FILE_BOUNDARY);

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

        const diff = await this.remainingZeroes(await this.encryptedManifestDataItem.getByteLength(), FOLDER_FILE_BOUNDARY);
        if (diff > 0) {
            parts.push([diff, this.zeroes.bind(this, 0, diff)] as SlicePart);
        }

        console.log('FOLDER PARTS:', await this.dumpParts(parts));
        // console.log('FOLDER PARTS:', await this.dumpParts());

        return parts;
    }
}

export async function createFolder(files: FileMetadata[], dataItemFactory: DataItemFactory, signer: any, masterKey: Uint8Array) {
    return new Folder(files, dataItemFactory, signer, masterKey);
}
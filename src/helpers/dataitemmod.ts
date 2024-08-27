import { b64UrlToBuffer } from "./encodeUtils";
import { serializeTags, Tag } from "./tags";
import { stringToBuffer, concatBuffers, longTo8ByteArray } from "./buf";
import { sha384 } from "./hash";
import { deepHash, deepHashChunks, DeepHashPointer } from "./deephashmod";
import { downloadUint8ArrayAsFile } from "./extra";
import { Sliceable, SliceParts } from "./slice";
import { AESEncryptedContainer } from "./aes";

export class DataItem extends Sliceable {
    signatureType: Uint8Array;
    signatureLength: number;
    owner: string;
    target: string | null;
    anchor: string | null;
    tags: Tag[];
    dataHash: DeepHashPointer | null;

    // prepareToSign(): Promise<any>;
    // extractHash(): Promise<DeepHashPointer>;
    // exportSigned(signature: Uint8Array): Promise<any>;
    // exportBinaryHeader(signature?: Uint8Array): Promise<Uint8Array>;
    signature: Uint8Array | null;
    rawFile: File | Uint8Array | AESEncryptedContainer | null;
    dataByteLength: number;

    cachedDataItemLength: number | null;

    binaryHeaderCached: Uint8Array | null;

    constructor(
        dataByteLength: number,
        dataHash: DeepHashPointer | null,
        owner: string,
        target: string | null,
        anchor: string | null,
        tags: Tag[],
        rawFile: File | Uint8Array | AESEncryptedContainer | null
    ) {
        super();
        this.signatureType = new Uint8Array([1, 0]); // Arweave
        this.signatureLength = 512;
        this.owner = owner;
        this.target = target;
        this.anchor = anchor;
        this.tags = tags;
        this.dataHash = dataHash;
        this.signature = null;
        this.rawFile = rawFile;
        this.binaryHeaderCached = null;
        this.dataByteLength = dataByteLength;
        this.cachedDataItemLength = null;
    }

    async prepareToSign(): Promise<Uint8Array> {
        if (!this.dataHash) throw new Error("Data hash is not available");

        let signArray = [];
        signArray.push(stringToBuffer("dataitem"));
        signArray.push(stringToBuffer("1"));
        signArray.push(this.signatureType);
        signArray.push(b64UrlToBuffer(this.owner));
        if (this.target) signArray.push(b64UrlToBuffer(this.target));
        if (this.anchor) signArray.push(b64UrlToBuffer(this.anchor));
        signArray.push(this.tags.map(tag => [stringToBuffer(tag.name), stringToBuffer(tag.value)]));
        signArray.push(this.dataHash);

        const tag = concatBuffers([
            stringToBuffer("list"),
            stringToBuffer(signArray.length.toString())
        ]);
    
        return await deepHashChunks(
            signArray,
            await sha384(tag),
            true
        );
    }

    async extractHash(): Promise<DeepHashPointer> {
        const pointer: DeepHashPointer = {
            value: await deepHash(await this.prepareToSign()),
            role: 'file-dataitem',
            dataLength: -1
        };
        return pointer;
    }

    async exportSigned(signature: Uint8Array): Promise<Uint8Array> {
      //
    }

    async getByteLength(): Promise<number> {
      if (this.cachedDataItemLength) return this.cachedDataItemLength;

      const _target = this.target ? b64UrlToBuffer(this.target) : null;
      const target_length = 1 + (_target?.byteLength ?? 0);
      const _anchor = this.anchor ? b64UrlToBuffer(this.anchor) : null;
      const anchor_length = 1 + (_anchor?.byteLength ?? 0);
      const _tags = (this.tags?.length ?? 0) > 0 ? serializeTags(this.tags) : null;
      const tags_length = 16 + (_tags ? _tags.byteLength : 0);
      const _owner = b64UrlToBuffer(this.owner);
      const owner_length = _owner.byteLength;

      const length = 2 + this.signatureLength + owner_length + target_length + anchor_length + tags_length;
      this.cachedDataItemLength = length;
      return length;
    }

    async exportBinaryHeader(signature?: Uint8Array): Promise<Uint8Array> {
      const _target = this.target ? b64UrlToBuffer(this.target) : null;
      const target_length = 1 + (_target?.byteLength ?? 0);
      const _anchor = this.anchor ? b64UrlToBuffer(this.anchor) : null;
      const anchor_length = 1 + (_anchor?.byteLength ?? 0);
      const _tags = (this.tags?.length ?? 0) > 0 ? serializeTags(this.tags) : null;
      const tags_length = 16 + (_tags ? _tags.byteLength : 0);
      const _owner = b64UrlToBuffer(this.owner);
      const owner_length = _owner.byteLength;

      const length = 2 + this.signatureLength + owner_length + target_length + anchor_length + tags_length;
      console.log({length})
      console.log("tags", _tags)
  
      // Create array with set length
      const bytes = new Uint8Array(length);

      // Signature type
      bytes[0] = this.signatureType[0];
      bytes[1] = this.signatureType[1];

      // Push bytes for signature
      if (!signature) {
        signature = new Uint8Array(this.signatureLength).fill(0);
      }
      bytes.set(signature, 2);
      if (signature.byteLength !== this.signatureLength) throw new Error(`Signature must be ${this.signatureLength} bytes but was incorrectly ${signature.byteLength}`);

      // Push bytes for `owner`
      bytes.set(_owner, 2 + this.signatureLength);
      if (owner_length !== 512 || _owner.byteLength !== 512) throw new Error(`Owner must be 512 bytes but was incorrectly ${owner_length} or ${_owner.byteLength}`);

      const position = 2 + this.signatureLength + owner_length;
      // Push `presence byte` and push `target` if present
      // 64 + OWNER_LENGTH
      bytes[position] = this.target ? 1 : 0;
      if (_target) {
        if (_target.byteLength !== 32) throw new Error(`Target must be 32 bytes but was incorrectly ${_target.byteLength}`);
        bytes.set(_target, position + 1);
      }
      
      // Push `presence byte` and push `anchor` if present
      // 64 + OWNER_LENGTH
      const anchor_start = position + target_length;
      let tags_start = anchor_start + 1;
      bytes[anchor_start] = this.anchor ? 1 : 0;
      if (this.anchor) {
        tags_start += anchor_length;
        if (_anchor === null || _anchor.byteLength !== 32) throw new Error('Anchor must be 32 bytes');
        bytes.set(_anchor, anchor_start + 1);
      }

      // Tags
      bytes.set(longTo8ByteArray(this.tags?.length ?? 0), tags_start);
      const bytesCount = longTo8ByteArray(_tags?.byteLength ?? 0);
      bytes.set(bytesCount, tags_start + 8);
      if (_tags) {
        bytes.set(_tags, tags_start + 16);
      }

      // downloadUint8ArrayAsFile(bytes, "dataitem.bin");

      return bytes;
    }

    async buildParts(): Promise<SliceParts> {
      let parts: SliceParts = [];

      if (!this.binaryHeaderCached) this.binaryHeaderCached = await this.exportBinaryHeader();

      parts.push([this.binaryHeaderCached.byteLength, this.binaryHeaderCached]);
      if (this.rawFile) {
        if (this.rawFile instanceof AESEncryptedContainer) {
          parts.push([await this.rawFile.getByteLength(), this.rawFile.slice.bind(this.rawFile)]);
        } else if (this.rawFile instanceof File) {
          parts.push([this.rawFile.size, this.rawFile]);
        } else if (this.rawFile instanceof Uint8Array) {
          parts.push([this.rawFile.byteLength, this.rawFile]);
        }
      }

      console.log("parts", parts);

      return parts;
    }

    async getRawBinary(): Promise<Uint8Array> {
      return await this.slice(0, await this.getByteLength());
    }
}

export async function createDataItemWithDataHash(
    dataHash: DeepHashPointer,
    owner: string, // todo encode properly
    target: string | null,
    anchor: string | null,
    tags: Tag[]
): Promise<DataItem> {
    const dataItem = new DataItem(dataHash.dataLength, dataHash, owner, target, anchor, tags, null);

    return dataItem;
}

export async function createDataItemWithRawFile(
  rawFile: File,
  owner: string, // todo encode properly
  target: string | null,
  anchor: string | null,
  tags: Tag[]
): Promise<DataItem> {
  const dataItem = new DataItem(rawFile.size, null, owner, target, anchor, tags, rawFile);

  return dataItem;
}

export async function createDataItemWithBuffer(
  buffer: Uint8Array,
  owner: string, // todo encode properly
  target: string | null,
  anchor: string | null,
  tags: Tag[]
): Promise<DataItem> {
  const dataItem = new DataItem(buffer.byteLength, null, owner, target, anchor, tags, buffer);

  return dataItem;
}

export async function createDataItemWithAESContainer(
  aes: AESEncryptedContainer,
  owner: string,
  target: string | null,
  anchor: string | null,
  tags: Tag[]
): Promise<DataItem> {
  const dataItem = new DataItem(await aes.getByteLength(), null, owner, target, anchor, tags, aes);

  return dataItem;
}
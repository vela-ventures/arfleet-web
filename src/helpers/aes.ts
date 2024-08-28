import { longTo8ByteArray } from "./buf";
import { DataItem } from "./dataitemmod";
import { Sliceable, SliceParts } from "./slice";

export const AES_IV_BYTE_LENGTH = 16;

const AES_CHUNK_SIZE = 256; // 2048;

const AES_OVERHEAD = 16;

const UNDERLYING_CHUNK_SIZE = AES_CHUNK_SIZE - AES_OVERHEAD;

type ChunkCacheEntry = {
    plainChunk: Uint8Array;
    encryptedChunk: Uint8Array;
}

export class AESEncryptedContainer extends Sliceable {
    dataItem: DataItem;
    salt: Uint8Array;
    secretKey: Uint8Array;
    iv: Uint8Array;
    underlyingByteLength: number;
    chunkCache: Map<number, ChunkCacheEntry>;
  
    constructor(dataItem: DataItem, salt: Uint8Array, secretKey: Uint8Array, iv: Uint8Array) {
      super();
      this.dataItem = dataItem;
      this.salt = salt;
      this.secretKey = secretKey;
      this.iv = iv;
      this.chunkCache = new Map<number, ChunkCacheEntry>();
      this.underlyingByteLength = 0;
      if (iv.length !== AES_IV_BYTE_LENGTH) {
        throw new Error(`Invalid IV length: ${iv.length}, expected ${AES_IV_BYTE_LENGTH}`);
      }
    }

    async encryptChunk(chunkIdx: number): Promise<Uint8Array> {
        if (this.chunkCache.has(chunkIdx)) {
            return this.chunkCache.get(chunkIdx)!.plainChunk;
        }

        if (chunkIdx > 0 && !this.chunkCache.has(chunkIdx - 1)) {
            await this.encryptChunk(chunkIdx - 1);
        }

        const iv = this.iv;
        const chain = (chunkIdx === 0) ? new Uint8Array(UNDERLYING_CHUNK_SIZE).fill(0) : this.chunkCache.get(chunkIdx - 1)!.encryptedChunk.slice(-UNDERLYING_CHUNK_SIZE);
        // Adjust chunk size to account for AES overhead
        const chunkStart = chunkIdx * UNDERLYING_CHUNK_SIZE;
        const chunkEnd = (chunkIdx + 1) * UNDERLYING_CHUNK_SIZE;
        const chunk = await this.dataItem.slice(chunkStart, chunkEnd);
        const chunkXored = new Uint8Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
            chunkXored[i] = chunk[i] ^ chain[i];
        }

        console.log("dataItem byte length", await this.dataItem.getByteLength());
        const totalChunks = Math.ceil((await this.dataItem.getByteLength()) / UNDERLYING_CHUNK_SIZE);
        const isLastChunk = chunkIdx === totalChunks - 1;

        console.log("-------------")
        console.log("isLastChunk", isLastChunk);
        console.log("chunkIdx", chunkIdx, "/", totalChunks);
        console.log("chunk", chunk);
        const encryptedChunk = await new Uint8Array(await encryptAes(chunkXored, this.secretKey, iv, isLastChunk));
        this.chunkCache.set(chunkIdx, { plainChunk: chunk, encryptedChunk: encryptedChunk });
        
        // Keep only the last N chunks in the cache
        const maxCacheSize = 5;
        const keysToKeep = Array.from({ length: maxCacheSize }, (_, i) => chunkIdx - i).filter(k => k >= 0);
        for (const key of this.chunkCache.keys()) {
            if (!keysToKeep.includes(key)) {
                this.chunkCache.delete(key);
            }
        }
        
        console.log("encryptedChunk", encryptedChunk);
        console.log("iv", iv);

        return encryptedChunk;
    }

    async encryptSlice(start: number, end: number): Promise<Uint8Array> {
        if (start >= end) {
            throw new Error("Invalid slice: start must be less than end");
        }

        console.log("-------------SLICE")
        console.log("start", start);
        console.log("end", end);

        // Adjust calculations to account for AES overhead
        const startChunkIdx = Math.floor(start / AES_CHUNK_SIZE);
        const endChunkIdx = Math.ceil(end / AES_CHUNK_SIZE) - 1;

        console.log("startChunkIdx", startChunkIdx);
        console.log("endChunkIdx", endChunkIdx);

        // Calculate offsets within the chunks
        const startOffset = start % AES_CHUNK_SIZE;
        const endOffset = end % AES_CHUNK_SIZE || AES_CHUNK_SIZE;

        console.log("startOffset", startOffset);
        console.log("endOffset", endOffset);

        let encryptedData = new Uint8Array((endChunkIdx - startChunkIdx + 1) * AES_CHUNK_SIZE);
        let position = 0;

        // console.log("encryptedData", encryptedData);

        for (let chunkIdx = startChunkIdx; chunkIdx <= endChunkIdx; chunkIdx++) {
            console.log(">position before", position);
            const encryptedChunk = await this.encryptChunk(chunkIdx);
            encryptedData.set(encryptedChunk, position);
            position += encryptedChunk.length;
            // const chunkStart = chunkIdx === startChunkIdx ? startOffset : 0;
            // const chunkEnd = chunkIdx === endChunkIdx ? endOffset + AES_OVERHEAD : encryptedChunk.length;
            // console.log(">chunkStart", chunkStart);
            // console.log(">chunkEnd", chunkEnd);
            
            // encryptedData.set(encryptedChunk.slice(chunkStart, chunkEnd), position);
            // position += chunkEnd - chunkStart;

            // console.log(">encryptedData", encryptedData);
            console.log(">position after", position);
        }

        const firstChunkStartIdx = startChunkIdx * AES_CHUNK_SIZE;
        const startOffsetDifference = start - firstChunkStartIdx;
        return encryptedData.slice(startOffsetDifference, end - start);
    }

    async getEncryptedByteLength(): Promise<number> {
        const originalLength = await this.dataItem.getByteLength();
        const fullChunks = Math.floor(originalLength / UNDERLYING_CHUNK_SIZE);
        const remainingBytes = originalLength % UNDERLYING_CHUNK_SIZE;
        
        // Calculate total length: full chunks + last chunk (if any) + AES overhead for each chunk
        const totalLength = (fullChunks * AES_CHUNK_SIZE) + 
                            (remainingBytes > 0 ? remainingBytes + AES_OVERHEAD : 0);
        
        return totalLength;
    }

    async buildParts(): Promise<SliceParts> {
        this.underlyingByteLength = await this.dataItem.getByteLength();

        const magicString = "arf::enc";
        const parts: SliceParts = [];
        parts.push([magicString.length, new TextEncoder().encode(magicString)]);
        parts.push([8, longTo8ByteArray(this.underlyingByteLength)]); // underlying byte length
        parts.push([this.salt.length, this.salt]);
        parts.push([this.iv.length, this.iv]);
        parts.push([await this.getEncryptedByteLength(), this.encryptSlice.bind(this)]);
        return parts;
    }
};

export const encryptAes = async (file: Uint8Array, key: Uint8Array, iv: Uint8Array, isLastChunk: boolean) => {
    // prepare the secret key for encryption
    const secretKey = await crypto.subtle.importKey('raw', key, {
        name: 'AES-CBC',
        length: 256
    }, true, ['encrypt', 'decrypt']);
  
    // encrypt the data with the secret key
    const ciphertextArrayBuffer = new Uint8Array(await crypto.subtle.encrypt({
        name: 'AES-CBC',
        iv: iv
    }, secretKey, file));
  
    // // make sure the overhead is exactly that
    // const overhead = ciphertextArrayBuffer.length - file.length;
    // if (overhead !== AES_OVERHEAD && ! isLastChunk) {
    //     throw new Error(`Invalid overhead: ${overhead}, expected ${AES_OVERHEAD}`);
    // }

    // make sure the length is correct
    let result;
    if (ciphertextArrayBuffer.length === AES_CHUNK_SIZE) {
        result = ciphertextArrayBuffer;
    } else if (ciphertextArrayBuffer.length < AES_CHUNK_SIZE && isLastChunk) {
        // pad it
        result = new Uint8Array(AES_CHUNK_SIZE);
        result.fill(0);
        result.set(ciphertextArrayBuffer);
    } else {
        throw new Error(`Invalid length: ${ciphertextArrayBuffer.length}, expected ${AES_CHUNK_SIZE}`);
    }

    return result;
}

export const decryptAes = async (fileArrayBuffer: Uint8Array, key: Uint8Array, iv: Uint8Array) => {
    // prepare the secret key for encryption
    const secretKey = await crypto.subtle.importKey('raw', key, {
        name: 'AES-CBC',
        length: 256
    }, true, ['encrypt', 'decrypt']);

    // decrypt the data with the secret key
    const plaintextArrayBuffer = await crypto.subtle.decrypt({
        name: 'AES-CBC',
        iv: iv
    }, secretKey, fileArrayBuffer);

    return new Uint8Array(plaintextArrayBuffer);
}
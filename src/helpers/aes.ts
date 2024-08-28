import { longTo8ByteArray } from "./buf";
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
    inner: Sliceable;
    salt: Uint8Array;
    secretKey: Uint8Array;
    iv: Uint8Array;
    chunkCache: Map<number, ChunkCacheEntry>;
    chunkCount: number | null; 
  
    constructor(inner: Sliceable, salt: Uint8Array, secretKey: Uint8Array, iv: Uint8Array) {
      super();
      this.inner = inner;
      this.salt = salt;
      this.secretKey = secretKey;
      this.iv = iv;
      this.chunkCache = new Map<number, ChunkCacheEntry>();
      this.chunkCount = null;
      if (iv.length !== AES_IV_BYTE_LENGTH) {
        throw new Error(`Invalid IV length: ${iv.length}, expected ${AES_IV_BYTE_LENGTH}`);
      }
    }

    ChunkIdxByEncryptedOffset(offset: number): number {
        return Math.floor(offset / AES_CHUNK_SIZE);
    }

    ChunkIdxByUnderlyingOffset(offset: number): number {
        return Math.floor(offset / UNDERLYING_CHUNK_SIZE);
    }

    async encryptSlice(start: number, end: number): Promise<Uint8Array> {
        if (start >= end) throw new Error("Invalid slice: start must be less than end");
        if (start < 0 || start >= this.byteLengthCached!) throw new Error("Invalid slice: start must be within the underlying byte length");
        if (end < 0 || end > this.byteLengthCached!) throw new Error("Invalid slice: end must be within the underlying byte length");

        console.log("-------------SLICE")
        console.log("start", start);
        console.log("end", end);

        // Adjust calculations to account for AES overhead
        const startChunkIdx = this.ChunkIdxByEncryptedOffset(start);
        const finalByteChunkIdx = this.ChunkIdxByEncryptedOffset(end - 1);

        console.log("startChunkIdx", startChunkIdx);
        console.log("finalByteChunkIdx", finalByteChunkIdx);

        // Calculate offsets within the chunks
        const startOffset = start % AES_CHUNK_SIZE;
        const finishOffset = (end-1) % AES_CHUNK_SIZE;

        console.log("startOffset", startOffset);
        console.log("finishOffset", finishOffset);

        const chunksToStore = finalByteChunkIdx - startChunkIdx + 1;

        let encryptedData = new Uint8Array(chunksToStore * AES_CHUNK_SIZE);
        let position = 0;

        // console.log("encryptedData", encryptedData);

        for (let chunkIdx = startChunkIdx; chunkIdx <= finalByteChunkIdx; chunkIdx++) {
            console.log(">position before", position);
            const encryptedChunk = await this.encryptChunk(chunkIdx);
            encryptedData.set(encryptedChunk, position);
            position += encryptedChunk.length;
            console.log(">position after", position);
        }

        const firstChunkStartIdx = startChunkIdx * AES_CHUNK_SIZE;
        const startOffsetDifference = start - firstChunkStartIdx;
        const sliceLength = end - start;
        return encryptedData.slice(startOffsetDifference, startOffsetDifference + sliceLength);
    }

    async encryptChunk(chunkIdx: number): Promise<Uint8Array> {
        if (this.chunkCache.has(chunkIdx)) {
            return this.chunkCache.get(chunkIdx)!.plainChunk;
        }

        console.log("AES: encrypting chunk", chunkIdx, "(not found in cache)");

        let previousChunk = null;
        if (chunkIdx > 0) {
            if (!this.chunkCache.has(chunkIdx - 1)) {
                await this.encryptChunk(chunkIdx - 1);
            }
            previousChunk = this.chunkCache.get(chunkIdx - 1)!.encryptedChunk;
        } else {
            previousChunk = new Uint8Array(UNDERLYING_CHUNK_SIZE).fill(0);
        }

        const iv = this.iv;
        const chain = previousChunk!.slice(-UNDERLYING_CHUNK_SIZE);

        // Adjust chunk size to account for AES overhead
        const isLastChunk = chunkIdx === this.chunkCount! - 1;
        const chunkUnderlyingStart = chunkIdx * UNDERLYING_CHUNK_SIZE;
        const chunkUnderlyingLength = (isLastChunk) ? (await this.inner.getByteLength() % UNDERLYING_CHUNK_SIZE) : UNDERLYING_CHUNK_SIZE;
        const chunkUnderlyingEnd = chunkUnderlyingStart + chunkUnderlyingLength;

        console.log("AES.inner byte length", await this.inner.getByteLength());

        console.log("-------------")
        console.log("isLastChunk", isLastChunk);
        console.log("chunkIdx", chunkIdx, "/", this.chunkCount);

        console.log("AES: getting inner slice", chunkUnderlyingStart, chunkUnderlyingEnd);
        const chunk = await this.inner.slice(chunkUnderlyingStart, chunkUnderlyingEnd);

        console.log("AES plaintext chunk", chunk);

        // XOR with previous chunk ciphertext
        const chunkXored = new Uint8Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
            chunkXored[i] = chunk[i] ^ chain[i];
        }

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

    async getEncryptedByteLength(): Promise<number> {
        const originalLength = await this.inner.getByteLength();
        this.chunkCount = Math.ceil(originalLength / UNDERLYING_CHUNK_SIZE);
        return this.chunkCount * AES_CHUNK_SIZE;
    }

    async buildParts(): Promise<SliceParts> {
        this.underlyingByteLength = await this.inner.getByteLength();

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
import { longTo8ByteArray } from "./buf";
import { EncryptedContainer } from "./encryptedContainer";
import { Sliceable, SliceParts } from "./sliceable";

export const AES_IV_BYTE_LENGTH = 16;

const AES_CHUNK_SIZE = 256; // 2048;

const AES_OVERHEAD = 16;

const AES_UNDERLYING_CHUNK_SIZE = AES_CHUNK_SIZE - AES_OVERHEAD;

const log = (...args: any[]) => (false) ? console.log('[AES]', ...args) : null;

export class AESEncryptedContainer extends EncryptedContainer {
    salt: Uint8Array;
    secretKey: Uint8Array;
    iv: Uint8Array;
  
    constructor(inner: Sliceable, salt: Uint8Array, secretKey: Uint8Array, iv: Uint8Array) {
      super();

      this.encryptedChunkSize = AES_CHUNK_SIZE;
      this.underlyingChunkSize = AES_UNDERLYING_CHUNK_SIZE;

      this.inner = inner;
      this.salt = salt;
      this.secretKey = secretKey;
      this.iv = iv;
      if (iv.length !== AES_IV_BYTE_LENGTH) {
        throw new Error(`Invalid IV length: ${iv.length}, expected ${AES_IV_BYTE_LENGTH}`);
      }

      this.log = log;
    }

    async encryptChunk(chunkIdx: number): Promise<Uint8Array> {
        if (this.chunkCache.has(chunkIdx)) {
            return this.chunkCache.get(chunkIdx)!.plainChunk;
        }

        this.log("encrypting chunk", chunkIdx, "(not found in cache)");

        let previousChunk = null;
        if (chunkIdx > 0) {
            if (!this.chunkCache.has(chunkIdx - 1)) {
                await this.encryptChunk(chunkIdx - 1);
            }
            previousChunk = this.chunkCache.get(chunkIdx - 1)!.encryptedChunk;
        } else {
            previousChunk = new Uint8Array(this.underlyingChunkSize).fill(0);
        }

        const iv = this.iv;
        const chain = previousChunk!.slice(-this.underlyingChunkSize);

        const [chunkUnderlyingStart, chunkUnderlyingEnd, isLastChunk] = await this.getChunkUnderlyingBoundaries(chunkIdx);

        this.log("AES.inner byte length", await this.inner!.getByteLength());

        this.log("chunkIdx", chunkIdx, "/", this.chunkCount);

        this.log("AES: getting inner slice", chunkUnderlyingStart, chunkUnderlyingEnd);
        const chunk = await this.inner!.slice(chunkUnderlyingStart, chunkUnderlyingEnd);

        this.log("AES plaintext chunk", chunk);

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
        
        this.log("AES encryptedChunk", encryptedChunk);
        this.log("AES iv", iv);

        return encryptedChunk;
    }

    async buildParts(): Promise<SliceParts> {
        const magicString = "arf::enc";
        const parts: SliceParts = [];
        parts.push([magicString.length, new TextEncoder().encode(magicString)]);
        parts.push([8, longTo8ByteArray(await this.inner!.getByteLength())]); // underlying byte length
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
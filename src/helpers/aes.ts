import { bufferToAscii, byteArrayToLong, concatBuffers, longTo8ByteArray } from "./buf";
import { encKeyFromMasterKeyAndSalt } from "./encrypt";
import { EncryptedContainer } from "./encryptedContainer";
import { Sliceable, SliceableReader, SliceParts } from "./sliceable";

export const AES_IV_BYTE_LENGTH = 16;

const AES_CHUNK_SIZE = 256;

const AES_OVERHEAD = 1;

const AES_UNDERLYING_CHUNK_SIZE = AES_CHUNK_SIZE - AES_OVERHEAD;

const AES_SALT_BYTE_LENGTH = 32;

const log = (...args: any[]) => (true) ? console.log('[AES]', ...args) : null;

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
            return this.chunkCache.get(chunkIdx)!.encryptedChunk;
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

        const iv = (chunkIdx === 0) ? this.iv : previousChunk!.slice(-AES_IV_BYTE_LENGTH);
        // const chain = previousChunk!.slice(-this.underlyingChunkSize);

        const [chunkUnderlyingStart, chunkUnderlyingEnd, isLastChunk] = await this.getChunkUnderlyingBoundaries(chunkIdx);

        this.log("AES.inner byte length", await this.inner!.getByteLength());

        this.log("chunkIdx", chunkIdx, "/", this.chunkCount);

        this.log("AES: getting inner slice", chunkUnderlyingStart, chunkUnderlyingEnd);
        const chunk = await this.inner!.slice(chunkUnderlyingStart, chunkUnderlyingEnd);

        this.log("AES plaintext chunk", chunk);

        const expandedChunk = new Uint8Array(AES_UNDERLYING_CHUNK_SIZE).fill(0);
        expandedChunk.set(chunk);

        // // XOR with previous chunk ciphertext
        // const chunkXored = new Uint8Array(chunk.length);
        // for (let i = 0; i < chunk.length; i++) {
        //     chunkXored[i] = chunk[i] ^ chain[i];
        // }
        const chunkXored = expandedChunk;
        // console.log("chunkXored", bufferToAscii(chunkXored));
        
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
        const magicString = "arf::aes";
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

    console.log("ciphertextArrayBuffer.byteLength", ciphertextArrayBuffer.byteLength);
    // make sure the length is correct
    let result;
    if (ciphertextArrayBuffer.byteLength === AES_CHUNK_SIZE) {
        result = ciphertextArrayBuffer;
    } else if (ciphertextArrayBuffer.byteLength < AES_CHUNK_SIZE && isLastChunk) {
        // pad it
        result = new Uint8Array(AES_CHUNK_SIZE);
        result.fill(0);
        result.set(ciphertextArrayBuffer);
    } else {
        throw new Error(`Invalid length: ${ciphertextArrayBuffer.byteLength}, expected ${AES_CHUNK_SIZE}`);
    }

    console.log("result", bufferToAscii(result));

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

export class AESContainerReader extends SliceableReader {
    ciphertext: SliceableReader;
    dataLength: number;
    initialized: boolean;
    salt: Uint8Array;
    iv: Uint8Array;
    key: Uint8Array;
    masterKey: Uint8Array;
    dataStartPos: number;
    constructor(ciphertext: SliceableReader, masterKey: Uint8Array) {
        super();
        this.ciphertext = ciphertext;
        this.dataLength = 0;
        this.initialized = false;
        this.salt = new Uint8Array();
        this.iv = new Uint8Array();
        this.key = new Uint8Array();
        this.masterKey = masterKey;
        this.dataStartPos = 0;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        await this.ciphertext.init();

        const header = await this.ciphertext.slice(0, 8 + 8 + AES_SALT_BYTE_LENGTH + AES_IV_BYTE_LENGTH);
        const magicString = new TextDecoder().decode(header.slice(0, 8));
        if (magicString !== "arf::aes") {
            throw new Error(`Invalid magic string: ${magicString}, expected "arf::aes"`);
        }

        const underlyingByteLength = byteArrayToLong(header.slice(8, 16));
        this.dataLength = underlyingByteLength;

        this.salt = header.slice(16, 16 + AES_SALT_BYTE_LENGTH);
        this.iv = header.slice(16 + AES_SALT_BYTE_LENGTH, 16 + AES_SALT_BYTE_LENGTH + AES_IV_BYTE_LENGTH);
        
        this.key = await encKeyFromMasterKeyAndSalt(this.masterKey, this.salt);

        this.dataStartPos = 8 + 8 + AES_SALT_BYTE_LENGTH + AES_IV_BYTE_LENGTH;
    }

    async slice(start: number, end: number) {
        if (!this.initialized) {
            throw new Error('AESContainerReader is not initialized');
        }

        if (start < 0 || end < 0 || start > end) throw new Error(`Invalid slice: start=${start}, end=${end}`);
        if (start >= this.dataLength) throw new Error(`Invalid slice: start=${start} is greater than or equal to data length=${this.dataLength}`);
        if (end > this.dataLength) throw new Error(`Invalid slice: end=${end} is greater than data length=${this.dataLength}`);

        const startChunkIdx = Math.floor(start / AES_UNDERLYING_CHUNK_SIZE);
        const finalChunkIdx = Math.floor((end-1) / AES_UNDERLYING_CHUNK_SIZE);

        let ciphertextChunks: Uint8Array[] = [];
        let result: Uint8Array[] = [];
        for (let chunkIdx = startChunkIdx; chunkIdx <= finalChunkIdx; chunkIdx++) {
            let thisCiphertext: Uint8Array;
            if (ciphertextChunks[chunkIdx]) {
                thisCiphertext = ciphertextChunks[chunkIdx];
            } else {
                thisCiphertext = await this.ciphertext.slice(this.dataStartPos + chunkIdx * AES_CHUNK_SIZE, this.dataStartPos + (chunkIdx + 1) * AES_CHUNK_SIZE);
                ciphertextChunks[chunkIdx] = thisCiphertext;
            }

            let prevCiphertext: Uint8Array | null = null;
            if (chunkIdx === 0) {
                prevCiphertext = new Uint8Array(AES_CHUNK_SIZE).fill(0);
            } else {
                if (ciphertextChunks[chunkIdx - 1]) {
                    prevCiphertext = ciphertextChunks[chunkIdx - 1];
                } else {
                    prevCiphertext = await this.ciphertext.slice(this.dataStartPos + (chunkIdx - 1) * AES_CHUNK_SIZE, this.dataStartPos + chunkIdx * AES_CHUNK_SIZE);
                    ciphertextChunks[chunkIdx - 1] = prevCiphertext;
                }
            }
            // prevCiphertext = prevCiphertext.slice(-AES_UNDERLYING_CHUNK_SIZE);

            const iv = (chunkIdx === 0) ? this.iv : prevCiphertext.slice(-AES_IV_BYTE_LENGTH);

            const plaintextChunk = await decryptAes(thisCiphertext, this.key, iv);

            // make sure it's correct size
            if (plaintextChunk.length !== AES_UNDERLYING_CHUNK_SIZE) {
                throw new Error(`Invalid plaintext chunk length: ${plaintextChunk.length}, expected ${AES_UNDERLYING_CHUNK_SIZE}`);
            }

            // // XOR with previous chunk ciphertext
            // const chunkXored = new Uint8Array(plaintextChunk.length);
            // for (let i = 0; i < plaintextChunk.length; i++) {
            //     chunkXored[i] = plaintextChunk[i] ^ prevCiphertext[i];
            // }
            const chunkXored = plaintextChunk;

            result.push(chunkXored);
        }

        const concatenated = concatBuffers(result);

        const startOffset = start % AES_UNDERLYING_CHUNK_SIZE;
        const len = end - start;

        return concatenated.slice(startOffset, startOffset + len);
    }

}
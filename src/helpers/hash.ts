import init, { Hasher, HashType, RsaEncryptor } from '../../wasm/pkg/wasm_helpers.js';
import { bufferToHex, hexToBuffer } from './buf.js';

export { Hasher, HashType };

export async function makeHasher(hashType: HashType): Promise<Hasher> {
  await init();
  return new Hasher(hashType);
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

export async function sha384(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-384', data);
    return new Uint8Array(hashBuffer);
}

export async function sha256hex(data: Uint8Array): Promise<string> {
    return bufferToHex(await sha256(data));
}

export async function sha384hex(data: Uint8Array): Promise<string> {
    return bufferToHex(await sha384(data));
}

// Type definition for our RSA key
interface RsaKey {
    n: Uint8Array;  // modulus
    e: Uint8Array;  // public exponent
    d: Uint8Array;  // private exponent
    bits: number;   // key size in bits
}

let encryptor: RsaEncryptor | null = null;

export async function initRsa() {
    await init();
    encryptor = new RsaEncryptor();
}

export async function generateRsaKey(bits: number): Promise<RsaKey> {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: bits,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

    return {
        n: base64UrlToBuffer(publicKey.n!),
        e: base64UrlToBuffer(publicKey.e!),
        d: base64UrlToBuffer(privateKey.d!),
        bits: bits
    };
}

export async function rsaEncrypt(data: Uint8Array, key: RsaKey): Promise<Uint8Array> {
    if (!encryptor) {
        throw new Error("RSA not initialized. Call initRsa() first.");
    }
    const paddedData = padRight(data, key.bits / 8 - 1);
    console.log(`Encrypting data (${paddedData.length} bytes): ${bufferToHex(paddedData)}`);
    const encrypted = new Uint8Array(encryptor.private_encrypt(paddedData, key.n, key.d));
    console.log(`Encrypted result (${encrypted.length} bytes): ${bufferToHex(encrypted)}`);
    return encrypted;
}

export async function rsaDecrypt(data: Uint8Array, key: RsaKey): Promise<Uint8Array> {
    if (!encryptor) {
        throw new Error("RSA not initialized. Call initRsa() first.");
    }
    console.log(`Decrypting data (${data.length} bytes): ${bufferToHex(data)}`);
    const decrypted = new Uint8Array(encryptor.public_decrypt(data, key.n, key.e));
    console.log(`Decrypted result (${decrypted.length} bytes): ${bufferToHex(decrypted)}`);
    return decrypted;
}

function padRight(data: Uint8Array, targetLength: number): Uint8Array {
    if (data.length > targetLength || data.length === targetLength) {
        throw new Error("Data is too long: " + data.length + " bytes, target length is " + targetLength + " bytes, and we need -1");
    }
    const padded = new Uint8Array(targetLength);
    padded.set(data, 0);
    return padded;
}

export async function testRsaChunkSize(data: Uint8Array, key: RsaKey): Promise<boolean> {
    try {
        console.log(`\nTesting chunk size: ${data.length}`);
        const encrypted = await rsaEncrypt(data, key);
        const decrypted = await rsaDecrypt(encrypted, key);
        const result = buffersEqual(padRight(data, key.bits / 8 - 1), decrypted);
        console.log(`Test result: ${result ? 'Success' : 'Failure'}`);
        return result;
    } catch (error) {
        console.error("RSA operation failed:", error);
        return false;
    }
}

export async function fuzzRsaChunkSize(keyBits: number, maxChunkSize: number, step: number = 1): Promise<{maxSuccessfulSize: number, error: string | null}> {
    await initRsa();
    const key = await generateRsaKey(keyBits);

    console.log(`Testing RSA chunk sizes for ${keyBits}-bit key:`);

    let maxSuccessfulSize = 0;
    let error: string | null = null;

    for (let size = 1; size <= maxChunkSize; size += step) {
        const testData = generateRandomData(size);
        try {
            const success = await testRsaChunkSize(testData, key);
            if (success) {
                maxSuccessfulSize = size;
            } else {
                error = `Failed at size ${size} without throwing an error`;
                break;
            }
        } catch (err) {
            error = `Error at size ${size}: ${err instanceof Error ? err.message : String(err)}`;
            break;
        }
    }

    return { maxSuccessfulSize, error };
}

// Helper functions

function generateRandomData(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
}

function base64UrlToBuffer(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
}

function buffersEqual(buf1: Uint8Array, buf2: Uint8Array): boolean {
    if (buf1.byteLength != buf2.byteLength) return false;
    for (let i = 0; i < buf1.byteLength; i++) {
        if (buf1[i] != buf2[i]) return false;
    }
    return true;
}

function bufferToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Example usage
export async function runRsaTest() {
    const keySizes = [1024, 2048, 4096];
    const results = [];

    for (const keySize of keySizes) {
        console.log(`\nTesting ${keySize}-bit RSA key:`);
        const result = await fuzzRsaChunkSize(keySize, keySize / 8);
        results.push({ keySize, ...result });
    }

    console.log("\n--- Final Results ---");
    for (const result of results) {
        console.log(`\n${result.keySize}-bit RSA key:`);
        console.log(`Maximum successful chunk size: ${result.maxSuccessfulSize} bytes`);
        if (result.error) {
            console.log(`Test stopped due to error: ${result.error}`);
        } else {
            console.log(`All tests passed up to ${result.maxSuccessfulSize} bytes`);
        }
    }
}

export async function run() {
    await runRsaTest();
}
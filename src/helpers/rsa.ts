import { AESEncryptedContainer } from "./aes";
import { Sliceable, SliceParts } from "./sliceable.js";
import init, { Hasher, HashType, RsaEncryptor } from '../../wasm/pkg/wasm_helpers.js';
import { longTo8ByteArray } from "./buf.js";
import { EncryptedContainer } from "./encryptedContainer.js";
import { PLACEMENT_BLOB_CHUNK_SIZE } from "./placementBlob.js";

const RSA_KEY_SIZE = 1024;

const RSA_ENCRYPTED_CHUNK_SIZE = RSA_KEY_SIZE / 8;
const RSA_UNDERLYING_CHUNK_SIZE = RSA_ENCRYPTED_CHUNK_SIZE - 1;

const RSA_PLACEMENT_UNDERLYING_CHUNK_SIZE = PLACEMENT_BLOB_CHUNK_SIZE - RSA_ENCRYPTED_CHUNK_SIZE; // take 1 chunk for header // todo

const log = (...args: any[]) => (false) ? console.log('[RSA]', ...args) : null;

export class RSAContainer extends EncryptedContainer {
  private rsaKeyPair: CryptoKeyPair;
  private cachedRsaKey: RsaKey | null = null;
  private isInitialized: boolean = false;

  constructor(rsaKeyPair: CryptoKeyPair, inner: Sliceable) {
    super();
    this.rsaKeyPair = rsaKeyPair;
    this.inner = inner;

    this.underlyingChunkSize = RSA_UNDERLYING_CHUNK_SIZE;
    this.encryptedChunkSize = RSA_ENCRYPTED_CHUNK_SIZE;
    this.log = log;
  }

  private async initialize() {
    if (!this.isInitialized) {
      await initRsa();
      this.isInitialized = true;
    }
  }

  async getRsaKey(): Promise<RsaKey> {
    await this.initialize();
    if (!this.cachedRsaKey) {
      try {
        this.cachedRsaKey = await keyPairToRsaKey(this.rsaKeyPair);
      } catch (error) {
        console.error('Error getting RSA key:', error);
        throw error;
      }
    }
    return this.cachedRsaKey;
  }

  async buildParts(): Promise<SliceParts> {
    const parts: SliceParts = [];

    // let encryptedLengthLeft = await this.getEncryptedByteLength();
    let decryptedLengthLeft = await this.inner!.getByteLength();

    while(decryptedLengthLeft > 0) {
      const magicString = "arf::rsa";
      parts.push([magicString.length, new TextEncoder().encode(magicString)]);
      parts.push([8, longTo8ByteArray((decryptedLengthLeft >= RSA_UNDERLYING_CHUNK_SIZE) ? RSA_UNDERLYING_CHUNK_SIZE : decryptedLengthLeft)]);
      parts.push([8, this.zeroes.bind(this, 0, RSA_ENCRYPTED_CHUNK_SIZE - 8 - 8)]);

      // parts.push([await this.getEncryptedByteLength(), ((start: number, end: number) => {
      //   return this.newEncryptedSlice(start, end);
      // }).bind(this, 0, )]);

      decryptedLengthLeft -= RSA_UNDERLYING_CHUNK_SIZE;
    }
  }

  //   for(let i = 0; i < this.chunkCount; i++) {
  //   const magicString = "arf::rsa";
  //   parts.push([magicString.length, new TextEncoder().encode(magicString)]);
  //   parts.push([8, longTo8ByteArray(await this.inner!.getByteLength())]);
  //   // parts.push([await this.getEncryptedByteLength(), this.encryptSlice.bind(this)]);

  //   return parts;
  // }

  // async newEncryptedSlice(start: number, end: number): Promise<Uint8Array> {
  //   return this.inner!.slice(start, end);
  // }

  // async rsaPassthroughSlice(start: number, end: number): Promise<Uint8Array> {
  //   return this.inner!.slice(start, end);
  // }

  async encryptChunk(chunkIdx: number): Promise<Uint8Array> {
    this.log('encryptChunk', chunkIdx, this.rsaKeyPair)

    await this.initialize();
    if (this.chunkCache.has(chunkIdx)) {
      return this.chunkCache.get(chunkIdx)!.encryptedChunk;
    }

    const [chunkUnderlyingStart, chunkUnderlyingEnd, isLastChunk] = await this.getChunkUnderlyingBoundaries(chunkIdx);
    
    this.log("inner byte length", await this.inner!.getByteLength());

    this.log("chunkIdx", chunkIdx, "/", this.chunkCount);

    this.log("RSA: getting inner slice", chunkUnderlyingStart, chunkUnderlyingEnd);
    const chunk = await this.inner!.slice(chunkUnderlyingStart, chunkUnderlyingEnd);

    this.log("RSA plaintext chunk", chunk);

    this.log('RSA underlyingChunkStart', chunkUnderlyingStart)
    this.log('RSA underlyingChunkEnd', chunkUnderlyingEnd)

    const rsaKey = await this.getRsaKey();
    const encryptedChunk = await rsaEncrypt(chunk, rsaKey);

    this.chunkCache.set(chunkIdx, { plainChunk: chunk, encryptedChunk: encryptedChunk });

    // Keep only the last N chunks in the cache
    const maxCacheSize = 5;
    const keysToKeep = Array.from({ length: maxCacheSize }, (_, i) => chunkIdx - i).filter(k => k >= 0);
    for (const key of this.chunkCache.keys()) {
      if (!keysToKeep.includes(key)) {
        this.chunkCache.delete(key);
      }
    }

    this.log('encrypted chunk', encryptedChunk)

    return encryptedChunk;
  }

}

export async function generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 1024,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    return keyPair;
}

export async function experiment() {
    console.log('experiment2')
    const keyPair = await generateRSAKeyPair();
    console.log('keyPair', keyPair)
    const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    console.log({
        publicKey: new Uint8Array(publicKey),
        privateKey: new Uint8Array(privateKey)
    });
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

export async function keyPairToRsaKey(keyPair: CryptoKeyPair): Promise<RsaKey> {
  try {
    const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

    console.log('Public Key:', publicKey);
    console.log('Private Key:', privateKey);

    if (!publicKey.n || !publicKey.e || !privateKey.d) {
      throw new Error('Missing required key components');
    }

    return {
      n: base64UrlToBuffer(publicKey.n),
      e: base64UrlToBuffer(publicKey.e),
      d: base64UrlToBuffer(privateKey.d),
      bits: base64UrlToBuffer(publicKey.n).length * 8
    };
  } catch (error) {
    console.error('Error in keyPairToRsaKey:', error);
    throw error;
  }
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  if (typeof base64url !== 'string') {
    console.error('Invalid input to base64UrlToBuffer:', base64url);
    throw new Error('Invalid base64url string');
  }
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export async function generateRsaKey(bits: number, exponent: number = 65537): Promise<RsaKey> {
  if (exponent !== 3 && exponent !== 65537) {
      throw new Error("Public exponent must be either 3 or 65537");
  }

  const keyPair = await window.crypto.subtle.generateKey(
      {
          name: "RSA-OAEP",
          modulusLength: bits,
          publicExponent: new Uint8Array(exponent === 3 ? [3] : [1, 0, 1]),
          hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
  );

  return keyPairToRsaKey(keyPair);
}

export async function rsaEncrypt(data: Uint8Array, key: RsaKey): Promise<Uint8Array> {
  if (!encryptor) {
      throw new Error("RSA not initialized. Call initRsa() first.");
  }
  const maxSize = key.bits / 8 - 1;
  if (data.length > maxSize) {
    throw new Error(`Data is too long: ${data.length} bytes, maximum is ${maxSize} bytes`);
  }
  const paddedData = padRight(data, key.bits / 8);
  log(`RSA Encrypting data (${paddedData.length} bytes): ${bufferToHex(paddedData)}`);
  const encrypted = new Uint8Array(encryptor.private_encrypt(paddedData, key.n, key.d));
  log(`RSA Encrypted result (${encrypted.length} bytes): ${bufferToHex(encrypted)}`);
  return encrypted;
}

export async function rsaDecrypt(data: Uint8Array, key: RsaKey): Promise<Uint8Array> {
  if (!encryptor) {
      throw new Error("RSA not initialized. Call initRsa() first.");
  }
  log(`RSA Decrypting data (${data.length} bytes): ${bufferToHex(data)}`);
  const decrypted = new Uint8Array(encryptor.public_decrypt(data, key.n, key.e));
  log(`RSA Decrypted result (${decrypted.length} bytes): ${bufferToHex(decrypted)}`);
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

interface PerformanceResult {
  keySize: number;
  exponent: number;
  encryptionTime: number;
  decryptionTime: number;
  encryptionOps: number;
  decryptionOps: number;
}

export async function fuzzRsaPerformance(
  keySizes: number[] = [1024, 2048, 4096],
  exponents: number[] = [3, 65537],
  testDuration: number = 1000  // Duration in milliseconds
): Promise<PerformanceResult[]> {
  await initRsa();
  const results: PerformanceResult[] = [];

  for (const keySize of keySizes) {
      for (const exponent of exponents) {
          console.log(`Testing ${keySize}-bit RSA key with exponent ${exponent}:`);
          
          try {
              const key = await generateRsaKey(keySize, exponent);
              const testData = generateRandomData(keySize / 8 - 2);  // Maximum size that works

              let encryptionOps = 0;
              let decryptionOps = 0;
              let encryptionTime = 0;
              let decryptionTime = 0;

              // Test encryption
              const encryptStartTime = performance.now();
              while (performance.now() - encryptStartTime < testDuration) {
                  const startOp = performance.now();
                  await rsaEncrypt(testData, key);
                  encryptionTime += performance.now() - startOp;
                  encryptionOps++;
              }

              // Test decryption
              const encrypted = await rsaEncrypt(testData, key);
              const decryptStartTime = performance.now();
              while (performance.now() - decryptStartTime < testDuration) {
                  const startOp = performance.now();
                  await rsaDecrypt(encrypted, key);
                  decryptionTime += performance.now() - startOp;
                  decryptionOps++;
              }

              results.push({
                  keySize,
                  exponent,
                  encryptionTime,
                  decryptionTime,
                  encryptionOps,
                  decryptionOps
              });
          } catch (error) {
              console.error(`Error testing ${keySize}-bit key with exponent ${exponent}:`, error);
          }
      }
  }

  return results;
}

export async function runRsaPerformanceTest() {
  const results = await fuzzRsaPerformance();

  console.log("\n--- Performance Test Results ---");
  for (const result of results) {
      console.log(`\n${result.keySize}-bit RSA key with exponent ${result.exponent}:`);
      console.log(`Encryption: ${result.encryptionOps} ops in ${result.encryptionTime.toFixed(2)}ms (${(result.encryptionOps / result.encryptionTime * 1000).toFixed(2)} ops/s)`);
      console.log(`Decryption: ${result.decryptionOps} ops in ${result.decryptionTime.toFixed(2)}ms (${(result.decryptionOps / result.decryptionTime * 1000).toFixed(2)} ops/s)`);
  }
}

export function rsaPublicKeyToPem(n: Uint8Array, e: Uint8Array): string {
  const rsaPublicKey = {
    modulus: Buffer.from(n).toString('base64'),
    exponent: Buffer.from(e).toString('base64')
  };

  const asn1 = `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${rsaPublicKey.modulus}AgMBAAE=`;
  const der = Buffer.from(asn1, 'base64');
  const pem = [
    '-----BEGIN PUBLIC KEY-----',
    ...der.toString('base64').match(/.{1,64}/g)!,
    '-----END PUBLIC KEY-----'
  ].join('\n');

  return pem;
}

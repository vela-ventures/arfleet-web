import { AESEncryptedContainer } from "./aes";
import { Sliceable, SliceParts } from "./slice";

export const RSA_KEY_LENGTH = 1024;

export class RSAContainer extends Sliceable {
  rsaKeyPair: CryptoKeyPair;
  inner: AESEncryptedContainer;
  underlyingByteLength: number;

  constructor(rsaKeyPair: CryptoKeyPair, inner: AESEncryptedContainer) {
    super();
    this.rsaKeyPair = rsaKeyPair;
    this.inner = inner;
    this.underlyingByteLength = -1;
  }

  async buildParts(): Promise<SliceParts> {
    this.underlyingByteLength = await this.inner.getByteLength();

    const parts: SliceParts = [];

    const magicString = "arf::rsa";
    parts.push([magicString.length, new TextEncoder().encode(magicString)]);
    parts.push([await this.getEncryptedByteLength(), this.encryptSlice.bind(this)]);

    return parts;
  }

  async getEncryptedByteLength(): Promise<number> {
    // 
  }

  async encryptSlice(start: number, end: number): Promise<Uint8Array> {
    
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
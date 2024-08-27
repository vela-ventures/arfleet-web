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

export async function run() {
    await init();

    console.log('RSA Test: init');

    const input = "Hello, RSA!";
    const bits = 2048;

    try {
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

        const n = base64UrlToBuffer(publicKey.n!);
        const e = base64UrlToBuffer(publicKey.e!);
        const d = base64UrlToBuffer(privateKey.d!);

        console.log('Public key (n):', bufferToHex(n));
        console.log('Public exponent (e):', bufferToHex(e));
        console.log('Private exponent (d):', bufferToHex(d));

        const encryptor = new RsaEncryptor();
        const buffer = new TextEncoder().encode(input);
        console.log('Original input:', input);
        console.log('Buffer:', bufferToHex(buffer));

        const encrypted = encryptor.private_encrypt(buffer, n, d);
        console.log('Encrypted output:', bufferToHex(new Uint8Array(encrypted)));

        const decrypted = encryptor.public_decrypt(new Uint8Array(encrypted), n, e);
        console.log('Decrypted output (raw):', bufferToHex(new Uint8Array(decrypted)));
        
        const decryptedText = new TextDecoder().decode(new Uint8Array(decrypted));
        console.log('Decrypted output (as UTF-8):', decryptedText);

        if (decryptedText === input) {
            console.log('Encryption and decryption successful!');
        } else {
            console.error('Decrypted text does not match original input.');
        }

    } catch (err) {
        console.error('RSA operation failed:', err);
    }
}

// Helper function to convert base64url to ArrayBuffer
function base64UrlToBuffer(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
}

// Run the test
run();
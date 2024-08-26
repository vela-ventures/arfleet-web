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
        const encryptor = new RsaEncryptor(bits);
        console.log('RSA Encryptor created');

        const buffer = new TextEncoder().encode(input);
        console.log('Original input:', input);
        console.log('Buffer:', buffer);

        // Encrypt
        const encrypted = encryptor.encrypt(buffer);
        console.log('Encrypted output:', bufferToHex(new Uint8Array(encrypted)));

        // Decrypt
        const decrypted = encryptor.decrypt(new Uint8Array(encrypted));
        const decryptedText = new TextDecoder().decode(new Uint8Array(decrypted));
        console.log('Decrypted output:', decryptedText);

        if (decryptedText === input) {
            console.log('Encryption and decryption successful!');
        } else {
            console.error('Decrypted text does not match original input.');
        }

        // Export keys (for demonstration purposes)
        const publicKey = encryptor.export_public_key();
        const privateKey = encryptor.export_private_key();
        console.log('Public key:', bufferToHex(new Uint8Array(publicKey)));
        console.log('Private key:', bufferToHex(new Uint8Array(privateKey)));

    } catch (err) {
        console.error('RSA operation failed:', err);
    }
}

// Run the test
run();
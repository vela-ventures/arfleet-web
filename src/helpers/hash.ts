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

        // Export keys
        const publicKey = encryptor.export_public_key();
        const privateKey = encryptor.export_private_key();
        console.log('Original Public key:', bufferToHex(new Uint8Array(publicKey)));
        console.log('Original Private key:', bufferToHex(new Uint8Array(privateKey)));

        // Swap keys
        const swappedEncryptor = new RsaEncryptor(bits);
        swappedEncryptor.set_swapped_keys(privateKey, publicKey);
        console.log('Keys swapped');

        // Encrypt with swapped keys (using private key for encryption)
        const encrypted = swappedEncryptor.encrypt(buffer);
        console.log('Encrypted output (with swapped keys):', bufferToHex(new Uint8Array(encrypted)));

        // Decrypt with swapped keys (using public key for decryption)
        const decrypted = swappedEncryptor.decrypt(new Uint8Array(encrypted));
        const decryptedText = new TextDecoder().decode(new Uint8Array(decrypted));
        console.log('Decrypted output (with swapped keys):', decryptedText);

        if (decryptedText === input) {
            console.log('Encryption and decryption with swapped keys successful!');
        } else {
            console.error('Decrypted text does not match original input.');
        }

    } catch (err) {
        console.error('RSA operation failed:', err);
    }
}

// Run the test
run();
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



///////////////////////


// async function generateKeyPair(): Promise<CryptoKeyPair> {
//     return await window.crypto.subtle.generateKey(
//         {
//             name: "RSA-OAEP",
//             modulusLength: 2048,
//             publicExponent: new Uint8Array([1, 0, 1]),
//             hash: "SHA-256",
//         },
//         true,
//         ["encrypt", "decrypt"]
//     );
// }

// async function exportRawPrivateKey(key: CryptoKey): Promise<Uint8Array> {
//     const exported = await window.crypto.subtle.exportKey("pkcs8", key);
//     return new Uint8Array(exported);
// }

// async function exportRawPublicKey(key: CryptoKey): Promise<Uint8Array> {
//     const exported = await window.crypto.subtle.exportKey("spki", key);
//     return new Uint8Array(exported);
// }

// export async function run() {
//     await init();

//     console.log('init');

//     const input = "test input";
//     const keyPair = await generateKeyPair();
//     const privateKeyRaw = await exportRawPrivateKey(keyPair.privateKey);
//     const publicKeyRaw = await exportRawPublicKey(keyPair.publicKey);

//     console.log('Private Key (raw):', bufferToHex(privateKeyRaw));
//     console.log('Public Key (raw):', bufferToHex(publicKeyRaw));

//     const encryptor = new RsaEncryptor(2048); // Assuming 2048 bits key size
//     const maxChunkSize = encryptor.max_chunk_size();
//     const buffer = new TextEncoder().encode(input);

//     console.log('Original input:', input);
//     console.log('Buffer:', buffer);
//     console.log('Max chunk size:', maxChunkSize);

//     if (buffer.length > maxChunkSize) {
//         console.warn(`Input is larger than the maximum chunk size (${maxChunkSize} bytes). It will be truncated.`);
//     }

//     try {
//         const chunk = buffer.slice(0, maxChunkSize);
//         // Pad the chunk with leading zeros if necessary
//         const paddedChunk = new Uint8Array(maxChunkSize);
//         paddedChunk.set(chunk, maxChunkSize - chunk.length);
        
//         const encrypted = await encryptor.encrypt_chunk(paddedChunk, privateKeyRaw);
//         console.log('Encrypted output:', bufferToHex(encrypted));

//         const decrypted = await encryptor.decrypt_chunk(encrypted, publicKeyRaw);
//         // Remove leading zeros from the decrypted result
//         const trimmedDecrypted = decrypted.slice(decrypted.findIndex(byte => byte !== 0));
//         const decryptedText = new TextDecoder().decode(trimmedDecrypted);
//         console.log('Decrypted output:', decryptedText);

//         if (decryptedText === input) {
//             console.log('Encryption and decryption successful!');
//         } else {
//             console.error('Decrypted text does not match original input.');
//         }
//     } catch (err) {
//         console.error('Encryption or decryption failed:', err);
//     }
// }

export function run() {
    console.log('run');
}

// <script>
// (async () => {
//   try {
//     console.log("Generating key pair...");
//     const keyPair = await crypto.subtle.generateKey(
//       {
//         name: "RSASSA-PKCS1-v1_5",
//         modulusLength: 2048,
//         publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
//         hash: { name: "SHA-256" }, // This is required by the API but won't be used for hashing
//       },
//       true,
//       ["sign", "verify"]
//     );

//     const data = new TextEncoder().encode("Hello World"); // Ensure data is <= 245 bytes

//     // Sign the data using the private key
//     const signature = await crypto.subtle.sign(
//       {
//         name: "RSASSA-PKCS1-v1_5",
//       },
//       keyPair.privateKey,
//       data
//     );

//     console.log(new Uint8Array(signature));

//     // Verify the signature using the public key
//     const isValid = await crypto.subtle.verify(
//       {
//         name: "RSASSA-PKCS1-v1_5",
//       },
//       keyPair.publicKey,
//       signature,
//       data
//     );

//     console.log("Signature valid:", isValid);
//   } catch (err) {
//     console.error("Signature error:", err);
//   }
// })();
// </script>
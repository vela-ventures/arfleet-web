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


async function generateRsaKeyPair(): Promise<{ publicKey: RsaPublicKey, privateKey: RsaPrivateKey }> {
    const bits = 2048;
    const privateKey = await RsaPrivateKey.new(bits);
    const publicKey = await RsaPublicKey.from(privateKey);
    return { publicKey, privateKey };
}

export async function run() {
    await init();

    console.log('init');

    const input = "test input";
    const bits = 2048;

    try {
        // Create a new RsaEncryptor instance
        const encryptor = new RsaEncryptor(bits);

        console.log('RSA Encryptor created');

        const buffer = new TextEncoder().encode(input);

        console.log('Original input:', input);
        console.log('Buffer:', buffer);

        // Encrypt the data
        const encrypted = encryptor.encrypt(buffer);
        console.log('Encrypted output:', bufferToHex(new Uint8Array(encrypted)));

        // Decrypt the data
        const decrypted = encryptor.decrypt(new Uint8Array(encrypted));
        const decryptedText = new TextDecoder().decode(new Uint8Array(decrypted));
        console.log('Decrypted output:', decryptedText);

        if (decryptedText === input) {
            console.log('Encryption and decryption successful!');
        } else {
            console.error('Decrypted text does not match original input.');
        }
    } catch (err) {
        console.error('Operation failed:', err);
    }
}

function jwkToPem(jwk: JsonWebKey, type: 'public' | 'private'): string {
    if (type === 'public') {
        const modulus = Buffer.from(jwk.n!, 'base64url');
        const exponent = Buffer.from(jwk.e!, 'base64url');

        const modulusHex = modulus.toString('hex');
        const exponentHex = exponent.toString('hex');

        const modulusLength = modulus.length * 8;
        const modulusLengthHex = modulusLength.toString(16).padStart(4, '0');

        const template = `30 81 ${modulusLengthHex} 02 81 ${modulusLengthHex} 00 ${modulusHex} 02 03 ${exponentHex}`;
        const der = Buffer.from(template.replace(/\s+/g, ''), 'hex');

        const pem = `-----BEGIN RSA PUBLIC KEY-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END RSA PUBLIC KEY-----\n`;
        return pem;
    } else {
        // For private key, we need all components
        const components = ['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'].map(k => Buffer.from(jwk[k as keyof JsonWebKey] as string, 'base64url'));
        const [n, e, d, p, q, dp, dq, qi] = components;

        const template = `30 82 04 a4 02 01 00 02 82 01 01 00 ${n.toString('hex')} 02 03 ${e.toString('hex')} 02 82 01 00 ${d.toString('hex')} 02 81 81 00 ${p.toString('hex')} 02 81 81 00 ${q.toString('hex')} 02 81 80 ${dp.toString('hex')} 02 81 80 ${dq.toString('hex')} 02 81 81 00 ${qi.toString('hex')}`;
        const der = Buffer.from(template.replace(/\s+/g, ''), 'hex');

        const pem = `-----BEGIN RSA PRIVATE KEY-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END RSA PRIVATE KEY-----\n`;
        return pem;
    }
}

run();

// <script>
// (async () => {
//   try {
//     console.log("Generating key pair...");
//     const keyPair = await crypto.subtle.generateKey(
//       {
//         name: "RSASSA-PKCS1-v1_5",
//         modulusLength: 2048,
//         publicExponent: new Uint8Array([1, 0, 1]),
//         hash: "SHA-256",
//       },
//       true,
//       ["encrypt", "decrypt"]
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
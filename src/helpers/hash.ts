import init, { Hasher, HashType, RsaEncryptor } from '../../wasm/pkg/wasm_helpers.js';
import { bufferToHex, hexToBuffer, stringToBuffer } from './buf.js';

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

export async function sha256hex(data: Uint8Array|string): Promise<string> {
    let dataToHash: Uint8Array;
    if (typeof data === 'string') {
        dataToHash = stringToBuffer(data);
    } else {
        dataToHash = data;
    }
    return bufferToHex(await sha256(dataToHash));
}

export async function sha384hex(data: Uint8Array|string): Promise<string> {
    let dataToHash: Uint8Array;
    if (typeof data === 'string') {
        dataToHash = stringToBuffer(data);
    } else {
        dataToHash = data;
    }
    return bufferToHex(await sha384(dataToHash));
}

export async function run() {
    // await runRsaPerformanceTest();
}
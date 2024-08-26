import init, { Hasher, HashType } from '../../wasm/pkg/wasm_helpers.js';
import { bufferToHex } from './buf.js';

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

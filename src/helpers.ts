import init, { Hasher, HashType } from '../wasm/pkg/wasm_helpers.js';
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

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
}

export async function privateHash(data: Uint8Array, salt: Uint8Array | string): Promise<Uint8Array> {
    const saltBuffer = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;
    const dataWithSalt = new Uint8Array(saltBuffer.length + data.length);
    dataWithSalt.set(saltBuffer);
    dataWithSalt.set(data, saltBuffer.length);

    // Create the hash using the active wallet
    return await globalThis.arweaveWallet.privateHash(dataWithSalt, { hashAlgorithm: "SHA-256" });
}

export async function arfleetPrivateHash(): Promise<Uint8Array> {
    // data is empty
    const data = new Uint8Array([]);
    const salt = "ArFleet-Proto-v1";
    return await privateHash(data, salt);
}

export interface DeepHashPointer {
    value: Uint8Array;
    role: 'file';
    dataLength: number;
}
export function isDeepHashPointer(data: any): data is DeepHashPointer {
    return typeof data === 'object' && data !== null && 'value' in data && 'role' in data && 'dataLength' in data;
}

export interface DataItem {
    owner: Uint8Array;
    target: Uint8Array;
    anchor: Uint8Array;
    tags: [string, string][];
    dataHash: DeepHashPointer;
    prepareToSign(): DeepHashChunk;
    extractHash(): Promise<DeepHashPointer>;
}

export async function createDataItemWithDataHash(
    dataHash: DeepHashPointer,
    owner: string, // todo encode properly
    target: Uint8Array,
    tags: [string, string][]
): Promise<DataItem> {
    const ownerBytes = new TextEncoder().encode(owner);

    const dataItem: DataItem = {
        owner: ownerBytes,
        target,
        anchor: crypto.getRandomValues(new Uint8Array(32)),
        tags,
        dataHash,
        prepareToSign() {
            return [
                stringToBuffer("dataitem"),
                stringToBuffer("1"),
                this.owner,
                this.target,
                this.anchor,
                this.tags.map(([key, value]) => [stringToBuffer(key), stringToBuffer(value)]),
                this.dataHash
            ];
        },
        async extractHash() {
            const pointer: DeepHashPointer = {
                value: await deepHash(this.prepareToSign()),
                role: 'file',
                dataLength: this.dataHash.value.length
            };
            return pointer;
        }
    };

    return dataItem;
}

// In TypeScript 3.7, could be written as a single type:
// type DeepHashChunk = Uint8Array | DeepHashChunk[] | DeepHashPointer;
type DeepHashChunk = Uint8Array | DeepHashChunks | DeepHashPointer;
interface DeepHashChunks extends Array<DeepHashChunk> {}

export default async function deepHash(
  data: DeepHashChunk
): Promise<Uint8Array> {
  if (Array.isArray(data)) {
    const tag = concatBuffers([
      stringToBuffer("list"),
      stringToBuffer(data.length.toString())
    ]);

    return await deepHashChunks(
      data,
      await sha384(tag)
    );
  }

  if (isDeepHashPointer(data)) {
    // trust the value, pass directly
    return data.value;
  } else {

  }

  const isPointer = isDeepHashPointer(data);

  const tag = concatBuffers([
    stringToBuffer("blob"),
    stringToBuffer(isPointer ? (data as DeepHashPointer).dataLength.toString() : data.byteLength.toString())
  ]);

  const taggedHash = concatBuffers([
    await sha384(tag),
    await sha384(data)
  ]);

  return await sha384(taggedHash);
}

export function bufferToString(buffer: Uint8Array | ArrayBuffer): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}
  
export function stringToBuffer(string: string): Uint8Array {
    return new TextEncoder().encode(string);
}
  
async function deepHashChunks(
  chunks: DeepHashChunks,
  acc: Uint8Array
): Promise<Uint8Array> {
  if (chunks.length < 1) {
    return acc;
  }

  const hashPair = concatBuffers([
    acc,
    await deepHash(chunks[0])
  ]);
  const newAcc = await sha384(hashPair);
  return await deepHashChunks(chunks.slice(1), newAcc);
}

export function concatBuffers(
    buffers: Uint8Array[] | ArrayBuffer[]
): Uint8Array {
    let total_length = 0;
  
    for (let i = 0; i < buffers.length; i++) {
      total_length += buffers[i].byteLength;
    }
  
    let temp = new Uint8Array(total_length);
    let offset = 0;
  
    temp.set(new Uint8Array(buffers[0]), offset);
    offset += buffers[0].byteLength;
  
    for (let i = 1; i < buffers.length; i++) {
      temp.set(new Uint8Array(buffers[i]), offset);
      offset += buffers[i].byteLength;
    }
  
    return temp;
}
  
/* tslint:disable */
/* eslint-disable */
/**
*/
export enum HashType {
  SHA256 = 0,
  SHA384 = 1,
}
/**
*/
export class Hasher {
  free(): void;
/**
* @param {HashType} hash_type
*/
  constructor(hash_type: HashType);
/**
* @param {Uint8Array} data
*/
  update(data: Uint8Array): void;
/**
* @returns {Uint8Array}
*/
  finalize(): Uint8Array;
}
/**
*/
export class RsaEncryptor {
  free(): void;
/**
*/
  constructor();
/**
* @param {Uint8Array} data
* @param {Uint8Array} n
* @param {Uint8Array} d
* @returns {Uint8Array}
*/
  private_encrypt(data: Uint8Array, n: Uint8Array, d: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} encrypted_data
* @param {Uint8Array} n
* @param {Uint8Array} e
* @returns {Uint8Array}
*/
  public_decrypt(encrypted_data: Uint8Array, n: Uint8Array, e: Uint8Array): Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_hasher_free: (a: number, b: number) => void;
  readonly hasher_new: (a: number) => number;
  readonly hasher_update: (a: number, b: number, c: number) => void;
  readonly hasher_finalize: (a: number, b: number) => void;
  readonly __wbg_rsaencryptor_free: (a: number, b: number) => void;
  readonly rsaencryptor_new: () => number;
  readonly rsaencryptor_private_encrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly rsaencryptor_public_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

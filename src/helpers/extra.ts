import { b64UrlToBuffer, longTo8ByteArray } from './encodeUtils.js';

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

export function downloadUint8ArrayAsFile(data: Uint8Array, fileName: string, mimeType: string = 'application/octet-stream') {
  // Create a Blob from the Uint8Array
  const blob = new Blob([data], { type: mimeType });

  // Generate a URL for the Blob
  const url = window.URL.createObjectURL(blob);

  // Create a temporary anchor element
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;

  // Append the anchor to the body (required for Firefox)
  document.body.appendChild(link);

  // Trigger a click on the anchor element
  link.click();

  // Clean up
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
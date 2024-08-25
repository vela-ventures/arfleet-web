export async function sha256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function privateHash(data: Uint8Array, salt: Uint8Array | string): Promise<Uint8Array> {
    const saltBuffer = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;
    const dataWithSalt = new Uint8Array(saltBuffer.length + data.length);
    dataWithSalt.set(saltBuffer);
    dataWithSalt.set(data, saltBuffer.length);

    // Create the hash using the active wallet
    return await globalThis.arweaveWallet.privateHash(dataWithSalt, { hashAlgorithm: "SHA-256" });
}
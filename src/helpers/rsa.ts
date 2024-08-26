export async function generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 1024,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    return keyPair;
}

export async function experiment() {
    console.log('experiment2')
    const keyPair = await generateRSAKeyPair();
    console.log('keyPair', keyPair)
    const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    console.log({
        publicKey: new Uint8Array(publicKey),
        privateKey: new Uint8Array(privateKey)
    });
}
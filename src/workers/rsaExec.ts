im

export async function rsaEncrypt(data: Uint8Array, key: RsaKey, encryptor: RsaEncryptor): Promise<Uint8Array> {
    const maxSize = key.bits / 8 - RSA_PADDING;
    if (data.length > maxSize) {
      throw new Error(`Data is too long: ${data.length} bytes, maximum is ${maxSize} bytes`);
    }
  
    if (data.byteLength !== maxSize) {
      throw new Error(`Data is not the correct length: ${data.byteLength} bytes, expected ${maxSize} bytes`);
    }
    const paddedData = padLeft(data, key.bits / 8);
  
    // log(`RSA Encrypting data (${paddedData.length} bytes): ${bufferToHex(paddedData)}`);
    const encrypted = new Uint8Array(encryptor.private_encrypt(paddedData, key.n, key.d));
    // log(`RSA Encrypted result (${encrypted.length} bytes): ${bufferToHex(encrypted)}`);
    return encrypted;
}

function padLeft(data: Uint8Array, targetLength: number): Uint8Array {
  if (data.length > targetLength) {
    throw new Error("Data is too long: " + data.length + " bytes, target length is " + targetLength + " bytes, and we need -PADDING");
  }
  const padded = new Uint8Array(targetLength);
  padded.set(data, targetLength - data.length);
  return padded;
}


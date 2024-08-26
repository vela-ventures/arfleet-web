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

export function bufferToString(buffer: Uint8Array | ArrayBuffer): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}
  
export function stringToBuffer(string: string): Uint8Array {
    return new TextEncoder().encode(string);
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


export function byteArrayToLong(byteArray: Uint8Array): number {
  let value = 0;
  for (let i = byteArray.length - 1; i >= 0; i--) {
    value = value * 256 + byteArray[i];
  }
  return value;
}

export function shortTo2ByteArray(long: number): Uint8Array {
  if (long > (2 ^ (32 - 1))) throw new Error('Short too long');
  // we want to represent the input as a 8-bytes array
  const byteArray = [0, 0];

  for (let index = 0; index < byteArray.length; index++) {
    const byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }

  return Uint8Array.from(byteArray);
}

export function longTo8ByteArray(long: number): Uint8Array {
  // we want to represent the input as a 8-bytes array
  const byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let index = 0; index < byteArray.length; index++) {
    const byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }

  return Uint8Array.from(byteArray);
}
import { rsaEncrypt, rsaDecrypt, RsaKey, RsaEncryptor } from '../helpers/rsa';

let encryptor: RsaEncryptor | null = null;

self.onmessage = async (event) => {
  const { action, data, key } = event.data;

  if (!encryptor) {
    encryptor = new RsaEncryptor();
  }

  switch (action) {
    case 'encrypt':
      try {
        const encryptedData = await rsaEncrypt(data, key, encryptor);
        self.postMessage({ action: 'encrypt', result: encryptedData });
      } catch (error) {
        self.postMessage({ action: 'encrypt', error: error.message });
      }
      break;
    case 'decrypt':
      try {
        const decryptedData = await rsaDecrypt(data, key, encryptor);
        self.postMessage({ action: 'decrypt', result: decryptedData });
      } catch (error) {
        self.postMessage({ action: 'decrypt', error: error.message });
      }
      break;
    default:
      self.postMessage({ error: 'Unknown action' });
  }
};
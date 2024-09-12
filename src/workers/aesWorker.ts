import { encryptAes, decryptAes } from '../helpers/aes';

self.onmessage = async (event) => {
  const { action, data, key, iv, isLastChunk } = event.data;

  switch (action) {
    case 'encrypt':
      try {
        const encryptedData = await encryptAes(data, key, iv, isLastChunk);
        self.postMessage({ action: 'encrypt', result: encryptedData });
      } catch (error) {
        self.postMessage({ action: 'encrypt', error: error.message });
      }
      break;
    case 'decrypt':
      try {
        const decryptedData = await decryptAes(data, key, iv);
        self.postMessage({ action: 'decrypt', result: decryptedData });
      } catch (error) {
        self.postMessage({ action: 'decrypt', error: error.message });
      }
      break;
    default:
      self.postMessage({ error: 'Unknown action' });
  }
};
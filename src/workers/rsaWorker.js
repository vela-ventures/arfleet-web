// console.log('RSA Worker script loaded');

import init, { Hasher, HashType, RsaEncryptor } from '../../wasm/pkg/wasm_helpers.js';

let encryptor = null;

self.onmessage = async (event) => {
  const { action, data, key } = event.data;
  // console.log(`Received message with action: ${action}`);

  if (!encryptor) {
    // console.log('Initializing encryptor');
    await init();
    encryptor = new RsaEncryptor();
  }

  switch (action) {
    case 'encrypt':
      try {
        if (!encryptor) {
          throw new Error('RSA encryptor not initialized');
        }  

        const encryptedChunk = encryptor.private_encrypt(data, key.n, key.d);

        self.postMessage({ action: 'encrypt', result: encryptedChunk });
      } catch (error) {
        self.postMessage({ action: 'encrypt', error: error.message });
      }
      break;
    // case 'decrypt':
    //   console.log('Starting decryption');
    //   try {
    //     const decryptedData = await rsaDecrypt(data, key);
    //     self.postMessage({ action: 'decrypt', result: decryptedData });
    //   } catch (error) {
    //     self.postMessage({ action: 'decrypt', error: error.message });
    //   }
    //   break;
    default:
      console.warn(`Unknown action: ${action}`);
      self.postMessage({ error: 'Unknown action' });
  }
};
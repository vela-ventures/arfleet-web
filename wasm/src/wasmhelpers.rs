use wasm_bindgen::prelude::*;
use sha2::{Sha256, Sha384, Digest};
use rsa::{RsaPrivateKey, RsaPublicKey, Pkcs1v15Encrypt, BigUint};
use rsa::traits::{PublicKeyParts, PrivateKeyParts};
use rand::rngs::OsRng;
use web_sys::console;

#[wasm_bindgen]
pub enum HashType {
    SHA256,
    SHA384,
}

#[wasm_bindgen]
pub struct Hasher {
    hash_type: HashType,
    sha256: Option<Sha256>,
    sha384: Option<Sha384>,
}

#[wasm_bindgen]
impl Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new(hash_type: HashType) -> Hasher {
        match hash_type {
            HashType::SHA256 => Hasher {
                hash_type,
                sha256: Some(Sha256::new()),
                sha384: None,
            },
            HashType::SHA384 => Hasher {
                hash_type,
                sha256: None,
                sha384: Some(Sha384::new()),
            },
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        match self.hash_type {
            HashType::SHA256 => self.sha256.as_mut().unwrap().update(data),
            HashType::SHA384 => self.sha384.as_mut().unwrap().update(data),
        }
    }

    pub fn finalize(&mut self) -> Vec<u8> {
        match self.hash_type {
            HashType::SHA256 => {
                let result = self.sha256.as_mut().unwrap().finalize_reset().to_vec();
                self.sha256 = Some(Sha256::new());
                result
            },
            HashType::SHA384 => {
                let result = self.sha384.as_mut().unwrap().finalize_reset().to_vec();
                self.sha384 = Some(Sha384::new());
                result
            },
        }
    }
}

// Define the RsaEncryptor struct with private and public key fields
#[wasm_bindgen]
pub struct RsaEncryptor {
    bits: usize,
    priv_key: RsaPrivateKey,
    pub_key: RsaPublicKey,
}

#[wasm_bindgen]
impl RsaEncryptor {
    // Initialize RSA Encryptor with keys
    #[wasm_bindgen(constructor)]
    pub fn new(bits: usize) -> Self {
        console::log_1(&format!("Creating RsaEncryptor with {} bits", bits).into());
        let mut rng = OsRng;
        let priv_key = RsaPrivateKey::new(&mut rng, bits).expect("failed to generate a key");
        let pub_key = RsaPublicKey::from(&priv_key);
        console::log_1(&"RsaEncryptor created successfully".into());
        RsaEncryptor {
            bits,
            priv_key,
            pub_key,
        }
    }

    // Encrypt data
    #[wasm_bindgen]
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>, JsValue> {
        console::log_1(&format!("Encrypting data of length: {}", data.len()).into());
        let m = BigUint::from_bytes_be(data);
        rsa::hazmat::rsa_encrypt(&self.pub_key, &m)
            .map(|c| c.to_bytes_be())
            .map_err(|e| JsValue::from_str(&format!("Encryption failed: {}", e)))
    }

    // Decrypt data
    #[wasm_bindgen]
    pub fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>, JsValue> {
        console::log_1(&format!("Decrypting data of length: {}", encrypted_data.len()).into());
        let c = BigUint::from_bytes_be(encrypted_data);
        rsa::hazmat::rsa_decrypt(None::<&mut OsRng>, &self.priv_key, &c)
            .map(|m| m.to_bytes_be())
            .map_err(|e| JsValue::from_str(&format!("Decryption failed: {}", e)))
    }

    #[wasm_bindgen]
    pub fn export_public_key(&self) -> Vec<u8> {
        self.pub_key.n().to_bytes_be()
    }

    #[wasm_bindgen]
    pub fn export_private_key(&self) -> Vec<u8> {
        self.priv_key.d().to_bytes_be()
    }
}
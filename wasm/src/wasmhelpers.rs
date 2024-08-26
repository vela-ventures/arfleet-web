use wasm_bindgen::prelude::*;
use sha2::{Sha256, Sha384, Digest};
use rsa::RsaPrivateKey;
use rsa::hazmat::rsa_encrypt;
use pkcs8::DecodePrivateKey;
use num_bigint_dig::BigUint;

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

#[wasm_bindgen]
pub struct RsaEncryptor {
    bits: usize,
}

#[wasm_bindgen]
impl RsaEncryptor {
    #[wasm_bindgen(constructor)]
    pub fn new(bits: usize) -> RsaEncryptor {
        RsaEncryptor { bits }
    }

    pub fn encrypt_chunk(&self, chunk: &[u8], priv_key_raw: &[u8]) -> Result<Vec<u8>, JsValue> {
        let rsa = RsaPrivateKey::from_pkcs8_der(priv_key_raw)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse private key: {}", e)))?;

        let m = BigUint::from_bytes_be(chunk);
        
        // Use rsa_encrypt from the hazmat module for raw RSA encryption
        let c = rsa_encrypt(&rsa, &m)
            .map_err(|e| JsValue::from_str(&format!("Failed to encrypt: {}", e)))?;

        Ok(c.to_bytes_be())
    }

    pub fn max_chunk_size(&self) -> usize {
        self.bits / 8 - 1 // Subtract 1 to ensure the message is always smaller than the modulus
    }
}
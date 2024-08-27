use wasm_bindgen::prelude::*;
use sha2::{Sha256, Sha384, Digest};
use num_bigint::BigUint;
use web_sys::console;

// Enum to specify the type of hash function to use
#[wasm_bindgen]
pub enum HashType {
    SHA256,
    SHA384,
}

// Struct to handle hashing operations
#[wasm_bindgen]
pub struct Hasher {
    hash_type: HashType,
    sha256: Option<Sha256>,
    sha384: Option<Sha384>,
}

#[wasm_bindgen]
impl Hasher {
    // Constructor for the Hasher
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

    // Update the hasher with new data
    pub fn update(&mut self, data: &[u8]) {
        match self.hash_type {
            HashType::SHA256 => self.sha256.as_mut().unwrap().update(data),
            HashType::SHA384 => self.sha384.as_mut().unwrap().update(data),
        }
    }

    // Finalize the hash and reset the hasher
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

// Struct to handle RSA encryption operations
#[wasm_bindgen]
pub struct RsaEncryptor;

#[wasm_bindgen]
impl RsaEncryptor {
    // Initialize RSA Encryptor with keys
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        RsaEncryptor
    }

    // Note: we're using private for encryption, just like in node.js/openssl encryptPrivate
    // Note: there is no padding, which is by design
    #[wasm_bindgen]
    pub fn private_encrypt(&self, data: &[u8], n: &[u8], d: &[u8]) -> Result<Vec<u8>, JsValue> {
        console::log_1(&format!("Private encrypting data of length: {}", data.len()).into());
        
        let m = BigUint::from_bytes_be(data);
        console::log_1(&format!("m: {}", m).into());
        
        let n = BigUint::from_bytes_be(n);
        if n == BigUint::from(0u32) {
            return Err(JsValue::from_str("Invalid modulus (n): cannot be zero"));
        }
        console::log_1(&format!("n: {}", n).into());
        
        let d = BigUint::from_bytes_be(d);
        if d == BigUint::from(0u32) {
            return Err(JsValue::from_str("Invalid private exponent (d): cannot be zero"));
        }
        console::log_1(&format!("d: {}", d).into());
        
        let s = m.modpow(&d, &n);
        console::log_1(&format!("s: {}", s).into());
        
        let mut result = s.to_bytes_be();
        let n_len = n.to_bytes_be().len();
        // Pad the result with leading zeros if necessary
        while result.len() < n_len {
            result.insert(0, 0);
        }
        
        Ok(result)
    }

    // Note: we're using public for decryption, just like in node.js/openssl decryptPublic
    // Note: there is no padding, which is by design
    #[wasm_bindgen]
    pub fn public_decrypt(&self, encrypted_data: &[u8], n: &[u8], e: &[u8]) -> Result<Vec<u8>, JsValue> {
        console::log_1(&format!("Public decrypting data of length: {}", encrypted_data.len()).into());
        
        let s = BigUint::from_bytes_be(encrypted_data);
        console::log_1(&format!("s: {}", s).into());
        
        let n = BigUint::from_bytes_be(n);
        console::log_1(&format!("n: {}", n).into());
        
        let e = BigUint::from_bytes_be(e);
        console::log_1(&format!("e: {}", e).into());
        
        let m = s.modpow(&e, &n);
        console::log_1(&format!("m: {}", m).into());
        
        let mut result = m.to_bytes_be();
        let n_len = n.to_bytes_be().len();
        // Pad the result with leading zeros if necessary
        while result.len() < n_len - 1 {  // Note the -1 here
            result.insert(0, 0);
        }
        
        Ok(result)
    }
}
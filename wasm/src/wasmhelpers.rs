use wasm_bindgen::prelude::*;
use sha2::{Sha256, Sha384, Digest};

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
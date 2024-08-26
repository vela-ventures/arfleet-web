export interface FileMetadata {
    name: string;
    size: number;
    path: string;
    chunkHashes: string[];
    rollingSha384: string;
  }
  
  export interface Placement {
    id: string;
    assignmentId: string;
    provider: string;
    status: 'created' | 'transferring' | 'verifying' | 'completed' | 'error';
    progress: number;
    rsaKeyPair: CryptoKeyPair;
  }
  
  export interface StorageAssignment {
    id: string;
    files: FileMetadata[];
    rawFiles: File[];
    status: 'created' | 'chunking' | 'uploading' | 'completed' | 'error';
    placements: Placement[];
    progress: number;
  }
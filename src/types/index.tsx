import { AESEncryptedContainer } from "@/helpers/aes";
import { DataItem } from "@/helpers/dataitemmod";
import { PlacementBlob } from "@/helpers/placementBlob";

export interface FileMetadata {
    name: string;
    size: number;
    path: string;
    chunkHashes: string[];
    rollingSha384: string;
    dataItem: DataItem;
    encryptedDataItem: DataItem;
    aesContainer: AESEncryptedContainer;
  }
  
  export interface Placement {
    id: string;
    assignment: StorageAssignment;
    assignmentId: string;
    provider: string;
    status: 'created' | 'transferring' | 'verifying' | 'completed' | 'error';
    progress: number;
    rsaKeyPair: CryptoKeyPair;
    placementBlob: PlacementBlob;
    chunks?: { [chunkIndex: number]: string };
  }
  
  export interface StorageAssignment {
    id: string;
    files: FileMetadata[];
    rawFiles: File[];
    status: 'created' | 'chunking' | 'uploading' | 'completed' | 'error';
    placements: Placement[];
    progress: number;
  }
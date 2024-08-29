import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Buffer } from 'buffer';
import { makeHasher, HashType, sha256, sha256hex, sha384hex } from '../helpers/hash';
import { createDataItemWithDataHash, createDataItemWithBuffer, createDataItemWithSliceable, DataItemFactory } from '../helpers/dataitemmod';
import { DeepHashPointer } from '../helpers/deephashmod';
import { concatBuffers, stringToBuffer } from '../helpers/buf';
import { b64UrlToBuffer, bufferTob64Url, stringToB64Url } from '../helpers/encodeUtils';
import { createDataItemSigner } from "@permaweb/aoconnect";
import { bufferToHex } from '../helpers/buf';
// import { experiment } from '../helpers/rsa';
import { run } from '../helpers/hash';
import { generateRSAKeyPair, keyPairToRsaKey, RSAContainer } from '../helpers/rsa';
import { arfleetPrivateHash, createSalt, encKeyFromMasterKeyAndSalt } from '../helpers/encrypt';
import { readFileChunk } from '../helpers/buf';
import { DataItem } from '../helpers/dataitemmod';
import { Sliceable, SliceParts } from '../helpers/sliceable';
import { AES_IV_BYTE_LENGTH, AESEncryptedContainer } from '@/helpers/aes';
import { createFolder, Folder } from '@/helpers/folder';
import { PlacementBlob } from '@/helpers/placementBlob';
import {produce} from 'immer';
import { AODB } from '../helpers/aodb';
import { ARFLEET_VERSION } from '@/helpers/version';
import { rsaPublicKeyToPem } from '../helpers/rsa';
import { Passthrough } from '@/helpers/passthrough';
import { PassthroughAES } from '@/helpers/passthroughAES';

const CHUNK_SIZE = 8192;
const PROVIDERS = ['http://localhost:8330', 'http://localhost:8331', 'http://localhost:8332'];

type DataItemSigner = ReturnType<typeof createDataItemSigner>;

export class FileMetadata {
  name: string;
  size: number;
  path: string;
  // chunkHashes: string[];
  // rollingSha384: string;
  dataItem: DataItem | null;
  encryptedDataItem: DataItem | null;
  aesContainer: AESEncryptedContainer | null;
  chunkHashes: Record<number, string>;

  constructor(file: File | FileMetadata) {
    if (file instanceof File) {
      this.name = file.name;
      this.size = file.size;
      this.path = (file as any).path || file.webkitRelativePath || file.name;
      this.chunkHashes = {};
    } else {
      Object.assign(this, file);
    }
    this.dataItem = null;
    this.encryptedDataItem = null;
    this.aesContainer = null;
  }

  serialize() {
    return {
      name: this.name,
      size: this.size,
      path: this.path,
      chunkHashes: this.chunkHashes,
    };
  }

  static unserialize(data: any): FileMetadata {
    const file = new FileMetadata(new File([], data.name));
    Object.assign(file, data);
    file.chunkHashes = data.chunkHashes || {};
    return file;
  }
}

export class Placement {
  id: string;
  assignmentId: string;
  provider: string;
  status: 'created' | 'transferring' | 'verifying' | 'completed' | 'error';
  progress: number;
  rsaKeyPair: CryptoKeyPair | null;
  placementBlob: PlacementBlob | null;
  chunks?: { [chunkIndex: number]: string };
  assignment: StorageAssignment | null;
  rsaContainer: RSAContainer | null;

  constructor(data: Partial<Placement>) {
    // initial values
    this.id = '';
    this.assignmentId = '';
    this.provider = '';
    this.status = 'created';
    this.progress = 0;
    this.rsaKeyPair = null;
    this.placementBlob = null;
    this.assignment = null;
    this.rsaContainer = null;

    Object.assign(this, data);
  }

  serialize() {
    return {
      id: this.id,
      assignmentId: this.assignmentId,
      provider: this.provider,
      status: this.status,
      progress: this.progress,
      chunks: this.chunks,
    };
  }

  static unserialize(data: any): Placement {
    return new Placement(data);
  }
}

export class StorageAssignment {
  id: string;
  files: FileMetadata[];
  rawFiles: File[];
  status: 'created' | 'chunking' | 'uploading' | 'completed' | 'error';
  placements: Placement[];
  progress: number;
  dataItemFactory: DataItemFactory | null;
  folder: Folder | null;
  encryptedManifestDataItemId: string | null;
  walletSigner: WalletSigner | null;

  constructor(data: Partial<StorageAssignment>) {
    // initial values
    this.id = '';
    this.files = [];
    this.rawFiles = [];
    this.status = 'created';
    this.placements = [];
    this.progress = 0;
    this.dataItemFactory = null;
    this.folder = null;
    this.encryptedManifestDataItemId = data.encryptedManifestDataItemId || null;
    this.walletSigner = null;

    Object.assign(this, data);
    this.files = (this.files || []).map(f => f instanceof FileMetadata ? f : new FileMetadata(f));
    this.placements = (this.placements || []).map(p => p instanceof Placement ? p : new Placement(p));
  }

  serialize() {
    return {
      id: this.id,
      files: this.files.map(file => file.serialize()),
      status: this.status,
      placements: this.placements.map(placement => {
        if (placement instanceof Placement) {
          return placement.serialize();
        } else {
          console.error('Invalid placement:', placement);
          return null;
        }
      }).filter(Boolean),
      encryptedManifestDataItemId: this.encryptedManifestDataItemId,
      progress: this.progress,
    };
  }

  static unserialize(data: any): StorageAssignment {
    return new StorageAssignment({
      ...data,
      files: data.files.map(FileMetadata.unserialize),
      placements: data.placements.map(Placement.unserialize),
    });
  }
}

interface ArFleetContextType {
  assignments: StorageAssignment[];
  selectedAssignment: StorageAssignment | null;
  setSelectedAssignment: (assignment: StorageAssignment | null) => void;
  onDrop: (acceptedFiles: File[]) => void;
  processPlacementQueue: () => Promise<void>;
  address: string | null;
  wallet: any | null;
  signer: DataItemSigner | null;
  arConnected: boolean;
  connectWallet: () => Promise<void>;
  fetchFromArweave: (placementId: string) => Promise<any>;
  devMode: boolean;
  resetAODB: () => Promise<void>;
}

const ArFleetContext = createContext<ArFleetContextType | undefined>(undefined);

export const useArFleet = () => {
  const context = useContext(ArFleetContext);
  if (!context) {
    throw new Error('useArFleet must be used within an ArFleetProvider');
  }
  return context;
};

class PlacementQueue {
  placementId: string;
  assignmentId: string;
  provider: string;
  processing: boolean;
  placement: Placement;

  finalChunks: [];

  curFileIdx: number;

  constructor(placement: Placement) {
    this.placementId = placement.id;
    this.assignmentId = placement.assignmentId;
    this.provider = placement.provider;
    this.placement = placement;

    this.processing = false;

    this.finalChunks = [];
    this.curFileIdx = 0;
  }

  poke() {
    if (this.processing) return;
    this.processing = true;
    const moreWork = this.processNext(); // todo: try catch here
    if (moreWork) {
      setTimeout(this.poke, 0);
    }
  }

  processNext(): boolean {
    if (this.curFileIdx >= this.placement.assignment.rawFiles.length) {
      // we are done
      // todo: update placement status
      // todo: do path manifests etc
      return false;
    }
    
    const curFile = this.placement.assignment.files[this.curFileIdx];
    const curRawFile = this.placement.assignment.rawFiles[this.curFileIdx];

    // Let's read the first KB
    const encContainer = curFile.encContainer;
  }
}

class PlacementQueues {
  private queues: { [key: string]: PlacementQueue };

  constructor() {
    this.queues = {};
  }

  pokeAll() {
    for (const queue of Object.values(this.queues)) {
      queue.poke();
    }
  }

  add(placement: Placement) {
    if (this.queues[placement.id]) {
      return;
    }
    this.queues[placement.id] = new PlacementQueue(placement);
  }
}

// Wrapper because you can't store a function in react state
class WalletSigner {
  signer: Function;
  constructor(signer: Function) {
    this.signer = signer;
  }
}

export const ArFleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assignments, setAssignments] = useState<StorageAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<StorageAssignment | null>(null);
  const [assignmentQueue, setAssignmentQueue] = useState<string[]>([]);
  const placementQueueRef = useRef<Placement[]>([]);
  const processingPlacement = useRef<boolean>(false);

  const placementQueuesRef = useRef<PlacementQueues>(new PlacementQueues());

  const processPlacementRef = useRef<(placement: Placement) => Promise<void>>();
  const checkProviderReadyRef = useRef<(placement: Placement) => Promise<string>>();
  const transferChunksRef = useRef<(placement: Placement, assignment: StorageAssignment) => Promise<Placement['status']>>();
  const verifyStorageRef = useRef<(placement: Placement, assignment: StorageAssignment) => Promise<void>>();

  const [arConnected, setArConnected] = useState(false);
  const [wallet, setWallet] = useState<any | null>(null);
  const [walletSigner, setWalletSigner] = useState<WalletSigner | null>(null);
  const [signer, setSigner] = useState<DataItemSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [pubKeyB64, setPubKeyB64] = useState<string | null>(null);
  const [pubKey, setPubKey] = useState<ArrayBuffer | null>(null);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);

  const [aodb, setAodb] = useState<AODB | null>(null);

  const [devMode] = useState<boolean>(true); // or false, depending on your preference

  const resetAODB = useCallback(async () => {
    if (aodb) {
      await aodb.reset();
      setAssignments([]);
      console.log('AODB reset successfully');
    }
  }, [aodb]);

  useEffect(() => {
    const initAODB = async () => {
      const aodbInstance = new AODB();
      await aodbInstance.init();
      setAodb(aodbInstance);

      const allAssignmentIds = aodbInstance.get('allAssignments');
      let parsedAssignmentIds: string[];

      if (typeof allAssignmentIds === 'string') {
        try {
          parsedAssignmentIds = JSON.parse(allAssignmentIds);
        } catch (error) {
          console.error('Failed to parse allAssignments:', error);
          parsedAssignmentIds = [];
        }
      } else if (Array.isArray(allAssignmentIds)) {
        parsedAssignmentIds = allAssignmentIds;
      } else {
        console.error('Invalid allAssignments data:', allAssignmentIds);
        parsedAssignmentIds = [];
      }

      if (Array.isArray(parsedAssignmentIds)) {
        const loadedAssignments = await Promise.all(parsedAssignmentIds.map(async (assignmentId: string) => {
          const assignmentData = aodbInstance.get(`assignment:${assignmentId}`);
          if (assignmentData) {
            let parsedAssignmentData;
            if (typeof assignmentData === 'string') {
              try {
                parsedAssignmentData = JSON.parse(assignmentData);
              } catch (error) {
                console.error(`Failed to parse assignment data for ${assignmentId}:`, error);
                return null;
              }
            } else {
              parsedAssignmentData = assignmentData;
            }
            
            const assignment = StorageAssignment.unserialize(parsedAssignmentData);
            assignment.placements = await Promise.all(assignment.placements.map(async (placementData) => {
              const placementFullData = aodbInstance.get(`placement:${placementData.id}`);
              let parsedPlacementData;
              if (typeof placementFullData === 'string') {
                try {
                  parsedPlacementData = JSON.parse(placementFullData);
                } catch (error) {
                  console.error(`Failed to parse placement data for ${placementData.id}:`, error);
                  return new Placement(placementData);
                }
              } else {
                parsedPlacementData = placementFullData;
              }
              return new Placement(parsedPlacementData || placementData);
            }));
            return assignment;
          }
          return null;
        }));

        const validAssignments = loadedAssignments.filter(Boolean) as StorageAssignment[];
        setAssignments(validAssignments);
      } else {
        console.error('parsedAssignmentIds is not an array:', parsedAssignmentIds);
      }

      aodbInstance.logContents();
    };

    initAODB();
  }, []);

  const connectWallet = useCallback(async () => {
    if (globalThis.arweaveWallet) {
      const wallet_ = globalThis.arweaveWallet;
      let signer_ = createDataItemSigner(wallet_);
      setSigner(signer_);
      setWallet(wallet_);
      console.log("wallet", wallet_);
      console.log("signMessage", wallet_.signMessage);
      setWalletSigner(new WalletSigner(wallet_.signMessage.bind(wallet_)));
      try {
        const address_ = await wallet_.getActiveAddress();
        setAddress(address_);

        const pubKeyB64_ = await wallet_.getActivePublicKey();
        setPubKeyB64(pubKeyB64_);
        const pubKey_ = b64UrlToBuffer(pubKeyB64_);
        setPubKey(pubKey_);
        // console.log('pubKey', pubKey_);

        const masterKey_ = await arfleetPrivateHash();
        setMasterKey(masterKey_);

        setArConnected(true);
      } catch (e) {
        console.error("Error connecting to wallet:", e);
        setArConnected(false);
      }
    } else {
      setArConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!arConnected) return;
    console.log('experiment')
    // if (globalThis.ranExp) return;
    // globalThis.ranExp = true;
    // runExp();
    // run();

    // const data = "hello";
    // const rsa = new RSAContainer()
  }, [arConnected]);

  useEffect(() => {
    connectWallet();

    globalThis.prevConnected = null;
    const interval = setInterval(async () => {
      const wallet_ = globalThis.arweaveWallet;
      let curConnected = false;
      if (wallet_) {
        try {
          const address_ = await wallet_.getActiveAddress();
          curConnected = !!address_;
        } catch (e) {
          curConnected = false;
        }
      }

      if (globalThis.prevConnected !== null && globalThis.prevConnected !== curConnected) {
        location.reload();
      } else {
        globalThis.prevConnected = curConnected;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connectWallet]);

  const updatePlacementStatus = useCallback((placementId: string, status: Placement['status']) => {
    setAssignments(prev => {
      const newAssignments = prev.map(a => {
        const updatedPlacements = a.placements.map(p => {
          if (p.id === placementId) {
            const updatedPlacement = new Placement({ ...p, status });
            aodb?.set(`placement:${placementId}`, updatedPlacement.serialize());
            return updatedPlacement;
          }
          return p instanceof Placement ? p : new Placement(p);
        });
        const allCompleted = updatedPlacements.every(p => p.status === 'completed');
        const newStatus = allCompleted ? 'completed' : a.status;
        
        const updatedAssignment = new StorageAssignment({
          ...a,
          placements: updatedPlacements,
          status: newStatus
        });
        aodb?.set(`assignment:${a.id}`, updatedAssignment.serialize());
        return updatedAssignment;
      });

      const allAssignmentIds = newAssignments.map(a => a.id);
      aodb?.set('allAssignments', allAssignmentIds);

      return newAssignments;
    });

    placementQueueRef.current = placementQueueRef.current.map(p => 
      p.id === placementId ? new Placement({ ...p, status }) : p
    );
  }, [aodb]);

  const updatePlacementProgress = useCallback((placementId: string, progress: number, chunkIndex: number, chunkHashHex: string) => {
    setAssignments(produce(draft => {
      for (const assignment of draft) {
        const placement = assignment.placements.find(p => p.id === placementId);
        if (placement) {
          placement.progress = progress;
          if (!placement.chunks) {
            placement.chunks = {};
          }
          placement.chunks[chunkIndex] = chunkHashHex;

          // Update the corresponding file's chunkHashes
          // const fileMetaData = assignment.folder?.chunkIdxToFile.get(chunkIndex)?.[0];
          // console.log('fileMetaData', fileMetaData)
          // if (fileMetaData) {
          //   console.log('assignment', assignment)
          //   console.log('assignment.files', assignment.files)

          //   const file = assignment.files.find(f => f.path === fileMetaData.path);
          //   console.log('file', file)
          //   if (file) {
          //     if (!file.chunkHashes) {
          //       file.chunkHashes = {};
          //     }
          //     file.chunkHashes[chunkIndex] = chunkHashHex;
          //   }
          //   console.log('********')
          //   console.log('chunkHashes', file?.chunkHashes);
          //   console.log('chunkIdxToFile', assignment.folder?.chunkIdxToFile);
          // }


          // Create a new StorageAssignment instance to ensure we have the serialize method
          const updatedAssignment = new StorageAssignment({
            ...assignment,
            placements: assignment.placements.map(p => new Placement(p)),
            files: assignment.files.map(f => new FileMetadata(f))
          });

          // Persist the updated assignment to AODB
          aodb?.set(`assignment:${assignment.id}`, updatedAssignment.serialize());
          break;
        }
      }
    }));
  }, [aodb]);

  const updateAssignmentProgress = useCallback((assignmentId: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id === assignmentId) {
        const totalProgress = a.placements.reduce((sum, p) => sum + p.progress, 0);
        const averageProgress = totalProgress / a.placements.length;
        return { ...a, progress: averageProgress };
      }
      return a;
    }));
  }, []);

  processPlacementRef.current = async (placement: Placement) => {
    const assignment = assignments.find(a => a.id === placement.assignmentId);
    if (!assignment) {
      console.error(`Assignment not found for placement ${placement.id}`);
      updatePlacementStatus(placement.id, 'error');
      return;
    }

    try {
      console.log(`Processing placement ${placement.id}, status: ${placement.status}`);
      let newStatus: Placement['status'] = placement.status;
      switch (placement.status) {
        case 'created':
          newStatus = await checkProviderReadyRef.current?.(placement) || placement.status;
          break;
        case 'transferring':
          newStatus = await transferChunksRef.current?.(placement, assignment) || placement.status;
          break;
        case 'verifying':
          newStatus = await verifyStorageRef.current?.(placement, assignment) || placement.status;
          break;
      }
      if (newStatus !== placement.status) {
        updatePlacementStatus(placement.id, newStatus);
      } else {
        console.log(`No status change for placement ${placement.id}`);
        placementQueueRef.current = placementQueueRef.current.filter(p => p.id !== placement.id);
      }
    } catch (error) {
      console.error(`Error processing placement ${placement.id}:`, error);
      updatePlacementStatus(placement.id, 'error');
    }
  };

  checkProviderReadyRef.current = async (placement: Placement) => {
    console.log(`Checking if provider is ready for placement ${placement.id}`);
    try {
      const response = await fetch(`${placement.provider}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placementId: placement.id })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`Provider ready for placement ${placement.id}`);
      updatePlacementStatus(placement.id, 'transferring');
      return 'transferring';
    } catch (error) {
      console.error(`Error checking provider ready for placement ${placement.id}:`, error);
      throw error;
    }
  };

  transferChunksRef.current = async (placement: Placement, assignment: StorageAssignment): Promise<Placement['status']> => {
    console.log(`Starting chunk transfer for placement ${placement.id}`);
    let uploadedChunks = 0;

    const placementBlob = placement.placementBlob;
    console.log('placement', placement)
    console.log('placementBlob', placementBlob)
    const placementBlobLength = await placementBlob.getByteLength();
    const chunkCount = await placementBlob.getChunkCount();

    // Initialize chunks object if it doesn't exist
    if (!placement.chunks) {
      placement.chunks = {};
    }

    console.log(`Uploading chunks for placement ${placement.id}`);
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, placementBlobLength);
      console.log('placementBlobLength', placementBlobLength)
      console.log('pb chunkCount', chunkCount)
      console.log('pb chunkIndex', chunkIndex)
      console.log('pb start', start)
      console.log('pb end', end)
      const chunk = await placementBlob.slice(start, end);
      
      try {
        const chunkHashHex = await uploadChunk(placement, chunk, chunkIndex);
        uploadedChunks++;
        updatePlacementProgress(placement.id, (uploadedChunks / chunkCount) * 100, chunkIndex, chunkHashHex);
        
        // Store the chunk hash in the placement.chunks object
        placement.chunks[chunkIndex] = chunkHashHex;
        
        console.log(`Uploaded chunk ${chunkIndex + 1}/${chunkCount} for placement ${placement.id}`);
      } catch (error) {
        console.error(`Error uploading chunk ${chunkIndex} for placement ${placement.id}:`, error);
        return 'error';
      }
    }

    // Update the placement in the assignments state
    setAssignments(prev => prev.map(a => {
      if (a.id === assignment.id) {
        return {
          ...a,
          placements: a.placements.map(p => 
            p.id === placement.id ? { ...p, chunks: placement.chunks } : p
          )
        };
      }
      return a;
    }));

    // post-transfer
    const encryptedManifestDataItemId = await assignment.folder!.encryptedManifestDataItem!.getDataItemId();
    
    // Create a new assignment object with the updated property
    const updatedAssignment = new StorageAssignment({
      ...assignment,
      encryptedManifestDataItemId: encryptedManifestDataItemId
    });

    // Update the assignments state with the new assignment object
    setAssignments(prev => prev.map(a => 
      a.id === updatedAssignment.id ? updatedAssignment : a
    ));

    console.log(`All chunks uploaded for placement ${placement.id}`);
    return 'verifying';
  };

  const uploadChunk = async (placement: Placement, chunk: Uint8Array, chunkIndex: number) => {
    const chunkHashHex = await sha256hex(chunk);

    // const rsaKey = await placement.rsaContainer!.getRsaKey();
    // const publicKeyPem = rsaPublicKeyToPem(rsaKey.n, rsaKey.e);

    const rsaKP = placement.rsaContainer!.rsaKeyPair;
    const publicKey = rsaKP.publicKey;
    const publicKeyPem = await crypto.subtle.exportKey('spki', publicKey);
    const publicKeyPemBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyPem)));
    const publicKeyPemString = `-----BEGIN PUBLIC KEY-----\n${publicKeyPemBase64}\n-----END PUBLIC KEY-----`;
    console.log('publicKeyPemString', publicKeyPemString);

    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'X-Placement-Id': placement.id,
      'X-Chunk-Index': chunkIndex.toString(),
      'X-Chunk-Hash': chunkHashHex,
      'X-RSA-Public-Key': stringToB64Url(publicKeyPemString)
    });

    const response = await fetch(`${placement.provider}/upload`, {
      method: 'POST',
      headers: headers,
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return chunkHashHex;
  };

  verifyStorageRef.current = async (placement: Placement, assignment: StorageAssignment) => {
    const metadata = {
      placementId: placement.id,
      chunks: placement.chunks || {},
    };
    console.log('CHUNKS:', metadata.chunks);
    console.log('FOLDER:', assignment.folder);
    console.log('FILES:', assignment.folder!.files);
    
    const filesAndChunks = [];
    for (let [idx, [file, inFileChunkIdx]] of assignment.folder!.chunkIdxToFile) {
      filesAndChunks.push({file, chunk: idx, inFileChunkIdx, hash: metadata.chunks[idx]});
    }
    const filesAndChunksGroupByFile = filesAndChunks.reduce<Record<string, {
      file: FileMetadata,
      chunks: Array<{chunk: number, inFileChunkIdx: number, hash: string}>
    }>>((acc, {file, chunk, inFileChunkIdx, hash}) => {
      if (!acc[file.path]) {
        acc[file.path] = { file, chunks: [] };
      }
      acc[file.path].chunks.push({chunk, inFileChunkIdx, hash});
      return acc;
    }, {});
    
    // // Sort chunks within each file and update FileMetadata with hashes
    // Object.values(filesAndChunksGroupByFile).forEach(({file, chunks}) => {
    //   chunks.sort((a, b) => a.inFileChunkIdx - b.inFileChunkIdx);
    //   file.chunkHashes = chunks.reduce((acc, c) => {
    //     acc[c.inFileChunkIdx] = c.hash;
    //     return acc;
    //   }, {} as Record<number, string>);
    // });

    // Update the assignment with the new file metadata
    setAssignments(prev => prev.map(a => {
      if (a.id === assignment.id) {
        return {
          ...a,
          files: a.files.map(f => {
            const updatedFile = filesAndChunksGroupByFile[f.path]?.file;
            return updatedFile || f;
          })
        };
      }
      return a;
    }));

    console.log({filesAndChunksGroupByFile})

    const response = await fetch(`${placement.provider}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Placement-Id': placement.id,
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.status === 'success') {
      updatePlacementStatus(placement.id, 'completed');
    } else {
      updatePlacementStatus(placement.id, 'error');
      console.error('Verification failed:', result.message);
    }
  };

  const processPlacementQueue = useCallback(async () => {
    if (processingPlacement.current) return;
    
    while (placementQueueRef.current.length > 0) {
      processingPlacement.current = true;
      const placement = placementQueueRef.current[0];
      
      if (placement.status !== 'completed' && placement.status !== 'error') {
        console.log(`Processing placement ${placement.id}, current status: ${placement.status}`);
        await processPlacementRef.current?.(placement);
        
        updateAssignmentProgress(placement.assignmentId);
      } else {
        placementQueueRef.current.shift();
      }
      
      processingPlacement.current = false;
    }
  }, [updatePlacementStatus, updateAssignmentProgress]);

  const processAssignment = async (assignment: StorageAssignment) => {
    setAssignments(prev => prev.map(a => 
      a.id === assignment.id ? { ...a, status: 'chunking' } : a
    ));

    const updatedFiles: FileMetadata[] = [];

    for (let i = 0; i < assignment.files.length; i++) {
      const file = assignment.files[i];
      const rawFile = assignment.rawFiles[i];
      // const chunkHashes: string[] = [];
      // const rollingHash = await makeHasher(HashType.SHA384);

      // const totalChunks = Math.ceil(rawFile.size / CHUNK_SIZE);
      // for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      //   const start = chunkIndex * CHUNK_SIZE;
      //   const end = Math.min(start + CHUNK_SIZE, rawFile.size);
      //   const chunk = await readFileChunk(rawFile, start, end);
      //   const chunkHash = await sha256hex(chunk);
      //   chunkHashes.push(chunkHash);
        
      //   // Update rolling hash with the current chunk
      //   await rollingHash.update(chunk);
      // }

      // const fileRollingSha384 = await rollingHash.finalize();
      // const pointer: DeepHashPointer = {
      //   value: fileRollingSha384,
      //   role: 'file',
      //   dataLength: rawFile.size,
      // };

      // create data item
      if (!address) throw new Error('Address not found');
      console.log('assignment.dataItemFactory', assignment.dataItemFactory);
      const dataItem = await assignment.dataItemFactory!.createDataItemWithRawFile(rawFile, /*tags*/[
        {name: "ArFleet-DataItem-Type", value: "File"},
      ], assignment.walletSigner);
      // const dataItemPrepareToSign = await dataItem.prepareToSign();

      // // sign data item
      // dataItem.signature = await wallet.signMessage(dataItemPrepareToSign, {
      //   hashAlgorithm: 'SHA-384',
      // })
      // console.log('dataItem', dataItem);

      // dataItem.rawFile = rawFile;

      // create encrypted container
      const salt = createSalt();
      if (!masterKey) throw new Error('Master key not found');
      const iv = createSalt(AES_IV_BYTE_LENGTH);
      const secretKey = await encKeyFromMasterKeyAndSalt(masterKey, salt);
      const aesContainer: AESEncryptedContainer = new PassthroughAES(
        dataItem,
        salt,
        secretKey,
        iv
      );

      // const encryptedDataItem = await assignment.dataItemFactory!.createDataItemWithSliceable(aesContainer, /*tags*/ [{name: "ArFleet-DataItem-Type", value: "AESContainer"}], assignment.walletSigner);

      // const folder = await createFolder();
      // const dataItem = await createDataItemWithBuffer(files[0], pubKeyB64 || '', /*target*/null, /*anchor*/null, /*tags*/[{name: 'Tag1', value: 'Value1'}, {name: 'Tag2', value: 'Value2'}]);
      // if (!masterKey) throw new Error('Master key not found');
      // const secretKey = await encKeyFromMasterKeyAndSalt(masterKey, salt);
      // const iv = createSalt(AES_IV_BYTE_LENGTH);
      // const aes = new AESEncryptedContainer(dataItem, salt, secretKey, iv);
      // const encryptedDataItem = await createDataItemWithAESContainer(aes, pubKeyB64 || '', /*target*/null, /*anchor*/null, /*tags*/[{name: 'Tag1', value: 'Value1'}, {name: 'Tag2', value: 'Value2'}]);
      // console.log('aes', aes);
      // const container = new RSAContainer(rsaKeyPair, encryptedDataItem);
      // console.log('container', container);

      // const rsaKeyPair = await generateRSAKeyPair();
      // const dataItemFactory = new DataItemFactory(
      //   /* owner */pubKeyB64!,
      //   /* target */bufferTob64Url(await sha256(stringToBuffer("empty-target"))), 
      //   /* root anchor */bufferTob64Url(await sha256(stringToBuffer(assignment.id))),
      //   /* tags */[
      //     {name: "ArFleet-Client", value: "Web"},
      //     {name: "ArFleet-Version", value: ARFLEET_VERSION},
      //   ],
      // );
      // const encryptedDataItemBin = await assignment.dataItemFactory!.createDataItemWithBuffer(new TextEncoder().encode("hello"), /*tags*/[], assignment.walletSigner);
      // const container = new RSAContainer(rsaKeyPair, encryptedDataItemBin);
      // const readContainer = await container.slice(0, await container.getByteLength());
      // const extract = await container.encryptSlice(0, await container.getEncryptedByteLength());
      // console.log('readContainer', Buffer.from(readContainer).toString('hex').match(/.{1,32}/g)?.join('\n'));
      // console.log('extract', Buffer.from(extract).toString('hex').match(/.{1,32}/g)?.join('\n'));

      // // send to server
      // const chunkHashHex = await sha256hex(readContainer);

      // const rsaKP = container.rsaKeyPair;
      // const publicKey = rsaKP.publicKey;
      // const publicKeyPem = await crypto.subtle.exportKey('spki', publicKey);
      // const publicKeyPemBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyPem)));
      // const publicKeyPemString = `-----BEGIN PUBLIC KEY-----\n${publicKeyPemBase64}\n-----END PUBLIC KEY-----`;
      // console.log('publicKeyPemString', publicKeyPemString);
  
      // const h = {
      //   'Content-Type': 'application/octet-stream',
      //   'X-Placement-Id': /*placement.id,*/ await sha256hex(new Date().toISOString()),
      //   'X-Chunk-Index': '0',
      //   'X-Chunk-Hash': chunkHashHex,
      //   'X-RSA-Public-Key': stringToB64Url(publicKeyPemString)
      // };
      // console.log('h', h);
      // const headers = new Headers(h);
  
      // const response = await fetch(PROVIDERS[0] + '/upload', {
      //   method: 'POST',
      //   headers: headers,
      //   body: readContainer,
      // });
      // console.log('response', response);
  


      // const obj = container;
      // obj.downloadAsFile("test.obj");

      const fileMetadata = new FileMetadata(rawFile);
      // fileMetadata.chunkHashes = chunkHashes;
      // fileMetadata.rollingSha384 = bufferToHex(fileRollingSha384);
      if (fileMetadata.dataItem) throw new Error("Data item already set");
      fileMetadata.dataItem = dataItem;
      if (fileMetadata.encryptedDataItem) throw new Error("Encrypted data item already set");
      fileMetadata.aesContainer = aesContainer;
      // fileMetadata.encryptedDataItem = encryptedDataItem;
      if (fileMetadata.encryptedDataItem) throw new Error("Encrypted data item already set");
      fileMetadata.encryptedDataItem = dataItem; // todo: fix!
      updatedFiles.push(fileMetadata);

      // const dataItemBin = await dataItem?.exportBinaryHeader();
      // console.log({dataItemBin})
    }

    if (!masterKey) throw new Error('Master key not found');
    const folder = await createFolder(updatedFiles, assignment.dataItemFactory!, walletSigner, masterKey);

    const tmpId: string = (new Date()).getTime().toString();
    const assignmentHash = await sha256hex(new TextEncoder().encode(tmpId));
    const placements = await Promise.all(PROVIDERS.map(async provider => {
      const rsaKeyPair = await generateRSAKeyPair();

      const rsaContainer = new Passthrough(rsaKeyPair, folder);
      console.log('container', rsaContainer);

      const placementBlob = new PlacementBlob(rsaContainer);

      return new Placement({
        id: await sha256hex(`${assignmentHash}-${provider}-${Date.now()}`),
        assignmentId: assignmentHash,
        assignment: assignment,
        provider,
        status: 'created' as const,
        progress: 0,
        rsaKeyPair,
        rsaContainer,
        placementBlob,
      });
    }));

    setAssignments(produce(draft => {
      const assignmentToUpdate = draft.find(a => a.id === assignment.id);
      if (assignmentToUpdate) {
        assignmentToUpdate.files = updatedFiles;
        assignmentToUpdate.id = assignmentHash;
        assignmentToUpdate.folder = folder;
        assignmentToUpdate.status = 'uploading';
        assignmentToUpdate.placements = placements;
        assignmentToUpdate.progress = 0;
      }
    }));

    placementQueueRef.current.push(...placements);

    for (const placement of placements) {
      placementQueuesRef.current.add(placement);
    }

    console.log('Assignment processed:', assignmentHash);
    updatedFiles.forEach(async (file) => {
      console.log(`File: ${file.name}`);
      console.log(`Size: ${file.size}`);
      console.log(`Path: ${file.path}`);
      console.log(`Chunk hashes:`, file.chunkHashes);
      // console.log(`Rolling SHA-384:`, file.rollingSha384);
      console.log(`Data item:`, file.dataItem);
      console.log('---');
    });
  }; // end processAssignment

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    /// WARNING: This is a callback, it captures the state at the beginning.
    // If you need to use state, add it to dependencies at the end.
    const assignmentId = bufferTob64Url(await sha256(stringToBuffer(Date.now().toString())));

    if (!walletSigner) throw new Error('Wallet signer not found');

    // Create new assignment
    const newAssignment = new StorageAssignment({
      id: assignmentId,
      files: acceptedFiles.map(file => {
        const fullPath = (file as any).path || file.webkitRelativePath || file.name;
        return new FileMetadata({
          ...file,
          path: fullPath
        });
      }),
      rawFiles: acceptedFiles,
      status: 'created',
      placements: [],
      progress: 0,
      walletSigner: walletSigner,
      dataItemFactory: new DataItemFactory(
        /* owner */pubKeyB64!,
        /* target */bufferTob64Url(await sha256(stringToBuffer("empty-target"))), 
        /* root anchor */bufferTob64Url(await sha256(stringToBuffer(assignmentId))),
        /* tags */[
          {name: "ArFleet-Client", value: "Web"},
          {name: "ArFleet-Version", value: ARFLEET_VERSION},
        ],
      ),
    });
    setAssignments(prev => {
      const updatedAssignments = [...prev, newAssignment];
      aodb?.set(`assignment:${newAssignment.id}`, newAssignment.serialize());
      const allAssignmentIds = updatedAssignments.map(a => a.id);
      aodb?.set('allAssignments', allAssignmentIds);
      return updatedAssignments;
    });
    setAssignmentQueue(prev => [...prev, newAssignment.id]);
  }, [aodb, pubKeyB64, walletSigner]);

  useEffect(() => {
    const processNextAssignment = async () => {
      if (assignmentQueue.length === 0) return;

      const assignmentId = assignmentQueue[0];
      const assignment = assignments.find(a => a.id === assignmentId);

      if (assignment && assignment.status === 'created') {
        await processAssignment(assignment);
        setAssignmentQueue(prev => prev.filter(id => id !== assignmentId));
      }
    };

    processNextAssignment();
  }, [assignmentQueue, assignments]);

  useEffect(() => {
    processPlacementQueue();
  }, [processPlacementQueue, assignments]);

  const fetchFromArweave = useCallback(async (placementId: string) => {
    const placement = assignments.flatMap(a => a.placements).find(p => p.id === placementId);
    if (!placement || placement.status !== 'completed') {
      throw new Error('Placement not completed or not found');
    }

    // Implement the logic to fetch data from Arweave using the placement information
    // This is a placeholder and needs to be implemented based on your Arweave setup
    const arweaveData = await fetchDataFromArweave(placement);
    return arweaveData;
  }, [assignments]);

  const value = {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    onDrop,
    processPlacementQueue,
    address,
    wallet,
    signer,
    arConnected,
    connectWallet,
    fetchFromArweave,
    devMode,
    resetAODB,
  };

  return <ArFleetContext.Provider value={value}>{children}</ArFleetContext.Provider>;
};
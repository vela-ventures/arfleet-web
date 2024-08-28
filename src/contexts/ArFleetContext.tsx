import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { StorageAssignment, FileMetadata, Placement } from '../types';
import { Buffer } from 'buffer';
import { makeHasher, HashType, sha256, sha256hex, sha384hex } from '../helpers/hash';
import { createDataItemWithDataHash, createDataItemWithBuffer, createDataItemWithAESContainer } from '../helpers/dataitemmod';
import { DeepHashPointer } from '../helpers/deephashmod';
import { concatBuffers } from '../helpers/buf';
import { b64UrlToBuffer } from '../helpers/encodeUtils';
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
import { createFolder } from '@/helpers/folder';
import { PlacementBlob } from '@/helpers/placementBlob';
import {produce} from 'immer';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const PROVIDERS = ['http://localhost:8330', 'http://localhost:8331', 'http://localhost:8332'];

type DataItemSigner = ReturnType<typeof createDataItemSigner>;

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
  const [signer, setSigner] = useState<DataItemSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [pubKeyB64, setPubKeyB64] = useState<string | null>(null);
  const [pubKey, setPubKey] = useState<ArrayBuffer | null>(null);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);

  const createRandomFile = (text: string) => {
    const data = new Uint8Array(text.length * 1000000);
    for (let i = 0; i < 1000000; i++) {
      data.set(new TextEncoder().encode(text), i * text.length);
    }
    return data;
  }

  const runExp = async () => {
    // const rsaKeyPair = await generateRSAKeyPair();
    // console.log('rsaKeyPair', rsaKeyPair);
    // const files = [ createRandomFile("Hello, world!"), createRandomFile("ABC"), createRandomFile("1234567890") ];
    // // const folder = await createFolder();
    // const dataItem = await createDataItemWithBuffer(files[0], pubKeyB64 || '', /*target*/null, /*anchor*/null, /*tags*/[{name: 'Tag1', value: 'Value1'}, {name: 'Tag2', value: 'Value2'}]);
    // const salt = createSalt();
    // if (!masterKey) throw new Error('Master key not found');
    // const secretKey = await encKeyFromMasterKeyAndSalt(masterKey, salt);
    // const iv = createSalt(AES_IV_BYTE_LENGTH);
    // const aes = new AESEncryptedContainer(dataItem, salt, secretKey, iv);
    // const encryptedDataItem = await createDataItemWithAESContainer(aes, pubKeyB64 || '', /*target*/null, /*anchor*/null, /*tags*/[{name: 'Tag1', value: 'Value1'}, {name: 'Tag2', value: 'Value2'}]);
    // console.log('aes', aes);
    // const container = new RSAContainer(rsaKeyPair, encryptedDataItem);
    // console.log('container', container);

    // const obj = container;
    // obj.downloadAsFile("test.obj");
    // await obj.downloadAsFile("test.obj");

    // for(let i = 0; i < 2000; i++) {
    //   const ord = await obj.slice(i, i + 1);
    //   const ord_extracted = ord[0];
    //   const chr = String.fromCharCode(ord_extracted);
    //   console.log(i, ">ord_extracted<", ord_extracted, ">chr<", chr);

    //   if (typeof ord_extracted !== 'number') {
    //     break;
    //   }
    // }
    // console.log(await obj.getByteLength());
  }

  const connectWallet = useCallback(async () => {
    if (globalThis.arweaveWallet) {
      const wallet_ = globalThis.arweaveWallet;
      let signer_ = createDataItemSigner(wallet_);
      setSigner(signer_);
      setWallet(wallet_);

      try {
        const address_ = await wallet_.getActiveAddress();
        setAddress(address_);

        const pubKeyB64_ = await wallet_.getActivePublicKey();
        setPubKeyB64(pubKeyB64_);
        // console.log('pubKeyB64', pubKeyB64_);
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
    if (globalThis.ranExp) return;
    globalThis.ranExp = true;
    runExp();
    run();
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
    setAssignments(prev => prev.map(a => {
      const updatedPlacements = a.placements.map(p => p.id === placementId ? { ...p, status } : p);
      const allCompleted = updatedPlacements.every(p => p.status === 'completed');
      const newStatus = allCompleted ? 'completed' : a.status;
      return {
        ...a,
        placements: updatedPlacements,
        status: newStatus
      };
    }));
    placementQueueRef.current = placementQueueRef.current.map(p => 
      p.id === placementId ? { ...p, status } : p
    );
  }, []);

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
          break;
        }
      }
    }));
  }, []);

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
        body: JSON.stringify({ placementId: placement.id }),
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
    // let totalChunks = assignment.files.reduce((sum, file) => sum + file.chunkHashes.length, 0);
    let uploadedChunks = 0;

    const placementBlob = placement.placementBlob;
    console.log('placement', placement)
    console.log('placementBlob', placementBlob)
    const placementBlobLength = await placementBlob.getByteLength();
    const chunkCount = await placementBlob.getChunkCount();

    console.log(`Uploading chunks for placement ${placement.id}`);
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, placementBlobLength);
      const chunk = await placementBlob.slice(start, end);
      
      try {
        const chunkHashHex = await uploadChunk(placement, chunk, chunkIndex);
        uploadedChunks++;
        updatePlacementProgress(placement.id, (uploadedChunks / chunkCount) * 100, chunkIndex, chunkHashHex);
        console.log(`Uploaded chunk ${chunkIndex + 1}/${chunkCount} for placement ${placement.id}`);
      } catch (error) {
        console.error(`Error uploading chunk ${chunkIndex} for placement ${placement.id}:`, error);
        return 'error';
      }
    }

    console.log(`All chunks uploaded for placement ${placement.id}`);
    return 'verifying';
  };

  const uploadChunk = async (placement: Placement, chunk: Uint8Array, chunkIndex: number) => {
    const chunkHashHex = await sha256hex(chunk);

    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'X-Placement-Id': placement.id,
      'X-Chunk-Index': chunkIndex.toString(),
      'X-Chunk-Hash': chunkHashHex,
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
      const chunkHashes: string[] = [];
      const rollingHash = await makeHasher(HashType.SHA384);

      const totalChunks = Math.ceil(rawFile.size / CHUNK_SIZE);
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, rawFile.size);
        const chunk = await readFileChunk(rawFile, start, end);
        const chunkHash = await sha256hex(chunk);
        chunkHashes.push(chunkHash);
        
        // Update rolling hash with the current chunk
        await rollingHash.update(chunk);
      }

      const fileRollingSha384 = await rollingHash.finalize();
      const pointer: DeepHashPointer = {
        value: fileRollingSha384,
        role: 'file',
        dataLength: rawFile.size,
      };

      // create data item
      if (!address) throw new Error('Address not found');
      const dataItem = await createDataItemWithDataHash(pointer, pubKeyB64 || '', /*target*/null, /*anchor*/null, /*tags*/[{name: 'Tag1', value: 'Value1'}, {name: 'Tag2', value: 'Value2'}]);
      const dataItemPrepareToSign = await dataItem?.prepareToSign();

      // sign data item
      dataItem.signature = await wallet.signMessage(dataItemPrepareToSign, {
        hashAlgorithm: 'SHA-384',
      })

      dataItem.rawFile = rawFile;

      // create encrypted container
      const salt = createSalt();
      if (!masterKey) throw new Error('Master key not found');
      const iv = createSalt(AES_IV_BYTE_LENGTH);
      const secretKey = await encKeyFromMasterKeyAndSalt(masterKey, salt);
      const aesContainer: AESEncryptedContainer = new AESEncryptedContainer(
        dataItem,
        salt,
        secretKey,
        iv
      );

      const encryptedDataItem = await createDataItemWithAESContainer(aesContainer, pubKeyB64 || '', /*target*/null, /*anchor*/null, /*tags*/[{name: 'Tag1', value: 'Value1'}, {name: 'Tag2', value: 'Value2'}]);

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
  
      // const obj = container;
      // obj.downloadAsFile("test.obj");

      updatedFiles.push({
        ...file,
        chunkHashes,
        rollingSha384: bufferToHex(fileRollingSha384),
        dataItem,
        dataItemPrepareToSign,
        aesContainer,
        encryptedDataItem,
      });

      const dataItemBin = await dataItem?.exportBinaryHeader();
      console.log({dataItemBin})
    }

    const folder = await createFolder(updatedFiles);


    const assignmentHash = await sha256hex(new TextEncoder().encode(updatedFiles.map(f => f.chunkHashes.join('')).join('')));
    const placements = await Promise.all(PROVIDERS.map(async provider => {
      const rsaKeyPair = await generateRSAKeyPair();

      const rsaContainer = new RSAContainer(rsaKeyPair, folder);
      console.log('container', rsaContainer);

      const placementBlob = new PlacementBlob(rsaContainer);

      return {
        id: await sha256hex(`${assignmentHash}-${provider}-${Date.now()}`),
        assignmentId: assignmentHash,
        assignment,
        provider,
        status: 'created' as const,
        progress: 0,
        rsaKeyPair,
        rsaContainer,
        placementBlob
      };
    }));

    setAssignments(produce(draft => {
      const assignmentToUpdate = draft.find(a => a.id === assignment.id);
      if (assignmentToUpdate) {
        assignmentToUpdate.files = updatedFiles;
        assignmentToUpdate.id = assignmentHash;
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
      console.log(`Rolling SHA-384:`, file.rollingSha384);
      console.log(`Data item:`, file.dataItem);
      console.log('---');
    });
  }; // end processAssignment

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newAssignment: StorageAssignment = {
      id: Date.now().toString(),
      files: acceptedFiles.map(file => ({
        name: file.name,
        size: file.size,
        path: file.name,
        chunkHashes: [],
        rollingSha384: '',
        dataItem: null,
        dataItemPrepareToSign: null,
      })),
      rawFiles: acceptedFiles,
      status: 'created',
      placements: [],
      progress: 0,
    };
    setAssignments(prev => [...prev, newAssignment]);
    setAssignmentQueue(prev => [...prev, newAssignment.id]);
  }, []);

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
  };

  return <ArFleetContext.Provider value={value}>{children}</ArFleetContext.Provider>;
};
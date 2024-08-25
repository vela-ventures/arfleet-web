import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { StorageAssignment, FileMetadata, Placement } from '../types';
import { Buffer } from 'buffer';
import { sha256, privateHash, makeHasher, HashType, createDataItemWithDataHash, sha256hex, sha384hex, DeepHashPointer, bufferToHex } from '../helpers';
import { createDataItemSigner } from "@permaweb/aoconnect";

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

export const ArFleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assignments, setAssignments] = useState<StorageAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<StorageAssignment | null>(null);
  const [assignmentQueue, setAssignmentQueue] = useState<string[]>([]);
  const placementQueueRef = useRef<Placement[]>([]);
  const processingPlacement = useRef<boolean>(false);

  const processPlacementRef = useRef<(placement: Placement) => Promise<void>>();
  const checkProviderReadyRef = useRef<(placement: Placement) => Promise<string>>();
  const transferChunksRef = useRef<(placement: Placement, assignment: StorageAssignment) => Promise<Placement['status']>>();
  const verifyStorageRef = useRef<(placement: Placement, assignment: StorageAssignment) => Promise<void>>();

  const [arConnected, setArConnected] = useState(false);
  const [wallet, setWallet] = useState<any | null>(null);
  const [signer, setSigner] = useState<DataItemSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    if (globalThis.arweaveWallet) {
      const wallet_ = globalThis.arweaveWallet;
      let signer_ = createDataItemSigner(wallet_);
      setSigner(signer_);
      setWallet(wallet_);

      try {
        const address_ = await wallet_.getActiveAddress();
        setAddress(address_);
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

  const updatePlacementProgress = useCallback((placementId: string, progress: number) => {
    setAssignments(prev => prev.map(a => ({
      ...a,
      placements: a.placements.map(p => p.id === placementId ? { ...p, progress } : p)
    })));
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
        body: JSON.stringify({ assignmentId: placement.assignmentId }),
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
    let totalChunks = assignment.files.reduce((sum, file) => sum + file.chunkHashes.length, 0);
    let uploadedChunks = 0;

    for (const file of assignment.files) {
      const rawFile = assignment.rawFiles.find(rf => rf.name === file.name);
      if (!rawFile) {
        console.error(`Raw file not found for ${file.name}`);
        continue;
      }

      console.log(`Uploading chunks for file ${file.name}`);
      for (let chunkIndex = 0; chunkIndex < file.chunkHashes.length; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, rawFile.size);
        const chunk = await readFileChunk(rawFile, start, end);
        
        try {
          await uploadChunk(placement, file, chunk, chunkIndex);
          uploadedChunks++;
          updatePlacementProgress(placement.id, (uploadedChunks / totalChunks) * 100);
          console.log(`Uploaded chunk ${chunkIndex + 1}/${file.chunkHashes.length} for file ${file.name}`);
        } catch (error) {
          console.error(`Error uploading chunk ${chunkIndex} for file ${file.name}:`, error);
          return 'error';
        }
      }
    }

    console.log(`All chunks uploaded for placement ${placement.id}`);
    return 'verifying';
  };

  const uploadChunk = async (placement: Placement, file: FileMetadata, chunk: Uint8Array, chunkIndex: number) => {
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'X-Assignment-Id': placement.assignmentId,
      'X-Placement-Id': placement.id,
      'X-File-Path': Buffer.from(file.path).toString('base64'),
      'X-File-Name': Buffer.from(file.name).toString('base64'),
      'X-Chunk-Index': chunkIndex.toString(),
      'X-Total-Chunks': file.chunkHashes.length.toString(),
      'X-Chunk-Hash': file.chunkHashes[chunkIndex],
    });

    const response = await fetch(`${placement.provider}/upload`, {
      method: 'POST',
      headers: headers,
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  };

  verifyStorageRef.current = async (placement: Placement, assignment: StorageAssignment) => {
    const metadata = {
      files: assignment.files.reduce((acc, file) => {
        acc[file.name] = {
          name: file.name,
          size: file.size,
          path: file.path,
          chunks: file.chunkHashes,
        };
        return acc;
      }, {} as Record<string, any>),
    };

    const response = await fetch(`${placement.provider}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Assignment-Id': placement.assignmentId,
        'X-Placement-Id': placement.id,
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    updatePlacementStatus(placement.id, 'completed');
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
      const dataItem = await createDataItemWithDataHash(pointer, address, new Uint8Array(), []);
      const dataItemPrepareToSign = await dataItem?.prepareToSign();

      // sign data item
      const dataItemSignature = await wallet.signMessage(dataItemPrepareToSign, {
        hashAlgorithm: 'SHA-384',
      });

      updatedFiles.push({
        ...file,
        chunkHashes,
        rollingSha384: bufferToHex(fileRollingSha384),
        dataItem,
        dataItemPrepareToSign,
        dataItemSignature,
      });
    }

    const assignmentHash = await sha256hex(new TextEncoder().encode(updatedFiles.map(f => f.chunkHashes.join('')).join('')));
    const placements = PROVIDERS.map(provider => ({
      id: `${assignmentHash}-${provider}`,
      assignmentId: assignmentHash,
      provider,
      status: 'created' as const,
      progress: 0,
    }));

    setAssignments(prev => prev.map(a => 
      a.id === assignment.id ? { ...a, files: updatedFiles, id: assignmentHash, status: 'uploading', placements, progress: 0 } : a
    ));

    placementQueueRef.current.push(...placements);

    console.log('Assignment processed:', assignmentHash);
    updatedFiles.forEach(async (file) => {
      console.log(`File: ${file.name}`);
      console.log(`Size: ${file.size}`);
      console.log(`Path: ${file.path}`);
      console.log(`Chunk hashes:`, file.chunkHashes);
      console.log(`Rolling SHA-384:`, file.rollingSha384);
      console.log(`Data item:`, file.dataItem);
      console.log(`Prepare to sign:`, file.dataItemPrepareToSign);
      console.log(`Signature:`, file.dataItemSignature);
      console.log('---');
    });
  };

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
        setAssignmentQueue(prev => prev.slice(1));
      }
    };

    processNextAssignment();
  }, [assignmentQueue, assignments]);

  useEffect(() => {
    processPlacementQueue();
  }, [processPlacementQueue, assignments]);

  const readFileChunk = (file: File, start: number, end: number): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(start, end));
    });
  };

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
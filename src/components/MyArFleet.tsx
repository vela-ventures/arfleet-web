import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, FolderUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import StorageAssignmentList from './StorageAssignmentList';
import AssignmentDetails from './AssignmentDetails';
import FileContentViewer from './FileContentViewer';
import { sha256 } from 'js-sha256';

interface FileMetadata {
  name: string;
  size: number;
  path: string;
  chunkHashes: string[];
}

interface StorageAssignment {
  id: string;
  files: FileMetadata[];
  rawFiles: File[];
  status: 'created' | 'chunking' | 'ready' | 'uploading' | 'completed' | 'error';
}

const CHUNK_SIZE = 4096; // 4KB chunks

export default function MyArFleet() {
  const [assignments, setAssignments] = useState<StorageAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<StorageAssignment | null>(null);
  const [assignmentQueue, setAssignmentQueue] = useState<string[]>([]);

  function dragAndDropOverlay(overlayMode: boolean) {
    return (
      <div className={cn(
        "absolute inset-0 z-50 flex items-center justify-center p-8 h-full w-full",
        overlayMode ? "top-0 bg-background/80 border-2 border-dashed border-primary" : "top-0 border-2 border-transparent"
      )}>
        <div className={cn(
          "flex flex-col border-2 rounded-lg p-[15%]",
          overlayMode ? "border-5 border-primary" : "border-dashed border-gray-300"
        )}>
            <div className={cn("flex flex-col items-center justify-center", overlayMode ? "" : "opacity-80")}>
                <CloudUpload className="h-16 w-16 text-primary" />
                <p className="mt-4 text-xl font-semibold">Drop files or folders here to upload</p>
                <p className="text-sm text-gray-500">
                    {overlayMode ? (<span>&nbsp;</span>) : "or click here"}
                </p>

                {/* buttons: Upload File and Upload Folder */}
                <div className={cn("flex flex-row justify-center space-x-4 mt-6", overlayMode ? "invisible" : "visible")}>
                    <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out flex items-center">
                      <CloudUpload className="h-5 w-5 mr-2" />
                      Upload File
                    </button>
                    <button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out flex items-center">
                      <FolderUp className="h-5 w-5 mr-2" />
                      Upload Folder
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newAssignment: StorageAssignment = {
      id: Date.now().toString(),
      files: acceptedFiles.map(file => ({
        name: file.name,
        size: file.size,
        path: file.path || file.name,
        chunkHashes: [],
      })),
      rawFiles: acceptedFiles,
      status: 'created',
    };
    setAssignments(prev => [...prev, newAssignment]);
    setAssignmentQueue(prev => [...prev, newAssignment.id]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: assignments.length > 0 // Disable click when assignments exist
  });

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

  const processAssignment = async (assignment: StorageAssignment) => {
    setAssignments(prev => prev.map(a => 
      a.id === assignment.id ? { ...a, status: 'chunking' } : a
    ));

    const updatedFiles: FileMetadata[] = [];

    for (let i = 0; i < assignment.files.length; i++) {
      const file = assignment.files[i];
      const rawFile = assignment.rawFiles[i];
      const fileContent = await readFileAsArrayBuffer(rawFile);
      const chunkHashes: string[] = [];

      for (let j = 0; j < fileContent.byteLength; j += CHUNK_SIZE) {
        const chunk = fileContent.slice(j, j + CHUNK_SIZE);
        const chunkHash = sha256(new Uint8Array(chunk));
        chunkHashes.push(chunkHash);
      }

      updatedFiles.push({
        ...file,
        chunkHashes,
      });
    }

    setAssignments(prev => prev.map(a => 
      a.id === assignment.id ? { ...a, files: updatedFiles, status: 'ready' } : a
    ));

    // Log the chunk hashes for each file
    console.log('Assignment processed:', assignment.id);
    updatedFiles.forEach(file => {
      console.log(`File: ${file.name}`);
      console.log(`Chunk hashes:`, file.chunkHashes);
      console.log('---');
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  return (
    <div {...getRootProps()} className="flex flex-col h-screen relative">
      <input {...getInputProps()} />
      
      <h1 className="text-2xl font-bold p-4">My ArFleet</h1>

      {assignments.length === 0 && !isDragActive ? (
        dragAndDropOverlay(false)
      ) : (
        assignments.length > 0 ? (
          <div className="flex-1 flex">
            <StorageAssignmentList
              assignments={assignments}
            selectedAssignment={selectedAssignment}
            onSelectAssignment={setSelectedAssignment}
          />
          <div className="flex-1 flex flex-col">
            <AssignmentDetails assignment={selectedAssignment} />
            <FileContentViewer assignment={selectedAssignment} />
          </div>
        </div>
        ) : null
      )}
      {isDragActive && dragAndDropOverlay(true)}
    </div>
  );
}
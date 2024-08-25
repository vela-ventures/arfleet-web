import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload } from 'lucide-react';
import { cn } from "@/lib/utils";
import StorageAssignmentList from './StorageAssignmentList';
import AssignmentDetails from './AssignmentDetails';
import FileContentViewer from './FileContentViewer';

interface StorageAssignment {
  id: string;
  files: File[];
  status: 'processing' | 'uploading' | 'completed' | 'error';
}

export default function MyArFleet() {
  const [assignments, setAssignments] = useState<StorageAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<StorageAssignment | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newAssignment: StorageAssignment = {
      id: Date.now().toString(),
      files: acceptedFiles,
      status: 'processing',
    };
    setAssignments(prev => [...prev, newAssignment]);
    // TODO: Implement file chunking and assignment creation logic
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <main className="flex flex-col h-screen">
      <h1 className="text-2xl font-bold p-4">My ArFleet</h1>
      {assignments.length === 0 ? (
        <div
          {...getRootProps()}
          className={cn(
            "flex-1 flex items-center justify-center border-2 border-dashed rounded-xl m-4",
            isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25"
          )}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2">Drag and drop files here, or click to select files</p>
          </div>
        </div>
      ) : (
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
      )}
    </main>
  );
}
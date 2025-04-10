import React, { useEffect, useState, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, FolderUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import StorageAssignmentList from './StorageAssignmentList';
import AssignmentDetails from './AssignmentDetails';
import FileContentViewer from './FileContentViewer';
import { useArFleet } from '../contexts/ArFleetContext';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import FloatingUploadButton from './FloatingUploadButton';

interface MyArFleetProps {
  isGlobalDragActive: boolean;
  masterKey: Uint8Array | null;
}

declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

async function getFilesFromDirectory(dirHandle: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      files.push(await entry.getFile());
    } else if (entry.kind === 'directory') {
      files.push(...await getFilesFromDirectory(entry));
    }
  }
  return files;
}

export default function MyArFleet({ isGlobalDragActive, masterKey }: MyArFleetProps) {
  const { assignments, selectedAssignmentId, setSelectedAssignmentId, onDrop, devMode, fetchAndProcessManifest } = useArFleet();
  const [showOnlyCompleted, setShowOnlyCompleted] = useState(() => {
    const savedState = localStorage.getItem('showOnlyCompleted');
    return savedState ? JSON.parse(savedState) : false;
  });
  console.log('MyArFleet rendering', assignments.length);

  const { getRootProps, getInputProps, isDragActive: isLocalDragActive } = useDropzone({
    onDrop,
    noClick: assignments.length > 0 // Disable click when assignments exist
  });

  const isDragActive = isLocalDragActive || isGlobalDragActive;

  const handleFileSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) onDrop(Array.from(files));
    };
    input.click();
  };

  const handleDirSelect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files = await getFilesFromDirectory(dirHandle);
      onDrop(files);
    } catch (error) {
      console.error("Error selecting directory:", error);
    }
  };

  const shouldEnableCheckbox = useMemo(() => {
    return assignments.some(a => a.status !== 'uploading' && a.status !== 'completed');
  }, [assignments]);

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => b.createdAt - a.createdAt);
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    if (!showOnlyCompleted) return sortedAssignments;
    return sortedAssignments.filter(a => a.status === 'completed' || a.status === 'uploading' || a.id === selectedAssignmentId);
  }, [sortedAssignments, showOnlyCompleted, selectedAssignmentId]);

  useEffect(() => {
    // Set the first assignment as selected if none is selected and assignments exist
    if (!selectedAssignmentId && filteredAssignments.length > 0) {
      setSelectedAssignmentId(filteredAssignments[0].id);
    }
  }, [filteredAssignments, selectedAssignmentId, setSelectedAssignmentId]);

  function dragAndDropOverlay(overlayMode: boolean) {
    return (
      <div className={cn(
        "absolute inset-0 z-50 flex items-center justify-center p-8 h-[calc(100vh-63px)] w-full",
        overlayMode ? "top-0 bg-background/80 border-2 border-primary" : "top-0 border-2 border-transparent"
      )}>
        <div className={cn(
          "flex flex-col border-2 rounded-lg p-[15%]",
          overlayMode ? "border-5 border-primary" : "border-dashed border-gray-200"
        )}>
            <div className={cn("flex flex-col items-center justify-center", overlayMode ? "" : "opacity-80")}>
                <CloudUpload className="h-16 w-16 text-primary" />
                <p className="mt-4 text-xl font-semibold">Drop files or folders here to upload</p>
                <p className="text-sm text-gray-500">
                    {overlayMode ? (<span>&nbsp;</span>) : "or use the buttons below"}
                </p>

                {/* buttons: Upload File and Upload Folder */}
                <div className={cn("flex flex-row justify-center space-x-4 mt-6", overlayMode ? "invisible" : "visible")}>
                    <button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out flex items-center"
                      onClick={handleFileSelect}
                    >
                      <CloudUpload className="h-5 w-5 mr-2" />
                      Upload Files
                    </button>
                    <button
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out flex items-center"
                      onClick={handleDirSelect}
                    >
                      <FolderUp className="h-5 w-5 mr-2" />
                      Upload Folder
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // This effect will run whenever the assignments state changes
    // console.log('Assignments updated:', assignments);
    // You can add any logic here that needs to run when assignments change
  }, [assignments]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4">
        <h1 className="text-2xl font-bold">My ArFleet</h1>
        {shouldEnableCheckbox && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-completed"
              checked={showOnlyCompleted}
              onCheckedChange={(checked) => {
                const newState = checked as boolean;
                setShowOnlyCompleted(newState);
                localStorage.setItem('showOnlyCompleted', JSON.stringify(newState));
              }}
              className="text-muted-foreground"
            />
            <Label
              htmlFor="show-completed"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
            >
              Show only completed
            </Label>
          </div>
        )}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div {...getRootProps()} className="flex-1 flex relative">
          <input {...getInputProps()} />
          
          {assignments.length === 0 ? (
            dragAndDropOverlay(false)
          ) : (
            <>
              <div className="w-64 border-r overflow-y-auto">
                <StorageAssignmentList
                  assignments={filteredAssignments}
                  selectedAssignmentId={selectedAssignmentId}
                  onSelectAssignment={setSelectedAssignmentId}
                  fetchAndProcessManifest={fetchAndProcessManifest}
                  masterKey={masterKey}
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                <AssignmentDetails
                  assignments={filteredAssignments}
                  selectedAssignmentId={selectedAssignmentId}
                />
                <FileContentViewer />
              </div>
            </>
          )}
          {isDragActive && dragAndDropOverlay(true)}
        </div>
      </div>

      <FloatingUploadButton onFileSelect={handleFileSelect} onDirSelect={handleDirSelect} />
      
    </div>
  );
}
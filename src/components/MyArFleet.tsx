import React, { useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, FolderUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import StorageAssignmentList from './StorageAssignmentList';
import AssignmentDetails from './AssignmentDetails';
import FileContentViewer from './FileContentViewer';
import { useArFleet } from '../contexts/ArFleetContext';

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
      <h1 className="text-2xl font-bold p-4">My ArFleet</h1>
      <div className="flex-1 flex overflow-hidden">
        <div {...getRootProps()} className="flex-1 flex relative">
          <input {...getInputProps()} />
          
          {assignments.length === 0 ? (
            dragAndDropOverlay(false)
          ) : (
            <>
              <div className="w-64 border-r overflow-y-auto">
                <StorageAssignmentList
                  assignments={assignments}
                  selectedAssignmentId={selectedAssignmentId}
                  onSelectAssignment={setSelectedAssignmentId}
                  fetchAndProcessManifest={fetchAndProcessManifest}
                  masterKey={masterKey}
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                <AssignmentDetails />
                <FileContentViewer />
              </div>
            </>
          )}
          {isDragActive && dragAndDropOverlay(true)}
        </div>
      </div>
    </div>
  );
}
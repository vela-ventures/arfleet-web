import React from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, FolderUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import StorageAssignmentList from './StorageAssignmentList';
import AssignmentDetails from './AssignmentDetails';
import FileContentViewer from './FileContentViewer';
import { useArFleet } from '../contexts/ArFleetContext';

export default function MyArFleet() {
  const { assignments, selectedAssignment, setSelectedAssignment, onDrop } = useArFleet();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: assignments.length > 0 // Disable click when assignments exist
  });

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
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StorageAssignment {
  id: string;
  files: File[];
  status: 'processing' | 'uploading' | 'completed' | 'error';
}

interface FileContentViewerProps {
  assignment: StorageAssignment | null;
}

export default function FileContentViewer({ assignment }: FileContentViewerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (!assignment) {
    return null;
  }

  return (
    <div className="p-4 border-t">
      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>
        <TabsContent value="files">
          <ul className="mt-2">
            {assignment.files.map((file, index) => (
              <li
                key={index}
                className="cursor-pointer hover:bg-muted p-2"
                onClick={() => setSelectedFile(file)}
              >
                {file.name}
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="content">
          {selectedFile ? (
            <div className="mt-2">
              <h3 className="font-semibold">{selectedFile.name}</h3>
              <p className="text-sm text-muted-foreground">
                Size: {selectedFile.size} bytes
              </p>
              {/* Add file content preview here when implemented */}
              <p className="mt-2">File content preview not yet implemented</p>
            </div>
          ) : (
            <p className="mt-2">Select a file to view its content</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
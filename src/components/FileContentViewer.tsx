import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorageAssignment, FileMetadata, Placement } from '../types';
import { Button } from "@/components/ui/button";
import { concatBuffers } from '../helpers/buf';

interface FileContentViewerProps {
  assignment: StorageAssignment | null;
}

export default function FileContentViewer({ assignment }: FileContentViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!assignment) {
    return null;
  }

  const downloadFile = async (file: FileMetadata) => {
    setIsDownloading(true);
    try {
      const chunks: Uint8Array[] = [];
      const placement = assignment.placements[0]; // Assuming we're using the first placement

      for (let chunkIndex = 0; chunkIndex < Object.keys(file.chunkHashes).length; chunkIndex++) {
        const chunkHash = file.chunkHashes[chunkIndex];
        const chunkData = await fetchChunk(placement, chunkHash);
        chunks.push(chunkData);
      }

      const mergedData = concatBuffers(chunks);
      const dataView = new DataView(mergedData.buffer, mergedData.byteOffset, mergedData.byteLength);
      const fileSize = Number(dataView.getBigUint64(0, true)); // Read 8-byte little-endian size

      const fileData = mergedData.slice(8, 8 + fileSize); // Slice the actual file data
      const blob = new Blob([fileData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchChunk = async (placement: Placement, chunkHash: string): Promise<Uint8Array> => {
    const response = await fetch(`${placement.provider}/download/${chunkHash}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chunk: ${chunkHash}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  };

  return (
    <div className="p-4 border-t">
      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="files">
          <ul className="mt-2">
            {assignment.files.map((file, index) => (
              <li
                key={index}
                className="flex justify-between items-center hover:bg-muted p-2"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{file.name}</span>
                  <span className="text-sm text-muted-foreground">{file.path}</span>
                </div>
                <Button 
                  onClick={() => downloadFile(file)} 
                  disabled={isDownloading}
                >
                  {isDownloading ? 'Downloading...' : 'Download'}
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
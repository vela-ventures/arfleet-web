import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorageAssignment, FileMetadata } from '../types';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderIcon, FileIcon, FileTextIcon, FileCodeIcon, FileImageIcon, DownloadIcon, ShareIcon } from 'lucide-react';
import { concatBuffers } from '@/helpers/buf';

interface FileTreeItem {
  type: 'file' | 'folder';
  name: string;
  path: string;
  children?: FileTreeItem[];
  file?: FileMetadata;
}

export default function FileContentViewer({ assignment }: FileContentViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);

  if (!assignment) {
    return null;
  }

  const buildFileTree = (files: FileMetadata[]): FileTreeItem[] => {
    const root: FileTreeItem = { type: 'folder', name: '/', path: '/', children: [] };
    
    files.forEach(file => {
      const parts = file.path.split('/').filter(Boolean);
      let currentLevel = root;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          currentLevel.children?.push({
            type: 'file',
            name: part,
            path: file.path,
            file: file
          });
        } else {
          let folder = currentLevel.children?.find(item => item.type === 'folder' && item.name === part);
          if (!folder) {
            folder = { type: 'folder', name: part, path: '/' + parts.slice(0, index + 1).join('/'), children: [] };
            currentLevel.children?.push(folder);
          }
          currentLevel = folder;
        }
      });
    });

    return root.children || [];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'txt':
      case 'md':
        return <FileTextIcon className="w-5 h-5 mr-2 text-blue-500" />;
      case 'js':
      case 'ts':
      case 'py':
      case 'html':
      case 'css':
        return <FileCodeIcon className="w-5 h-5 mr-2 text-green-500" />;
      case 'jpg':
      case 'png':
      case 'gif':
      case 'svg':
        return <FileImageIcon className="w-5 h-5 mr-2 text-purple-500" />;
      default:
        return <FileIcon className="w-5 h-5 mr-2 text-gray-500" />;
    }
  };

  const isDescendantOfHoveredFolder = (path: string) => {
    if (!hoveredFolder) return false;
    return path.startsWith(hoveredFolder + '/');
  };

  const renderFileTree = (items: FileTreeItem[], depth = 0) => {
    return items.map((item) => (
      <li
        key={item.path}
        className={`${depth > 0 ? 'ml-4' : ''}`}
        onMouseEnter={() => item.type === 'folder' && setHoveredFolder(item.path)}
        onMouseLeave={() => setHoveredFolder(null)}
      >
        <div className={`flex items-center py-2 px-2 group text-sm rounded-md
          ${item.type === 'folder' ? 'bg-blue-50' : ''}
          ${hoveredFolder === item.path ? 'bg-blue-100' : ''}
          ${isDescendantOfHoveredFolder(item.path) ? 'bg-blue-50/50' : ''}
          ${item.type === 'file' ? 'hover:bg-gray-100' : ''}`}
        >
          <Checkbox
            className="opacity-0 group-hover:opacity-100 mr-2 h-4 w-4"
            checked={selectedItems.has(item.path)}
            onCheckedChange={(checked) => {
              const newSelected = new Set(selectedItems);
              if (checked) {
                newSelected.add(item.path);
              } else {
                newSelected.delete(item.path);
              }
              setSelectedItems(newSelected);
            }}
          />
          {item.type === 'folder' ? (
            <FolderIcon className="w-5 h-5 mr-2 text-yellow-500" />
          ) : (
            getFileIcon(item.name)
          )}
          <span className={`flex-grow truncate ${item.type === 'folder' ? 'font-semibold' : ''}`}>
            {item.name}
          </span>
          {item.type === 'file' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => item.file && downloadFile(item.file)}
                disabled={isDownloading}
                className="opacity-0 group-hover:opacity-100 p-1 h-7 bg-white hover:bg-blue-100 transition-colors duration-200 mr-2"
              >
                <DownloadIcon className="w-4 h-4 mr-1" />
                {isDownloading ? 'Downloading...' : 'Download'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => console.log('Share clicked')} // Add your share logic here
                className="opacity-0 group-hover:opacity-100 p-1 h-7 bg-white hover:bg-blue-100 transition-colors duration-200 mr-2"
              >
                <ShareIcon className="w-4 h-4 mr-1" />
                Share
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => console.log('Immortalize clicked')} // Add your immortalize logic here
                className="opacity-0 group-hover:opacity-100 p-1 h-7 bg-white hover:bg-blue-100 transition-colors duration-200"
              >
                <span className="w-4 h-4 mr-1 inline-flex items-center justify-center border border-current rounded-full text-xs">
                  <span className="relative bottom-[1px]">a</span>
                </span>
                Immortalize
              </Button>
            </>
          )}
        </div>
        {item.type === 'folder' && item.children && (
          <ul className="mt-1">
            {renderFileTree(item.children, depth + 1)}
          </ul>
        )}
      </li>
    ));
  };

  const fileTree = buildFileTree(assignment.files);

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
    <div className="p-2 border-t">
      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="files">
          <ul className="mt-1">
            {renderFileTree(fileTree)}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
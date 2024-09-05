import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorageAssignment, FileMetadata } from '../types';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderIcon, FileIcon, FileTextIcon, FileCodeIcon, FileImageIcon, DownloadIcon, ShareIcon, X, Check } from 'lucide-react';
import { Placement, useArFleet } from '../contexts/ArFleetContext';
import { ArpReader } from '@/helpers/arp';
import { DataItemReader } from '@/helpers/dataitemmod';
import { AESContainerReader } from '@/helpers/aes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { bufferTob64Url, stringToB64Url } from '@/helpers/encodeUtils';
import { encKeyFromMasterKeyAndSalt } from '@/helpers/encrypt';

interface FileTreeItem {
  type: 'file' | 'folder';
  name: string;
  path: string;
  children?: FileTreeItem[];
  file?: FileMetadata;
}

export default function FileContentViewer() {
  const { assignments, selectedAssignmentId, masterKey } = useArFleet();
  const assignment = assignments.find((a: StorageAssignment) => a.id === selectedAssignmentId);

  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [downloadingFilePath, setDownloadingFilePath] = useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareItem, setShareItem] = useState<FileTreeItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isShareDialogOpen && shareItem && masterKey) {
      const getShareUrl = async () => {
        try {
          const url = await deriveShareUrl(shareItem, assignment!.placements[0], masterKey);
          setShareUrl(url);
        } catch (error) {
          console.error('Error generating share URL:', error);
          setShareUrl(null);
        }
      };
      getShareUrl();
    }
  }, [isShareDialogOpen, shareItem, masterKey, assignment]);

  const deriveShareUrl = async (shareItem: FileTreeItem, placement: Placement, masterKey: Uint8Array) => {
    const placementProviderUrl = placement.provider;
    const key = await deriveKey(masterKey, shareItem.file!, placement);
    const keyB64 = bufferTob64Url(key);
    return `https://example.com/download/${shareItem.file!.arpId}?key=${keyB64}&name=${encodeName(shareItem.file!.name)}&provider=${encodeURIComponent(placementProviderUrl)}`;
  };

  const deriveKey = async (masterKey: Uint8Array, file: FileMetadata, placement: Placement) => {
    let arpId = file.arpId;
    if (!arpId) {
      if (file.arp) {
        arpId = file.arp.chunkHashes[0];
      } else {
        throw new Error('ARP Id is not set');
      }
    }

    const arpReader = new ArpReader(arpId, placement);
    await arpReader.init();

    const dataItemReader = new DataItemReader(arpReader);
    await dataItemReader.init();

    const aesReader = new AESContainerReader(dataItemReader, masterKey);
    await aesReader.init();

    const salt = aesReader.salt;
    const key = await encKeyFromMasterKeyAndSalt(masterKey, salt);

    return key;
  };

  const encodeName = (name: string) => {
    return stringToB64Url(name);
  };

  const handleCopyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

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

  const openShareDialog = (item: FileTreeItem) => {
    setShareItem(item);
    setIsShareDialogOpen(true);
  };

  const closeShareDialog = () => {
    setIsShareDialogOpen(false);
    setShareItem(null);
    setShareUrl(null);
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
          ${hoveredFolder === item.path ? 'bg-gray-200 dark:bg-gray-700' : ''}
          ${isDescendantOfHoveredFolder(item.path) ? 'bg-gray-100 dark:bg-gray-800' : ''}
          ${item.type === 'file' ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : ''}`}
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
                disabled={downloadingFilePath === item.path}
                className="opacity-0 group-hover:opacity-100 p-1 h-7 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors duration-200 mr-2 text-black dark:text-white border-gray-300 dark:border-gray-600"
              >
                <DownloadIcon className="w-4 h-4 mr-1" />
                {downloadingFilePath === item.path ? 'Downloading...' : 'Download'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openShareDialog(item)}
                className="opacity-0 group-hover:opacity-100 p-1 h-7 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors duration-200 mr-2 text-black dark:text-white border-gray-300 dark:border-gray-600"
              >
                <ShareIcon className="w-4 h-4 mr-1" />
                Share
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => console.log('Immortalize clicked')} // Add your immortalize logic here
                className="opacity-0 group-hover:opacity-100 p-1 h-7 bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors duration-200 text-black dark:text-white border-gray-300 dark:border-gray-600"
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
    console.log('Downloading file:', file);
    setDownloadingFilePath(file.path);
    setIsDownloading(true);
    try {
      const placement = assignment.placements[0]; // Assuming we're using the first placement
      
      if (!masterKey) {
        console.error('Master key is not set');
        return;
      }

      console.log({file})

      let arpId = file.arpId;
      if (!arpId) {
        if (file.arp) {
          arpId = file.arp.chunkHashes[0];
          console.log('arpId', arpId);
        } else {
          throw new Error('ARP Id is not set');
        }
      }

      const arpReader = new ArpReader(arpId, placement);
      await arpReader.init();
      console.log('arpReader', arpReader);

      const dataItemReader = new DataItemReader(arpReader);
      await dataItemReader.init();
      console.log('dataItemReader', dataItemReader);

      const aesReader = new AESContainerReader(dataItemReader, masterKey);
      await aesReader.init();
      console.log('aesReader', aesReader);

      const decryptedDataItemReader = new DataItemReader(aesReader);
      await decryptedDataItemReader.init();
      console.log('decryptedDataItemReader', decryptedDataItemReader);
      
      const fileData = await decryptedDataItemReader.slice(0, decryptedDataItemReader.dataLength);
      
      const blob = new Blob([fileData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsDownloading(false);
      setDownloadingFilePath(null);
    } catch (error) {
      console.error('Error downloading file:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsDownloading(false);
    }
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
      <Dialog open={isShareDialogOpen} onOpenChange={closeShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Share file</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
          <div className="flex flex-col space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy the URL below to share this file.
            </p>
            <div>
              <p className="text-sm font-medium">Name/Path:</p>
              <p className="text-sm text-muted-foreground">{shareItem?.path}</p>
            </div>
            <div>
              <p className="text-sm font-medium">URL:</p>
              {shareUrl ? (
                <p 
                  className="text-sm text-muted-foreground break-all cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded transition-colors duration-200"
                  onClick={handleCopyUrl}
                  title="Click to copy"
                >
                  {shareUrl}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Generating URL...</p>
              )}
            </div>
          </div>
          <Button
            onClick={handleCopyUrl}
            className="w-full mt-4"
            disabled={!shareUrl || isCopied}
          >
            {isCopied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              'Copy URL'
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
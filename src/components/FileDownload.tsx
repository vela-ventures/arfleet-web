import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { DownloadIcon, FileIcon, Code } from 'lucide-react';
import { ArpReader } from '@/helpers/arp';
import { DataItemReader } from '@/helpers/dataitemmod';
import { AESContainerReader } from '@/helpers/aes';
import { Placement } from '../contexts/ArFleetContext';
import { FileMetadata } from '../types';
import { b64UrlToBuffer, b64UrlToString } from '@/helpers/encodeUtils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

enum DownloadState {
  Idle,
  Decrypting,
  Downloading,
}

export default function FileDownload() {
  const { arpId, key, name, provider } = useParams<{ arpId: string, key: string, name: string, provider: string }>();
  const [downloadState, setDownloadState] = useState<DownloadState>(DownloadState.Idle);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = async () => {
    setDownloadState(DownloadState.Decrypting);
    setError(null);
    try {
      const placement: Placement = new Placement({ provider: decodeURIComponent(provider!) });
      const keyBuffer = b64UrlToBuffer(key!);
      const fileName = b64UrlToString(name!);

      const arpReader = new ArpReader(arpId!, placement);
      await arpReader.init();

      const dataItemReader = new DataItemReader(arpReader);
      await dataItemReader.init();

      const aesReader = new AESContainerReader(dataItemReader, keyBuffer, 'item');
      await aesReader.init();

      const decryptedDataItemReader = new DataItemReader(aesReader);
      await decryptedDataItemReader.init();
      
      const fileData = await decryptedDataItemReader.slice(0, decryptedDataItemReader.dataLength);
      
      setDownloadState(DownloadState.Downloading);
      const blob = new Blob([fileData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('An error occurred while downloading the file. Please try again.');
    } finally {
      setDownloadState(DownloadState.Idle);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <FileIcon className="w-6 h-6" />
            File Download
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">File Name</p>
              <p className="text-lg font-semibold truncate">
                {b64UrlToString(name!) || <Skeleton className="h-6 w-3/4" />}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ARP Route</p>
              {arpId ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <code className="text-sm bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 font-mono block truncate">
                        {arpId}
                      </code>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs">{arpId}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Skeleton className="h-6 w-full" />
              )}
            </div>
            <Button
              onClick={downloadFile}
              disabled={downloadState !== DownloadState.Idle}
              className="w-full"
            >
              {downloadState === DownloadState.Decrypting ? (
                <>
                  <Skeleton className="h-5 w-5 mr-2" />
                  Decrypting...
                </>
              ) : downloadState === DownloadState.Downloading ? (
                <>
                  <Skeleton className="h-5 w-5 mr-2" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Download
                </>
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                <Code className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
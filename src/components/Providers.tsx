import React, { useEffect, useState, useRef } from 'react';
import { CloudUpload, FolderUp, Globe, HardDrive, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useArFleet } from '../contexts/ArFleetContext';
import { getAoInstance } from '../arfleet/ao';
import { getAnnouncements } from '../arfleet/marketplace';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Announcement {
  ConnectionStrings: string;
  StorageCapacity?: number;
}

export default function Providers({  }: any) {
  const { wallet, devMode, provisionedProviders, ao } = useArFleet();
  const [announcements, setAnnouncements] = useState<Record<string, Announcement>>({});
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      const data = await getAnnouncements();
      setAnnouncements(data);
      console.log('Announcements:', data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (wallet && ao) {
      fetchAnnouncements();
      intervalRef.current = setInterval(fetchAnnouncements, 20000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [wallet, ao]);

  return (
    <div className="flex flex-col relative p-4">
      <h1 className="text-2xl font-bold mb-4">Providers</h1>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Announcements
            <Badge variant="outline" className="ml-2">
              {isLoading ? 'Updating...' : 'Live'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Connection String</TableHead>
                  <TableHead>Storage Capacity</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(announcements)
                  .sort(([, a], [, b]) => {
                    const aProvisioned = provisionedProviders.includes(a.ConnectionStrings);
                    const bProvisioned = provisionedProviders.includes(b.ConnectionStrings);
                    if (aProvisioned && bProvisioned) {
                      return a.ConnectionStrings.localeCompare(b.ConnectionStrings);
                    }
                    return bProvisioned - aProvisioned;
                  })
                  .map(([id, data]) => (
                    <TableRow key={id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{id.substring(0, 15)}...</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <Globe className="mr-2 h-4 w-4" />
                                {data.ConnectionStrings}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Connection String</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {data.StorageCapacity ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <HardDrive className="mr-2 h-4 w-4" />
                                  {(data.StorageCapacity / (1024 * 1024 * 1024)).toFixed(2)} GB
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Storage Capacity</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {provisionedProviders.includes(data.ConnectionStrings) ? (
                          <Badge variant="secondary">Provisioned</Badge>
                        ) : (
                          ''
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useMemo, useEffect, useState } from 'react';
import { format, formatDistance, differenceInSeconds } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { useArFleet } from '../contexts/ArFleetContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { getProgressColorByPlacementStatus } from '@/helpers/progresscolor';
import { cn } from "@/lib/utils"; // Make sure you have this utility function

// Add this CSS class somewhere in your global styles or in a <style> tag in your component
const styles = `
  @keyframes spinPause {
    0%, 10% { transform: rotate(0deg); }
    10%, 90% { transform: rotate(180deg); }
    90%, 100% { transform: rotate(180deg); }
  }
  .spin-pause {
    animation: spinPause 1s infinite;
    display: inline-block;
  }
`;

export default function AssignmentDetails({ assignments, selectedAssignmentId }) {
  const { fetchAndProcessManifest, masterKey } = useArFleet();
  const [isLoading, setIsLoading] = useState(false);

  const assignment = useMemo(() => {
    return assignments.find(a => a.id === selectedAssignmentId);
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    if (assignment && assignment.files.length === 0) {
      setIsLoading(true);
      fetchAndProcessManifest(assignment, masterKey).finally(() => setIsLoading(false));
    }
  }, [assignment, fetchAndProcessManifest, masterKey]);

  if (!assignment) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Select an assignment to view details</div>;
  }

  const getProgressColor = (progress: number) => {
    return progress === 100 ? "bg-green-500" : "bg-yellow-500";
  };

  const totalProgress = assignment.placements.reduce((sum, placement) => sum + placement.progress, 0) / assignment.placements.length;

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const elapsedSeconds = differenceInSeconds(new Date(), new Date(assignment.createdAt));
  const elapsedTime = formatTime(elapsedSeconds);

  const estimateETA = () => {
    if (totalProgress === 0) return '00:00:00';
    if (totalProgress === 100) return elapsedTime;
    const estimatedTotalSeconds = elapsedSeconds / (totalProgress / 100);
    const remainingSeconds = Math.max(0, Math.round(estimatedTotalSeconds - elapsedSeconds));
    return formatTime(remainingSeconds);
  };

  const eta = estimateETA();

  return (
    <div className="overflow-y-auto overflow-x-hidden">
      <style>{styles}</style>
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm m-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Assignment Details</h2>
        
        <table className="w-full mb-6">
          <tbody>
            <tr>
              <td className="font-medium text-gray-500 dark:text-gray-400 pr-4 py-2">ID:</td>
              <td className="text-gray-800 dark:text-gray-200">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono truncate inline-block align-middle text-sm" style={{maxWidth: "calc(100% - 3rem)"}}>
                        {assignment.id}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{assignment.id}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </td>
            </tr>
            <tr>
              <td className="font-medium text-gray-500 dark:text-gray-400 pr-4 py-2">Created:</td>
              <td className="text-gray-800 dark:text-gray-200">
                {format(new Date(assignment.createdAt), 'PPpp')}
              </td>
            </tr>
            <tr>
              <td className="font-medium text-gray-500 dark:text-gray-400 pr-4 py-2">Status:</td>
              <td>
                <span className="inline-block px-2 py-1 text-sm font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  {assignment.status}
                </span>
              </td>
            </tr>
            <tr>
              <td className="font-medium text-gray-500 dark:text-gray-400 pr-4 py-2">Files:</td>
              <td className="text-gray-800 dark:text-gray-200">
                {isLoading ? (
                  <>
                    Loading...
                    <span className="inline-block ml-2 spin-pause">⏳</span>
                  </>
                ) : (
                  assignment.files.length
                )}
              </td>
            </tr>
            <tr>
              <td className="font-medium text-gray-500 dark:text-gray-400 pr-4 py-2">Progress:</td>
              <td className="p-1">
                <div className="flex items-center">
                  <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-grow mr-4">
                    {assignment.placements.map((placement, index) => {
                      const width = (placement.progress / 100) * (100 / assignment.placements.length);
                      return (
                        <div
                          key={placement.id}
                          className={cn(
                            "h-full float-left",
                            getProgressColorByPlacementStatus(placement.status, assignment.status)
                          )}
                          style={{ width: `${width}%` }}
                          title={`${placement.provider}: ${placement.progress}%`}
                        />
                      );
                    })}
                  </div>
                  {assignment.status === "uploading" && (
                    <div className="ml-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {elapsedTime}/{eta} ({Math.round(totalProgress)}%)
                    </div>
                  )}
                </div>
                {/* <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                  {totalProgress.toFixed(1)}% complete
                </div> */}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Placements</h3>
        <div className="space-y-2">
          {assignment.placements.map((placement) => (
            <div key={placement.id} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
              <div className="flex items-center">
                <span className="font-medium mr-2 flex-grow text-gray-800 dark:text-gray-200 truncate" title={placement.provider}>
                  {placement.provider}
                </span>
                <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full mr-2">
                  {placement.status}
                </span>
                <div className="w-24">
                  <Progress 
                    value={placement.progress} 
                    className="h-1.5 bg-gray-200 dark:bg-gray-600" 
                    indicatorClassName={getProgressColorByPlacementStatus(placement.status, assignment.status)}
                  />
                </div>
              </div>
              {placement.processId && (
                <>
                  <hr className="mt-1 my-2 border-gray-200 dark:border-gray-600" />
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    <span className="mr-1">Process ID:</span>
                    <a
                      href={`https://www.ao.link/#/entity/${placement.processId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 flex items-center"
                    >
                      <span className="truncate mr-1" style={{maxWidth: "200px"}}>{placement.processId}</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
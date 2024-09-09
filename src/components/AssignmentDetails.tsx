import React, { useMemo, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { useArFleet } from '../contexts/ArFleetContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from 'lucide-react';
import { ExternalLink } from 'lucide-react';

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

export default function AssignmentDetails() {
  const { assignments, selectedAssignmentId, fetchAndProcessManifest, masterKey } = useArFleet();
  const [isLoading, setIsLoading] = useState(false);

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => b.createdAt - a.createdAt);
  }, [assignments]);

  const assignment = useMemo(() => {
    return sortedAssignments.find(a => a.id === selectedAssignmentId) || sortedAssignments[0];
  }, [sortedAssignments, selectedAssignmentId]);

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
    return progress === 100 ? "bg-green-500" : "bg-orange-400";
  };

  return (
    <div className="overflow-y-auto overflow-x-hidden">
      <style>{styles}</style>
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm m-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Assignment Details</h2>
        
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div>
            <span className="font-medium text-gray-500 dark:text-gray-400">ID:</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-gray-800 dark:text-gray-200 ml-2 truncate inline-block align-middle text-sm" style={{maxWidth: "calc(100% - 3rem)"}}>
                    {assignment.id}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{assignment.id}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <span className="font-medium text-gray-500 dark:text-gray-400">Created:</span>
            <span className="text-gray-800 dark:text-gray-200 ml-2">
              {format(new Date(assignment.createdAt), 'PPpp')}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-500 dark:text-gray-400">Status:</span>
            <span className="text-gray-800 dark:text-gray-200 ml-2">{assignment.status}</span>
          </div>
          <div>
            <span className="font-medium text-gray-500 dark:text-gray-400">Files:</span>
            <span className="text-gray-800 dark:text-gray-200 ml-2">
              {isLoading ? (
                <>
                  Loading...
                  <span className="inline-block ml-2 spin-pause">⏳</span>
                </>
              ) : (
                assignment.files.length
              )}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-500 dark:text-gray-400">Progress:</span>
            <div className="mt-1">
              <Progress 
                value={assignment.progress} 
                className="h-2 bg-gray-200 dark:bg-gray-700" 
                indicatorClassName={getProgressColor(assignment.progress)}
              />
            </div>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Placements</h3>
        <div className="space-y-2">
          {assignment.placements.map((placement) => (
            <div key={placement.id} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
              <div className="flex items-center mb-1">
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
                    indicatorClassName={getProgressColor(placement.progress)}
                  />
                </div>
              </div>
              {placement.processId && (
                <>
                  <hr className="my-2 border-gray-200 dark:border-gray-600" />
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
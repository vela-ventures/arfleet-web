import React from 'react';
import { Progress } from "@/components/ui/progress";
import { useArFleet } from '../contexts/ArFleetContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AssignmentDetails() {
  const { assignments, selectedAssignmentId } = useArFleet();
  const assignment = assignments.find(a => a.id === selectedAssignmentId);

  if (!assignment) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Select an assignment to view details</div>;
  }

  const getProgressColor = (progress: number) => {
    return progress === 100 ? "bg-green-500" : "bg-orange-400";
  };

  return (
    <div className="overflow-y-auto overflow-x-hidden">
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
            <span className="font-medium text-gray-500 dark:text-gray-400">Status:</span>
            <span className="text-gray-800 dark:text-gray-200 ml-2">{assignment.status}</span>
          </div>
          <div>
            <span className="font-medium text-gray-500 dark:text-gray-400">Files:</span>
            <span className="text-gray-800 dark:text-gray-200 ml-2">{assignment.files.length}</span>
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
            <div key={placement.id} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md flex items-center">
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
          ))}
        </div>
      </div>
    </div>
  );
}
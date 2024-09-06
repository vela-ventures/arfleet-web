import React, { useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { StorageAssignment } from '../types';
import { useArFleet } from '../contexts/ArFleetContext';

export default function StorageAssignmentList() {
  const { assignments, selectedAssignmentId, setSelectedAssignmentId, fetchAndProcessManifest, masterKey } = useArFleet();

  useEffect(() => {
    const sortedAssignments = [...assignments].sort((a, b) => b.createdAt - a.createdAt);
    if (!selectedAssignmentId && sortedAssignments.length > 0) {
      setSelectedAssignmentId(sortedAssignments[0].id);
    }
  }, [assignments, selectedAssignmentId, setSelectedAssignmentId]);

  const sortedAssignments = [...assignments].sort((a, b) => b.createdAt - a.createdAt);

  const handleSelectAssignment = (assignment: StorageAssignment) => {
    setSelectedAssignmentId(assignment.id);
    if (assignment.files.length === 0) {
      fetchAndProcessManifest(assignment, masterKey);
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <h2 className="text-lg font-semibold p-4">Assignments</h2>
      <ul>
        {sortedAssignments.map((assignment) => (
          <li
            key={assignment.id}
            className={cn(
              "p-4 cursor-pointer hover:bg-muted",
              selectedAssignmentId === assignment.id && "bg-muted"
            )}
            onClick={() => handleSelectAssignment(assignment)}
          >
            <p className="truncate" title={`Assignment ${assignment.id}`}>
              Assignment {assignment.id.slice(0, 8)}...
            </p>
            <p className="text-sm text-muted-foreground mb-2 truncate" title={assignment.status}>
              {assignment.status}
            </p>
            <div className="space-y-0.5">
              {assignment.placements.slice(0, 3).map((placement) => (
                <Progress 
                  key={placement.id}
                  value={placement.status === 'completed' ? 100 : placement.progress} 
                  className="h-1" 
                  indicatorClassName={cn(
                    "transition-all",
                    placement.status === 'completed' ? 'bg-green-500' :
                    placement.status === 'in_progress' ? 'bg-blue-500' :
                    'bg-yellow-500'
                  )}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
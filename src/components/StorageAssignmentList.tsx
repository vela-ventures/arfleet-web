import React, { useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { StorageAssignment } from '../types';
import { useArFleet } from '../contexts/ArFleetContext';
import { getProgressColorByPlacementStatus } from '@/helpers/progresscolor';

export default function StorageAssignmentList({ assignments, selectedAssignmentId, onSelectAssignment, fetchAndProcessManifest, masterKey }) {
  console.log('StorageAssignmentList rendering', assignments.length);
  console.log('selectedAssignmentId', selectedAssignmentId);

  const handleSelectAssignment = (assignment: StorageAssignment) => {
    onSelectAssignment(assignment.id);
    if (assignment.files.length === 0) {
      fetchAndProcessManifest(assignment, masterKey);
    }
  };

  useEffect(() => {
    if (selectedAssignmentId) {
      const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
      if (selectedAssignment && selectedAssignment.files.length === 0) {
        fetchAndProcessManifest(selectedAssignment, masterKey);
      }
    }
  }, [selectedAssignmentId, assignments, fetchAndProcessManifest, masterKey]);

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <h2 className="text-lg font-semibold p-4">Assignments ({assignments.length})</h2>
      <ul>
        {assignments.map((assignment) => (
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
                  indicatorClassName={getProgressColorByPlacementStatus(placement.status, assignment.status)}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
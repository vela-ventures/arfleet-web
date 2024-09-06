import React from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { StorageAssignment } from '../types';

interface StorageAssignmentListProps {
  assignments: StorageAssignment[];
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string) => void;
  fetchAndProcessManifest: (assignment: StorageAssignment, masterKey: Uint8Array | null) => Promise<void>;
  masterKey: Uint8Array | null;
}

export default function StorageAssignmentList({
  assignments,
  selectedAssignmentId,
  onSelectAssignment,
  fetchAndProcessManifest,
  masterKey,
}: StorageAssignmentListProps) {
  // console.log('StorageAssignmentList rendering', assignments.length);
  // console.log("Assignments in StorageAssignmentList:", assignments);
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <h2 className="text-lg font-semibold p-4">Assignments</h2>
      <ul>
        {assignments.map((assignment) => (
          <li
            key={assignment.id}
            className={cn(
              "p-4 cursor-pointer hover:bg-muted",
              selectedAssignmentId === assignment.id && "bg-muted"
            )}
            onClick={() => {
              onSelectAssignment(assignment.id);
              fetchAndProcessManifest(assignment, masterKey);
            }}
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
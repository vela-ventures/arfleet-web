import React from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { StorageAssignment } from '../types';

interface StorageAssignmentListProps {
  assignments: StorageAssignment[];
  selectedAssignment: StorageAssignment | null;
  onSelectAssignment: (assignment: StorageAssignment) => void;
}

export default function StorageAssignmentList({
  assignments,
  selectedAssignment,
  onSelectAssignment,
}: StorageAssignmentListProps) {
  return (
    <div className="w-64 border-r overflow-y-auto">
      <h2 className="text-lg font-semibold p-4">Assignments</h2>
      <ul>
        {assignments.map((assignment) => (
          <li
            key={assignment.id}
            className={cn(
              "p-4 cursor-pointer hover:bg-muted",
              selectedAssignment?.id === assignment.id && "bg-muted"
            )}
            onClick={() => onSelectAssignment(assignment)}
          >
            <p>Assignment {assignment.id.slice(0, 8)}...</p>
            <p className="text-sm text-muted-foreground mb-2">{assignment.status}</p>
            <div className="space-y-0.5">
              {assignment.placements.slice(0, 3).map((placement) => (
                <Progress 
                  key={placement.id}
                  value={placement.progress} 
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
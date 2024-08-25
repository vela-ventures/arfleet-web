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
            <p className="text-sm text-muted-foreground">{assignment.status}</p>
            <Progress value={assignment.progress} className="mt-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
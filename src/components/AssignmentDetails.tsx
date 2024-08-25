import React from 'react';
import { Progress } from "@/components/ui/progress";
import { StorageAssignment } from '../types';

interface AssignmentDetailsProps {
  assignment: StorageAssignment | null;
}

export default function AssignmentDetails({ assignment }: AssignmentDetailsProps) {
  if (!assignment) {
    return <div className="p-4">Select an assignment to view details</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Assignment Details</h2>
      <p>ID: {assignment.id}</p>
      <p>Status: {assignment.status}</p>
      <p>Files: {assignment.files.length}</p>
      <div className="mt-2">
        <p>Assignment Progress:</p>
        <Progress value={assignment.progress} className="mt-2" />
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2">Placements</h3>
      {assignment.placements.map((placement) => (
        <div key={placement.id} className="mb-4">
          <p>{placement.provider}</p>
          <p>Status: {placement.status}</p>
          <Progress value={placement.progress} className="mt-2" />
        </div>
      ))}
    </div>
  );
}
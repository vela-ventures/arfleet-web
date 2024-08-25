import React from 'react';
import { Progress } from "@/components/ui/progress";

interface StorageAssignment {
  id: string;
  files: File[];
  status: 'processing' | 'uploading' | 'completed' | 'error';
}

interface Placement {
  id: string;
  provider: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
}

interface AssignmentDetailsProps {
  assignment: StorageAssignment | null;
}

export default function AssignmentDetails({ assignment }: AssignmentDetailsProps) {
  // Mock placements data (replace with actual data later)
  const placements: Placement[] = [
    { id: '1', provider: 'Provider A', status: 'uploading', progress: 45 },
    { id: '2', provider: 'Provider B', status: 'pending', progress: 0 },
  ];

  if (!assignment) {
    return <div className="p-4">Select an assignment to view details</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Assignment Details</h2>
      <p>ID: {assignment.id}</p>
      <p>Status: {assignment.status}</p>
      <p>Files: {assignment.files.length}</p>

      <h3 className="text-lg font-semibold mt-6 mb-2">Placements</h3>
      {placements.map((placement) => (
        <div key={placement.id} className="mb-4">
          <p>{placement.provider}</p>
          <p>Status: {placement.status}</p>
          <Progress value={placement.progress} className="mt-2" />
        </div>
      ))}
    </div>
  );
}
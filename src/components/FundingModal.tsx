import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Wallet, Loader2, Info, Check } from "lucide-react";
import { Placement, StorageAssignment } from '@/contexts/ArFleetContext';

interface FundingModalProps {
  isOpen: boolean;
  placement: Placement | null;
  assignment: StorageAssignment | null;
}

const FundingModal: React.FC<FundingModalProps> = ({ isOpen, placement, assignment }) => {
  if (!placement || !assignment) return null;

  const signed = assignment.fundingDealQueue.numProcessed;
  const total = assignment.placements.length;

  const outcomes = [];
  for (let i = 0; i < total; i++) {
    if (i < signed) {
        outcomes.push('success');
    } else if (i === signed) {
        outcomes.push('signing');
    } else {
        outcomes.push('blank');
    }
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[425px] flex flex-col items-center text-center">
        <Wallet className="h-12 w-12 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">Funding Required</h2>
        <p className="text-lg mb-4">
          Please sign the transaction in your wallet to fund the deal.
        </p>
        <div className="w-full bg-muted p-3 rounded-md mb-4">
          <p className="text-sm text-muted-foreground mb-1">Placement ID:</p>
          <div className="bg-background p-2 rounded border text-sm text-muted-foreground font-mono break-all">
            {placement!.id}
          </div>
        </div>

        <div className="w-full space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span>Signature Progress</span>
            <span className="font-medium">{signed} of {total} signed</span>
          </div>
          <div className="flex justify-between space-x-2">
            {outcomes.map((outcome, index) => {
              const isSigned = outcome === 'success';
              const isPending = outcome === 'signing';
              return (
                <div
                  key={index}
                  className={`relative flex-1 h-12 rounded-md flex items-center justify-center ${
                    isSigned ? 'bg-green-500' : 
                    isPending ? 'bg-orange-500' : 
                    'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span className="text-2xl font-bold text-white drop-shadow-md">{index + 1}</span>
                  <div className="absolute right-1 bottom-1">
                    {isSigned && <Check className="text-white h-4 w-4" />}
                    {isPending && <Loader2 className="text-white h-4 w-4 animate-spin" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-6 text-left">
          <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Note that you might need to sign multiple transactions - one for each deal.
          </p>
        </div>

        {/* <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" /> */}
        {/* <div className="w-full space-y-2">
          <div className="flex justify-between text-sm">
            <span>Transaction Progress</span>
            <span className="font-medium">
              {signCount === signTotal ? 'Processing' : 'Awaiting Signature'}
            </span>
          </div>
          <Progress value={(signCount / signTotal) * 100} className="h-2" />
        </div> */}
      </DialogContent>
    </Dialog>
  );
};

export default FundingModal;
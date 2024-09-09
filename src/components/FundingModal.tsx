import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Wallet, Loader2, Info } from "lucide-react";

interface FundingModalProps {
  isOpen: boolean;
  placementId: string | null;
}

const FundingModal: React.FC<FundingModalProps> = ({ isOpen, placementId }) => {
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
            {placementId}
          </div>
        </div>
        <div className="flex items-start bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-6 text-left">
          <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Note that you might need to sign multiple transactions - one for each deal.
          </p>
        </div>
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <div className="w-full space-y-2">
          <div className="flex justify-between text-sm">
            <span>Transaction Progress</span>
            <span className="font-medium">Awaiting Signature</span>
          </div>
          <Progress value={33} className="h-2" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FundingModal;
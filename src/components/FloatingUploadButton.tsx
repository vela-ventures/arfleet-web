import React, { useState, useEffect, useRef } from 'react';
import { Plus, FileUp, FolderUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FloatingUploadButtonProps {
  onFileSelect: (e: React.MouseEvent) => void;
  onDirSelect: (e: React.MouseEvent) => void;
}

const FloatingUploadButton: React.FC<FloatingUploadButtonProps> = ({ onFileSelect, onDirSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonGroupRef.current && !buttonGroupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFileSelect = (e: React.MouseEvent) => {
    setIsOpen(false);
    onFileSelect(e);
  };

  const handleDirSelect = (e: React.MouseEvent) => {
    setIsOpen(false);
    onDirSelect(e);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={buttonGroupRef}>
      <AnimatePresence>
        {isOpen && (
          <>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-20 right-0 p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg"
                    onClick={handleFileSelect}
                  >
                    <FileUp size={24} />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="left" align="center" sideOffset={5}>
                  <p>Upload File</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="absolute bottom-36 right-0 p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg"
                    onClick={handleDirSelect}
                  >
                    <FolderUp size={24} />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="left" align="center" sideOffset={5}>
                  <p>Upload Folder</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </AnimatePresence>

      <motion.button
        className={cn(
          "p-4 rounded-full shadow-lg",
          isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        )}
        onClick={toggleOpen}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Plus size={24} />
      </motion.button>
    </div>
  );
};

export default FloatingUploadButton;
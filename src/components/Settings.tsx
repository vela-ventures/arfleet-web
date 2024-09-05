import React, { useState, useEffect, useCallback } from 'react';
import { useArFleet } from '../contexts/ArFleetContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm, FormProvider } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react"; // Import X icon for delete button
import { Separator } from "@/components/ui/separator";
import { useNavigate } from 'react-router-dom';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

export default function Settings() {
  const { settings, updateSettings, resetSettingsToDefault } = useArFleet();
  const [providers, setProviders] = useState(settings.providers);
  const [newProvider, setNewProvider] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const methods = useForm({
    defaultValues: {
      newProvider: '',
    },
  });

  // Update local state when settings change
  useEffect(() => {
    setProviders(settings.providers);
  }, [settings]);

  const handleAddProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProvider && !providers.includes(newProvider)) {
      setProviders([...providers, newProvider]);
      setNewProvider('');
    }
  };

  const handleRemoveProvider = (provider: string) => {
    setProviders(providers.filter(p => p !== provider));
  };

  const handleSave = () => {
    updateSettings({ providers });
    
    toast({
      variant: "success",
      title: "Settings saved",
      description: "Your changes have been successfully saved.",
    });
  };

  const handleReset = () => {
    resetSettingsToDefault();
    setNewProvider('');
    
    toast({
      variant: "info",
      title: "Settings reset",
      description: "Settings have been reset to default values.",
    });
  };

  return (
    <div className="flex flex-col relative p-4">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <FormProvider {...methods}>
            <form onSubmit={handleAddProvider}>
              <FormField
                control={methods.control}
                name="newProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Add Provider:</FormLabel>
                    <FormControl>
                      <div className="flex space-x-2">
                        <Input 
                          {...field} 
                          value={newProvider}
                          onChange={(e) => setNewProvider(e.target.value)}
                          placeholder="Enter provider name"
                        />
                        <Button type="submit">Add</Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </FormProvider>
          
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Current Providers:</h3>
            <ul className="space-y-2 mb-6">
              {providers.map((provider, index) => (
                <li key={index} className="flex items-center justify-between bg-secondary p-2 rounded">
                  <span>{provider}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveProvider(provider)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          
          <Separator className="my-6" />
          
          <div className="flex justify-between items-center">
            <Button onClick={handleReset} variant="outline" className="mr-4">
              Reset to Default
            </Button>
            <Button onClick={handleSave} variant="default" className="ml-4">Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState } from 'react';
import { useArFleet } from '../contexts/ArFleetContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm, FormProvider } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { settings, updateSettings } = useArFleet();
  const [providers, setProviders] = useState(settings.providers.join(', '));
  const { toast } = useToast();

  const methods = useForm({
    defaultValues: {
      providers: providers,
    },
  });

  const handleSave = (data) => {
    const providersArray = data.providers.split(',').map(provider => provider.trim());
    updateSettings({ providers: providersArray });
    
    toast({
      variant: "success",
      title: "Settings saved",
      description: "Your changes have been successfully saved.",
    })
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
            <form onSubmit={methods.handleSubmit(handleSave)}>
              <FormField
                control={methods.control}
                name="providers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Use Providers:</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-4">Save</Button>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
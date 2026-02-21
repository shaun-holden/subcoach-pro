import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Building2, MapPin, Phone, Save } from "lucide-react";

const formSchema = z.object({
  gymName: z.string().min(1, "Gym name is required"),
  phone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
});

type FormData = z.infer<typeof formSchema>;

interface GymProfileFormProps {
  ownerProfile?: any;
  onSave?: () => void;
}

export default function GymProfileForm({ ownerProfile, onSave }: GymProfileFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [showDraftIndicator, setShowDraftIndicator] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gymName: ownerProfile?.gymName || "",
      phone: ownerProfile?.phone || "",
      address: ownerProfile?.address || "",
    },
  });

  // Load saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gym-profile-draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        form.reset(parsed);
        setShowDraftIndicator(true);
      }
    } catch (error) {
      console.error('Error loading saved draft:', error);
    }
  }, [form, ownerProfile]);

  // Auto-save form data to localStorage
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Only save if there's actual data
      if (data.gymName || data.phone || data.address) {
        localStorage.setItem('gym-profile-draft', JSON.stringify(data));
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleClearDraft = () => {
    localStorage.removeItem('gym-profile-draft');
    setShowDraftIndicator(false);
    form.reset({
      gymName: ownerProfile?.gymName || "",
      phone: ownerProfile?.phone || "",
      address: ownerProfile?.address || "",
    });
    toast({
      title: "Draft Cleared",
      description: "Form has been reset to saved profile data.",
    });
  };

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem('gym-profile-draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        form.reset(parsed);
        toast({
          title: "Draft Restored", 
          description: "Your saved changes have been restored.",
        });
      }
    } catch (error) {
      console.error('Error restoring draft:', error);
    }
  };

  const saveProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      try {
        const response = await apiRequest('/api/owners/profile', 'POST', data);
        return await response.json();
      } catch (error) {
        console.error("API request error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/owner-profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/owners/profile'] });
      toast({
        title: "Success",
        description: "Gym profile updated successfully!",
      });
      // Clear any saved draft after successful save
      localStorage.removeItem('gym-profile-draft');
      setShowDraftIndicator(false);
      onSave?.();
    },
    onError: (error) => {
      console.error("Mutation error:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save gym profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await saveProfileMutation.mutateAsync(data);
    } catch (error) {
      console.error("Form submission error:", error);
      // Error handling is already managed by the mutation's onError callback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Building2 className="mr-2 h-5 w-5" />
          Gym Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Draft Indicator */}
        {showDraftIndicator && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  You have unsaved changes
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRestoreDraft}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  Restore Draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearDraft}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear Draft
                </Button>
              </div>
            </div>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Gym Name */}
              <FormField
                control={form.control}
                name="gymName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Building2 className="mr-2 h-4 w-4" />
                      Gym Name *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        data-testid="input-gym-name"
                        placeholder="Your Gym Name" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Phone className="mr-2 h-4 w-4" />
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <Input 
                        data-testid="input-phone"
                        type="tel"
                        placeholder="(555) 123-4567" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4" />
                      Gym Address *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        data-testid="textarea-address"
                        placeholder="123 Main Street, City, State 12345" 
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Provide the full address including street, city, state, and zip code
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-6">
              <Button
                data-testid="button-save-gym-profile"
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-500 hover:bg-brand-600"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Gym Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
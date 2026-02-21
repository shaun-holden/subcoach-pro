import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Building2, MapPin, Phone, Edit, Save } from "lucide-react";

const profileSchema = z.object({
  gymName: z.string().min(1, "Gym name is required"),
  phone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
});

type ProfileData = z.infer<typeof profileSchema>;

interface GymProfileDisplayProps {
  ownerProfile?: any;
  onSave?: () => void;
}

export default function GymProfileDisplay({ ownerProfile, onSave }: GymProfileDisplayProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      gymName: ownerProfile?.gymName || "",
      phone: ownerProfile?.phone || "",
      address: ownerProfile?.address || "",
    },
  });

  // Reset form when owner profile changes or dialog opens
  useEffect(() => {
    if (ownerProfile) {
      form.reset({
        gymName: ownerProfile.gymName || "",
        phone: ownerProfile.phone || "",
        address: ownerProfile.address || "",
      });
    }
  }, [ownerProfile, form]);

  // Additional reset when dialog opens to ensure fresh data
  useEffect(() => {
    if (isEditingProfile && ownerProfile) {
      form.reset({
        gymName: ownerProfile.gymName || "",
        phone: ownerProfile.phone || "",
        address: ownerProfile.address || "",
      });
    }
  }, [isEditingProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      try {
        const response = await apiRequest('/api/owners/profile', 'POST', data);
        return await response.json();
      } catch (error) {
        console.error("API request error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/owners/profile'] });
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      setIsEditingProfile(false);
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
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProfileData) => {
    console.log("Form submitted with data:", data);
    console.log("Current owner profile:", ownerProfile);
    setIsLoading(true);
    try {
      await updateProfileMutation.mutateAsync(data);
    } catch (error) {
      console.error("Form submission error:", error);
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
        <div className="space-y-6">
          {/* Gym Name */}
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">Gym Name</div>
              <div className="text-lg font-semibold text-gray-900">
                {ownerProfile?.gymName || "Not set"}
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">Phone Number</div>
              <div className="text-lg text-gray-900">
                {ownerProfile?.phone || "Not provided"}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">Address</div>
              <div className="text-lg text-gray-900 mb-2">
                {ownerProfile?.address || "Not set"}
              </div>
            </div>
          </div>

          {/* Edit Profile Button */}
          <div className="pt-4 border-t">
            <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  data-testid="button-edit-profile"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Gym Profile</DialogTitle>
                  <DialogDescription>
                    Update your gym's information
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                              placeholder="Enter your gym name" 
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
                              placeholder="Enter your gym's phone number" 
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
                            <Input 
                              data-testid="input-address"
                              placeholder="Enter your gym's full address" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1"
                        data-testid="button-save-profile"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isLoading ? "Saving..." : "Save Profile"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditingProfile(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DraftSavingIndicator } from "./DraftSavingIndicator";
import { isUnauthorizedError } from "@/lib/authUtils";
import { DollarSign, MapPin, CreditCard, Save, Upload, FileText, Mail, Trash2 } from "lucide-react";
import { ObjectUploader } from "./ObjectUploader";
import type { UploadResult } from "@uppy/core";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  maxTravelDistance: z.string().min(1, "Travel distance is required"),
  paymentMethods: z.array(z.string()).min(1, "Select at least one payment method"),
  paymentDetails: z.object({
    checkNumber: z.string().optional(),
    paypalHandle: z.string().optional(),
    venmoHandle: z.string().optional(),
    zelleContact: z.string().optional(),
  }).optional(),
  form1099Path: z.string().optional(),
  emailToGymOwners: z.string().email("Enter a valid email address").optional(),
  certifications: z.array(z.string()).optional().default([]),
  certificationDetails: z.object({
    usag: z.object({
      membershipNumber: z.string().optional(),
      expirationDate: z.string().optional(),
    }).optional(),
    aau: z.object({
      membershipNumber: z.string().optional(),
      expirationDate: z.string().optional(),
    }).optional(),
    nga: z.object({
      membershipNumber: z.string().optional(),
      expirationDate: z.string().optional(),
    }).optional(),
  }).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CoachProfileFormProps {
  coachProfile?: any;
  onSave?: () => void;
}

export default function CoachProfileForm({ coachProfile, onSave }: CoachProfileFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const STORAGE_KEY = 'coach-profile-form-data';

  const paymentOptions = [
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'check', label: 'Check', icon: '✅' },
    { id: 'paypal', label: 'PayPal', icon: '💙' },
    { id: 'venmo', label: 'Venmo', icon: '💜' },
    { id: 'zelle', label: 'Zelle', icon: '🏦' },
  ];

  // Get saved form data from localStorage
  const getSavedFormData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // Save form data to localStorage
  const saveFormData = (data: Partial<FormData>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('Draft saved successfully to localStorage');
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error);
      toast({
        title: "Draft Save Failed",
        description: "Unable to save draft. Your changes may be lost.",
        variant: "destructive",
      });
    }
  };

  // Get initial values with priority: saved data > coachProfile > defaults
  const getInitialValues = () => {
    const savedData = getSavedFormData();
    
    return {
      firstName: savedData?.firstName || coachProfile?.firstName || "",
      lastName: savedData?.lastName || coachProfile?.lastName || "",
      phone: savedData?.phone || coachProfile?.phone || "",
      address: savedData?.address || coachProfile?.address || "",
      hourlyRate: savedData?.hourlyRate || coachProfile?.hourlyRate || "",
      maxTravelDistance: savedData?.maxTravelDistance || coachProfile?.maxTravelDistance?.toString() || "15",
      paymentMethods: savedData?.paymentMethods || coachProfile?.paymentMethods || [],
      paymentDetails: {
        checkNumber: savedData?.paymentDetails?.checkNumber || coachProfile?.paymentDetails?.checkNumber || "",
        paypalHandle: savedData?.paymentDetails?.paypalHandle || coachProfile?.paymentDetails?.paypalHandle || "",
        venmoHandle: savedData?.paymentDetails?.venmoHandle || coachProfile?.paymentDetails?.venmoHandle || "",
        zelleContact: savedData?.paymentDetails?.zelleContact || coachProfile?.paymentDetails?.zelleContact || "",
      },
      form1099Path: savedData?.form1099Path || coachProfile?.form1099Path || "",
      emailToGymOwners: savedData?.emailToGymOwners || coachProfile?.emailToGymOwners || "",
      certifications: savedData?.certifications || coachProfile?.certifications || [],
      certificationDetails: {
        usag: savedData?.certificationDetails?.usag || coachProfile?.certificationDetails?.usag || { membershipNumber: '', expirationDate: '' },
        aau: savedData?.certificationDetails?.aau || coachProfile?.certificationDetails?.aau || { membershipNumber: '', expirationDate: '' },
        nga: savedData?.certificationDetails?.nga || coachProfile?.certificationDetails?.nga || { membershipNumber: '', expirationDate: '' },
      },
    };
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues(),
  });

  // Save form data to localStorage whenever form values change
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change' && value) {
        console.log(`Form field changed: ${name}, saving draft...`);
        saveFormData(value as FormData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, toast]);

  const saveProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const submissionData = {
        ...data,
        hourlyRate: data.hourlyRate,
        maxTravelDistance: parseInt(data.maxTravelDistance) || 15,
      };
      const response = await apiRequest('/api/coach/profile', 'POST', submissionData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      toast({
        title: "Success",
        description: "Profile saved successfully!",
      });
      localStorage.removeItem(STORAGE_KEY);
      onSave?.();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Please log in again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to save profile",
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = async (data: FormData) => {
    saveProfileMutation.mutate(data);
  };

  // Clear saved form data (utility function for future use)
  const clearSavedData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Reset form to original defaults
      form.reset(getInitialValues());
    } catch {
      // Silently fail if localStorage is not available
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DraftSavingIndicator isEnabled={true} storageKey={STORAGE_KEY} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="mr-2 h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-coach-firstName"
                              placeholder="Enter first name" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-coach-lastName"
                              placeholder="Enter last name" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-coach-phone"
                              placeholder="(555) 123-4567" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                              <Input 
                                data-testid="input-coach-hourly-rate"
                                type="number" 
                                placeholder="50" 
                                className="pl-10"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-coach-address"
                            placeholder="123 Coach Street, Fitness City, FC 12345" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Travel Preferences */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Travel Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="maxTravelDistance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum travel distance</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-travel-distance" className="w-full">
                            <SelectValue placeholder="Select travel distance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">Within 5 miles</SelectItem>
                            <SelectItem value="10">Within 10 miles</SelectItem>
                            <SelectItem value="25">Within 25 miles</SelectItem>
                            <SelectItem value="50">Within 50 miles</SelectItem>
                            <SelectItem value="75">Within 75 miles</SelectItem>
                            <SelectItem value="100">Within 100 miles</SelectItem>
                            <SelectItem value="150">Within 150 miles</SelectItem>
                            <SelectItem value="unlimited">No limit</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">Select your preferred payment methods</p>
                
                <FormField
                  control={form.control}
                  name="paymentMethods"
                  render={() => (
                    <FormItem>
                      <div className="space-y-3">
                        {paymentOptions.map((option) => (
                          <div key={option.id} className="space-y-2">
                            <FormField
                              control={form.control}
                              name="paymentMethods"
                              render={({ field }) => {
                                return (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        data-testid={`checkbox-payment-${option.id}`}
                                        checked={field.value?.includes(option.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, option.id])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== option.id
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <div className="flex items-center space-x-2">
                                      <span>{option.icon}</span>
                                      <FormLabel className="text-sm font-normal">
                                        {option.label}
                                      </FormLabel>
                                    </div>
                                  </FormItem>
                                )
                              }}
                            />
                            
                            {/* Payment Details Fields */}
                            <FormField
                              control={form.control}
                              name="paymentMethods"
                              render={({ field }) => {
                                if (!field.value?.includes(option.id)) {
                                  return <div></div>;
                                }
                                
                                return (
                                  <div className="ml-6">
                                    {option.id === 'check' && (
                                      <FormField
                                        control={form.control}
                                        name="paymentDetails.checkNumber"
                                        render={({ field: detailField }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                data-testid="input-check-number"
                                                placeholder="Check number"
                                                className="text-sm"
                                                {...detailField}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                    
                                    {option.id === 'paypal' && (
                                      <FormField
                                        control={form.control}
                                        name="paymentDetails.paypalHandle"
                                        render={({ field: detailField }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                data-testid="input-paypal-handle"
                                                placeholder="PayPal handle"
                                                className="text-sm"
                                                {...detailField}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                    
                                    {option.id === 'venmo' && (
                                      <FormField
                                        control={form.control}
                                        name="paymentDetails.venmoHandle"
                                        render={({ field: detailField }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                data-testid="input-venmo-handle"
                                                placeholder="Venmo handle"
                                                className="text-sm"
                                                {...detailField}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                    
                                    {option.id === 'zelle' && (
                                      <FormField
                                        control={form.control}
                                        name="paymentDetails.zelleContact"
                                        render={({ field: detailField }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                data-testid="input-zelle-contact"
                                                placeholder="Phone number or email"
                                                className="text-sm"
                                                {...detailField}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                  </div>
                                );
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Settings Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Profile & Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="emailToGymOwners"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Mail className="mr-2 h-4 w-4" />
                        Email to Gym Owners
                      </FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-email-gym-owners" 
                          type="email"
                          placeholder="your.email@example.com" 
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Email address for gym owners to contact you directly
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel className="flex items-center">
                    <Upload className="mr-2 h-4 w-4" />
                    1099 Form Upload
                  </FormLabel>
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760} // 10MB
                    allowedFileTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/webp']}
                    uploadMethods={['modal']}
                    onGetUploadParameters={async () => {
                      const response = await fetch('/api/objects/upload', {
                        method: 'POST',
                        credentials: 'include'
                      });
                      const data = await response.json();
                      return {
                        method: 'PUT' as const,
                        url: data.uploadURL,
                      };
                    }}
                    onComplete={(result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                      if (result.successful && result.successful.length > 0) {
                        const uploadURL = result.successful[0].uploadURL;
                        // Update form with file path
                        form.setValue("form1099Path", uploadURL);
                        
                        // Send to backend to set ACL and update profile
                        fetch('/api/1099/upload', {
                          method: 'PUT',
                          credentials: 'include',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ fileURL: uploadURL }),
                        }).then(() => {
                          toast({
                            title: "Success",
                            description: "1099 form uploaded successfully!",
                          });
                        }).catch(() => {
                          toast({
                            title: "Error",
                            description: "Failed to save 1099 form",
                            variant: "destructive",
                          });
                        });
                      }
                    }}
                    onProgress={(progress) => {
                      console.log(`Upload progress: ${progress}%`);
                    }}
                    buttonClassName="w-full"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="h-4 w-4" />
                      <span>Upload 1099 Form</span>
                    </div>
                  </ObjectUploader>
                  <p className="text-sm text-muted-foreground">
                    Upload your 1099 tax form - PDF, JPEG, PNG, or WebP format (max 10MB)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click the button to open file upload dialog
                  </p>
                  {form.watch("form1099Path") && (
                    <p className="text-sm text-green-600">
                      ✓ 1099 form uploaded successfully
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 space-y-3">
              <div className="flex gap-3">
                <Button
                  data-testid="button-save-draft"
                  type="button"
                  onClick={() => {
                    const currentValues = form.getValues();
                    saveFormData(currentValues);
                    toast({
                      title: "Draft Saved",
                      description: "Your profile changes have been saved as a draft.",
                    });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
                
                <Button
                  data-testid="button-clear-draft"
                  type="button"
                  onClick={() => {
                    clearSavedData();
                    toast({
                      title: "Draft Cleared",
                      description: "Your saved draft has been cleared.",
                    });
                  }}
                  variant="outline"
                  className="px-3"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <Button
                data-testid="button-save-coach-profile"
                type="submit"
                disabled={saveProfileMutation.isPending}
                className="w-full bg-brand-500 hover:bg-brand-600"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}

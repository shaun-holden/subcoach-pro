import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Send, Save, Edit3, FileText, Trash2 } from "lucide-react";

const formSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  daysOfWeek: z.array(z.string()).optional(),
  maxTravelDistance: z.string().min(1, "Travel distance is required"),
  rateOffer: z.string().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SubstituteRequestFormProps {
  onSuccess?: (data?: any) => void;
  initialData?: any;
  isEditing?: boolean;
  submitButtonText?: string;
  disabled?: boolean;
}

export default function SubstituteRequestForm({ 
  onSuccess, 
  initialData, 
  isEditing = false, 
  submitButtonText,
  disabled = false 
}: SubstituteRequestFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showDraftIndicator, setShowDraftIndicator] = useState(false);

  const eventTypes = [
    "Recreation",
    "Team", 
    "Ninja"
  ];

  const daysOfWeek = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' },
  ];

  // Get saved draft data
  const getSavedDraft = () => {
    try {
      const saved = localStorage.getItem('substitute-request-draft');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const getInitialValues = () => {
    const savedDraft = getSavedDraft();
    
    // Priority: initialData (editing) > savedDraft > defaults
    if (initialData) {
      return {
        eventType: initialData.eventType || "",
        startDate: initialData.startDate || "",
        endDate: initialData.endDate || "",
        startTime: initialData.startTime || "",
        endTime: initialData.endTime || "",
        daysOfWeek: initialData.daysOfWeek || [],
        maxTravelDistance: initialData.maxTravelDistance?.toString() || "",
        rateOffer: initialData.rateOffer?.toString() || "",
        description: initialData.description || "",
      };
    }
    
    if (savedDraft && !isEditing) {
      return {
        eventType: savedDraft.eventType || "",
        startDate: savedDraft.startDate || "",
        endDate: savedDraft.endDate || "",
        startTime: savedDraft.startTime || "",
        endTime: savedDraft.endTime || "",
        daysOfWeek: savedDraft.daysOfWeek || [],
        maxTravelDistance: savedDraft.maxTravelDistance || "10",
        rateOffer: savedDraft.rateOffer || "",
        description: savedDraft.description || "",
      };
    }
    
    return {
      eventType: "",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      daysOfWeek: [],
      maxTravelDistance: "10",
      rateOffer: "",
      description: "",
    };
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues(),
  });

  // Check if there's a saved draft on component mount
  useEffect(() => {
    const savedDraft = getSavedDraft();
    setShowDraftIndicator(!!savedDraft && !isEditing);
  }, [isEditing]);

  const loadDraft = () => {
    const savedDraft = getSavedDraft();
    if (savedDraft) {
      form.reset(savedDraft);
      toast({
        title: "Draft Loaded",
        description: "Your saved draft has been loaded successfully.",
      });
      setShowDraftIndicator(false);
    }
  };

  const deleteDraft = () => {
    localStorage.removeItem('substitute-request-draft');
    setShowDraftIndicator(false);
    toast({
      title: "Draft Deleted",
      description: "Your saved draft has been deleted.",
    });
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);
      
      if (isEditing) {
        // For editing mode, call onSuccess with the data
        onSuccess?.(data);
      } else {
        // Create new request via API
        const requestData = {
          ...data,
          maxTravelDistance: parseInt(data.maxTravelDistance),
          rateOffer: data.rateOffer ? parseFloat(data.rateOffer) : undefined,
        };

        await apiRequest("/api/owner-requests", "POST", requestData);
        
        toast({
          title: "Success",
          description: "Substitute request created and moved to active status!",
        });
        
        form.reset();
        // Clear saved draft after successful submission
        localStorage.removeItem('substitute-request-draft');
        
        // Force refresh of requests data
        if (onSuccess) {
          await onSuccess();
        }
      }
    } catch (error: any) {
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
      
      // Handle payment method required error (HTTP 402)
      if (error.message?.includes('402') || error.status === 402 || error.requiresBilling) {
        toast({
          title: "Payment Method Required",
          description: "Please add a payment method before creating requests.",
          variant: "destructive",
        });
        // Redirect to billing page after a short delay
        setTimeout(() => {
          window.location.href = "/billing";
        }, 2000);
        return;
      }
      
      toast({
        title: "Error",
        description: isEditing ? "Failed to update request" : "Failed to create request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Draft Indicator */}
        {showDraftIndicator && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  You have a saved draft
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={loadDraft}
                  className="h-8 text-xs"
                >
                  Load Draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={deleteDraft}
                  className="h-8 text-xs text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue placeholder="Select event type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eventTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                

              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-start-date"
                          type="date" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (if multiple days)</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-end-date"
                          type="date" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-start-time"
                          type="time" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input 
                          data-testid="input-end-time"
                          type="time" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Days of Week */}
              <FormField
                control={form.control}
                name="daysOfWeek"
                render={() => (
                  <FormItem>
                    <FormLabel>Days of the week (if recurring)</FormLabel>
                    <div className="grid grid-cols-7 gap-2">
                      {daysOfWeek.map((day) => (
                        <FormField
                          key={day.id}
                          control={form.control}
                          name="daysOfWeek"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day.id}
                                className="flex flex-col items-center space-y-1"
                              >
                                <FormControl>
                                  <Checkbox
                                    data-testid={`checkbox-day-${day.id}`}
                                    checked={field.value?.includes(day.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), day.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-xs text-gray-600">
                                  {day.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Travel Requirements */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Travel Requirements</h2>
              
              <FormField
                control={form.control}
                name="maxTravelDistance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum distance coaches should travel</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid grid-cols-2 md:grid-cols-4 gap-3"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem data-testid="radio-travel-5" value="5" id="travel-5" />
                          <Label htmlFor="travel-5">5 miles</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem data-testid="radio-travel-10" value="10" id="travel-10" />
                          <Label htmlFor="travel-10">10 miles</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem data-testid="radio-travel-25" value="25" id="travel-25" />
                          <Label htmlFor="travel-25">25 miles</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem data-testid="radio-travel-50" value="50" id="travel-50" />
                          <Label htmlFor="travel-50">50+ miles</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Rate Offer */}
              <FormField
                control={form.control}
                name="rateOffer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Offer ($/hour) - Optional</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-rate-offer"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g., 25.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Details */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Details</FormLabel>
                  <FormControl>
                    <Textarea 
                      data-testid="textarea-description"
                      rows={4}
                      placeholder="Provide any additional information about the role, requirements, or expectations..."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              {!isEditing && (
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={isLoading || disabled}
                  onClick={() => {
                    const currentValues = form.getValues();
                    try {
                      localStorage.setItem('substitute-request-draft', JSON.stringify({
                        ...currentValues,
                        lastSaved: new Date().toISOString()
                      }));
                      console.log('Draft saved successfully to localStorage');
                      toast({
                        title: "Draft Saved",
                        description: "Your substitute request has been saved as a draft.",
                      });
                    } catch (error) {
                      console.error('Failed to save draft:', error);
                      toast({
                        title: "Draft Save Failed",
                        description: "Unable to save draft. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
              )}
              <Button 
                data-testid={isEditing ? "button-update-request" : "button-post-request"}
                type="submit"
                disabled={isLoading || disabled}
                className="bg-brand-500 hover:bg-brand-600"
              >
                {isEditing ? (
                  <>
                    <Edit3 className="mr-2 h-4 w-4" />
                    {submitButtonText || (isLoading ? "Updating..." : "Update Request")}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {isLoading ? "Posting..." : "Post Request"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

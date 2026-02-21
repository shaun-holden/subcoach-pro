import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, User, AlertTriangle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  eventType: 'substitute_request' | 'coaching_session' | 'availability' | 'blocked_time';
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  location?: string;
  coachName?: string;
  gymName?: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent;
  selectedDate?: Date;
  onSave?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  userType?: 'coach' | 'owner';
  isEditing?: boolean;
}

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  eventType: z.enum(['substitute_request', 'coaching_session', 'availability', 'blocked_time']),
  status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed']),
  location: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

export function EventModal({ 
  isOpen, 
  onClose, 
  event, 
  selectedDate, 
  onSave, 
  onDelete,
  userType = 'coach',
  isEditing = false 
}: EventModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event?.title || "",
      description: event?.description || "",
      startTime: event?.startTime ? format(event.startTime, 'HH:mm') : "09:00",
      endTime: event?.endTime ? format(event.endTime, 'HH:mm') : "10:00",
      eventType: event?.eventType || 'coaching_session',
      status: event?.status || 'scheduled',
      location: event?.location || "",
    },
  });

  const eventTypeOptions = [
    { value: 'substitute_request', label: 'Substitute Request', color: 'blue' },
    { value: 'coaching_session', label: 'Coaching Session', color: 'purple' },
    { value: 'availability', label: 'Available Time', color: 'green' },
    { value: 'blocked_time', label: 'Blocked Time', color: 'gray' },
  ];

  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled', color: 'blue' },
    { value: 'confirmed', label: 'Confirmed', color: 'green' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' },
    { value: 'completed', label: 'Completed', color: 'gray' },
  ];

  const handleSave = async (data: EventFormData) => {
    try {
      setIsLoading(true);
      
      const eventDate = selectedDate || (event ? event.startTime : new Date());
      const [startHour, startMinute] = data.startTime.split(':').map(Number);
      const [endHour, endMinute] = data.endTime.split(':').map(Number);
      
      const startTime = new Date(eventDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date(eventDate);
      endTime.setHours(endHour, endMinute, 0, 0);

      if (endTime <= startTime) {
        toast({
          title: "Invalid Time",
          description: "End time must be after start time",
          variant: "destructive",
        });
        return;
      }

      const eventData: CalendarEvent = {
        ...event,
        title: data.title,
        description: data.description,
        startTime,
        endTime,
        eventType: data.eventType,
        status: data.status,
        location: data.location,
      };

      onSave?.(eventData);
      onClose();
      
      toast({
        title: "Success",
        description: isEditing ? "Event updated successfully" : "Event created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    
    try {
      setIsLoading(true);
      onDelete?.(event.id);
      onClose();
      
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEventTypeColor = (type: string) => {
    const option = eventTypeOptions.find(opt => opt.value === type);
    return option?.color || 'gray';
  };

  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.color || 'gray';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              {isEditing ? "Edit Event" : event ? "Event Details" : "Create Event"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Event Details (View Mode) */}
        {event && !isEditing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">{event.title}</h3>
              <Badge variant="secondary" className={`bg-${getEventTypeColor(event.eventType)}-100 text-${getEventTypeColor(event.eventType)}-800`}>
                {eventTypeOptions.find(opt => opt.value === event.eventType)?.label}
              </Badge>
              <Badge variant="secondary" className={`bg-${getStatusColor(event.status)}-100 text-${getStatusColor(event.status)}-800`}>
                {statusOptions.find(opt => opt.value === event.status)?.label}
              </Badge>
            </div>

            {event.description && (
              <p className="text-gray-600 dark:text-gray-400">{event.description}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{format(event.startTime, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>{format(event.startTime, 'h:mm a')} - {format(event.endTime, 'h:mm a')}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span>{event.location}</span>
                </div>
              )}
              {(event.coachName || event.gymName) && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>{event.coachName || event.gymName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Event Form (Create/Edit Mode) */}
        {(!event || isEditing) && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-event-title"
                          placeholder="Enter event title..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eventTypeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Location (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-event-location"
                          placeholder="Enter location..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-event-description"
                          placeholder="Enter event description..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div>
            {event?.id && isEditing && onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
                data-testid="button-delete-event"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Delete Event
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            
            {(!event || isEditing) && (
              <Button
                type="submit"
                onClick={form.handleSubmit(handleSave)}
                disabled={isLoading}
                data-testid="button-save-event"
              >
                {isLoading ? "Saving..." : isEditing ? "Update Event" : "Create Event"}
              </Button>
            )}
            
            {event && !isEditing && (
              <Button
                onClick={() => {/* Enable edit mode */}}
                data-testid="button-edit-event"
              >
                Edit Event
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EventModal;
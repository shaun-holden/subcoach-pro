import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar as CalendarIcon, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CalendarView from "@/components/CalendarView";
import EventModal from "@/components/EventModal";
import AvailabilityScheduler from "@/components/AvailabilityScheduler";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  eventType: 'substitute_request' | 'coaching_session' | 'availability' | 'blocked_time';
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  location?: string;
  description?: string;
  coachName?: string;
  gymName?: string;
}

interface AvailabilitySlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  notes?: string;
}

export function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch calendar events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/calendar/events'],
    retry: false,
  });

  // Fetch coach availability
  const { data: availability = [], isLoading: availabilityLoading } = useQuery({
    queryKey: ['/api/coaches/availability'],
    retry: false,
  });

  // Mutations for calendar operations
  const createEventMutation = useMutation({
    mutationFn: async (eventData: Omit<CalendarEvent, 'id'>) => {
      return await apiRequest('/api/calendar/events', 'POST', eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, eventData }: { eventId: string; eventData: Partial<CalendarEvent> }) => {
      return await apiRequest(`/api/calendar/events/${eventId}`, 'PUT', eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest(`/api/calendar/events/${eventId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (availabilityData: AvailabilitySlot[]) => {
      return await apiRequest('/api/coaches/availability', 'PUT', availabilityData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaches/availability'] });
      toast({
        title: "Success",
        description: "Availability updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      });
    },
  });

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEditing(false);
    setIsEventModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsEditing(false);
    setIsEventModalOpen(true);
  };

  const handleCreateEvent = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsEditing(false);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (eventData: any) => {
    if (selectedEvent?.id) {
      // Update existing event
      updateEventMutation.mutate({
        eventId: selectedEvent.id,
        eventData,
      });
    } else {
      // Create new event
      createEventMutation.mutate(eventData);
    }
    setIsEventModalOpen(false);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEventMutation.mutate(eventId);
    setIsEventModalOpen(false);
  };

  const handleSaveAvailability = (availabilityData: AvailabilitySlot[]) => {
    updateAvailabilityMutation.mutate(availabilityData);
  };

  const closeModal = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
    setIsEditing(false);
  };

  // Transform events data to match component interface
  const transformedEvents = Array.isArray(events) ? events.map((event: any) => ({
    ...event,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
  })) : [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar & Scheduling</h1>
          <p className="text-muted-foreground">
            Manage your substitute coaching schedule and availability
          </p>
        </div>
        <Button
          onClick={() => handleCreateEvent(new Date())}
          data-testid="button-create-event"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Event
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              {eventsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading calendar...</p>
                  </div>
                </div>
              ) : (
                <CalendarView
                  events={transformedEvents}
                  onEventClick={handleEventClick}
                  onDateClick={handleDateClick}
                  onCreateEvent={handleCreateEvent}
                  userType={user?.userType || 'coach'}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Management */}
        <TabsContent value="availability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Availability Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {availabilityLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading availability...</p>
                  </div>
                </div>
              ) : (
                <AvailabilityScheduler
                  availability={Array.isArray(availability) ? availability : []}
                  onSave={handleSaveAvailability}
                  isLoading={updateAvailabilityMutation.isPending}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Default View</label>
                  <select className="w-full mt-1 p-2 border rounded-md">
                    <option value="month">Month View</option>
                    <option value="week">Week View</option>
                    <option value="day">Day View</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Time Zone</label>
                  <select className="w-full mt-1 p-2 border rounded-md">
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Week Start</label>
                  <select className="w-full mt-1 p-2 border rounded-md">
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Email Reminders</label>
                  <input type="checkbox" className="rounded" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">SMS Notifications</label>
                  <input type="checkbox" className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Browser Notifications</label>
                  <input type="checkbox" className="rounded" defaultChecked />
                </div>
                <div>
                  <label className="text-sm font-medium">Reminder Time</label>
                  <select className="w-full mt-1 p-2 border rounded-md">
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="120">2 hours before</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={closeModal}
        event={selectedEvent || undefined}
        selectedDate={selectedDate || undefined}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        userType={user?.userType || 'coach'}
        isEditing={isEditing}
      />
    </div>
  );
}

export default CalendarPage;
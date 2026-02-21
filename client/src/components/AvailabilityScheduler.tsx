import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AvailabilitySlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  notes?: string;
}

interface AvailabilitySchedulerProps {
  availability: AvailabilitySlot[];
  onSave: (availability: AvailabilitySlot[]) => void;
  isLoading?: boolean;
}

const timeSlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  isAvailable: z.boolean().default(true),
  notes: z.string().optional(),
});

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const COMMON_TIME_SLOTS = [
  { label: 'Early Morning', start: '06:00', end: '09:00' },
  { label: 'Morning', start: '09:00', end: '12:00' },
  { label: 'Afternoon', start: '12:00', end: '17:00' },
  { label: 'Evening', start: '17:00', end: '21:00' },
  { label: 'Full Day', start: '06:00', end: '21:00' },
];

export function AvailabilityScheduler({ 
  availability, 
  onSave, 
  isLoading = false 
}: AvailabilitySchedulerProps) {
  const { toast } = useToast();
  const [editingSlots, setEditingSlots] = useState<AvailabilitySlot[]>(availability);
  const [showAddForm, setShowAddForm] = useState(false);

  const form = useForm<AvailabilitySlot>({
    resolver: zodResolver(timeSlotSchema),
    defaultValues: {
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      isAvailable: true,
      notes: "",
    },
  });

  const getDayName = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find(day => day.value === dayOfWeek)?.label || '';
  };

  const formatTimeRange = (startTime: string, endTime: string) => {
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(':');
      const hourNum = parseInt(hour);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
      return `${displayHour}:${minute} ${ampm}`;
    };
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  const handleAddSlot = (data: AvailabilitySlot) => {
    // Validate time range
    if (data.endTime <= data.startTime) {
      toast({
        title: "Invalid Time Range",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    // Check for overlapping slots on the same day
    const overlapping = editingSlots.find(slot => 
      slot.dayOfWeek === data.dayOfWeek &&
      ((data.startTime >= slot.startTime && data.startTime < slot.endTime) ||
       (data.endTime > slot.startTime && data.endTime <= slot.endTime) ||
       (data.startTime <= slot.startTime && data.endTime >= slot.endTime))
    );

    if (overlapping) {
      toast({
        title: "Time Conflict",
        description: "This time slot overlaps with an existing availability",
        variant: "destructive",
      });
      return;
    }

    const newSlot: AvailabilitySlot = {
      ...data,
      id: `temp-${Date.now()}`,
    };

    setEditingSlots(prev => [...prev, newSlot].sort((a, b) => 
      a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
    ));
    
    form.reset();
    setShowAddForm(false);
    
    toast({
      title: "Time Slot Added",
      description: `Added ${getDayName(data.dayOfWeek)} ${formatTimeRange(data.startTime, data.endTime)}`,
    });
  };

  const handleRemoveSlot = (index: number) => {
    const removedSlot = editingSlots[index];
    setEditingSlots(prev => prev.filter((_, i) => i !== index));
    
    toast({
      title: "Time Slot Removed",
      description: `Removed ${getDayName(removedSlot.dayOfWeek)} ${formatTimeRange(removedSlot.startTime, removedSlot.endTime)}`,
    });
  };

  const handleToggleAvailability = (index: number) => {
    setEditingSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, isAvailable: !slot.isAvailable } : slot
    ));
  };

  const handleQuickAdd = (timeSlot: typeof COMMON_TIME_SLOTS[0], dayOfWeek: number) => {
    const newSlot: AvailabilitySlot = {
      dayOfWeek,
      startTime: timeSlot.start,
      endTime: timeSlot.end,
      isAvailable: true,
      notes: timeSlot.label,
    };
    handleAddSlot(newSlot);
  };

  const handleSave = () => {
    onSave(editingSlots);
    toast({
      title: "Availability Updated",
      description: "Your availability schedule has been saved",
    });
  };

  const getSlotsByDay = (dayOfWeek: number) => {
    return editingSlots.filter(slot => slot.dayOfWeek === dayOfWeek);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Weekly Availability</h3>
          <p className="text-sm text-muted-foreground">
            Set your regular weekly schedule for substitute coaching opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            data-testid="button-add-time-slot"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Time Slot
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            data-testid="button-save-availability"
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Add Time Slot Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add New Time Slot</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddSlot)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="dayOfWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day</FormLabel>
                        <Select value={field.value.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger data-testid="select-day-of-week">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DAYS_OF_WEEK.map(day => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
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
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-availability-notes"
                            placeholder="e.g., Morning shift"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Quick add: {COMMON_TIME_SLOTS.map(slot => (
                      <Button
                        key={slot.label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          form.setValue('startTime', slot.start);
                          form.setValue('endTime', slot.end);
                          form.setValue('notes', slot.label);
                        }}
                        className="ml-2"
                        data-testid={`button-quick-${slot.label.toLowerCase().replace(' ', '-')}`}
                      >
                        {slot.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      data-testid="button-cancel-add"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-add-slot">
                      Add Slot
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Weekly Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {DAYS_OF_WEEK.map(day => {
          const daySlots = getSlotsByDay(day.value);
          
          return (
            <Card key={day.value} className="min-h-[200px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{day.short}</span>
                  <Badge variant="secondary" className="text-xs">
                    {daySlots.length} slots
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {daySlots.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-2">No availability</p>
                    <div className="space-y-1">
                      {COMMON_TIME_SLOTS.slice(0, 3).map(slot => (
                        <Button
                          key={slot.label}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleQuickAdd(slot, day.value)}
                          className="w-full text-xs"
                          data-testid={`button-quick-add-${day.short.toLowerCase()}-${slot.label.toLowerCase().replace(' ', '-')}`}
                        >
                          + {slot.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  daySlots.map((slot, index) => (
                    <div
                      key={`${slot.dayOfWeek}-${index}`}
                      className={`p-2 rounded border text-xs ${
                        slot.isAvailable 
                          ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Clock className="h-3 w-3" />
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAvailability(editingSlots.findIndex(s => s === slot))}
                            className="h-5 w-5 p-0"
                            data-testid={`button-toggle-${day.short.toLowerCase()}-${index}`}
                          >
                            <Checkbox 
                              checked={slot.isAvailable} 
                              className="h-3 w-3"
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSlot(editingSlots.findIndex(s => s === slot))}
                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                            data-testid={`button-remove-${day.short.toLowerCase()}-${index}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="font-medium">
                        {formatTimeRange(slot.startTime, slot.endTime)}
                      </div>
                      {slot.notes && (
                        <div className="text-muted-foreground mt-1">
                          {slot.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      {editingSlots.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Schedule Summary</p>
                <p className="text-sm text-muted-foreground">
                  {editingSlots.filter(slot => slot.isAvailable).length} available time slots across {new Set(editingSlots.map(slot => slot.dayOfWeek)).size} days
                </p>
              </div>
              <Badge variant="outline" className="text-sm">
                {editingSlots.reduce((total, slot) => {
                  if (!slot.isAvailable) return total;
                  const start = new Date(`2000-01-01T${slot.startTime}`);
                  const end = new Date(`2000-01-01T${slot.endTime}`);
                  return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                }, 0).toFixed(1)} hours/week
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AvailabilityScheduler;
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
  view?: 'month' | 'week' | 'day';
  userType?: 'coach' | 'owner';
}

export function CalendarView({ 
  events, 
  onEventClick, 
  onDateClick, 
  onCreateEvent,
  view = 'month',
  userType = 'coach'
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getEventTypeColor = (eventType: string, status: string) => {
    if (status === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (status === 'completed') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    
    switch (eventType) {
      case 'substitute_request':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'coaching_session':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'availability':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'blocked_time':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatEventTime = (startTime: Date, endTime: Date) => {
    return `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">
            {format(currentDate, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              data-testid="button-today"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          {/* Week Days Header */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              className="bg-gray-50 dark:bg-gray-800 p-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {calendarDays.map(day => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "bg-white dark:bg-gray-900 min-h-[120px] p-2 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                  !isCurrentMonth && "opacity-40",
                  isTodayDate && "ring-2 ring-blue-500"
                )}
                onClick={() => onDateClick?.(day)}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isTodayDate ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {onCreateEvent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateEvent(day);
                      }}
                      data-testid={`button-create-event-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {/* Events for this day */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs p-1 rounded cursor-pointer truncate",
                        getEventTypeColor(event.eventType, event.status)
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      data-testid={`event-${event.id}`}
                      title={`${event.title} - ${formatEventTime(event.startTime, event.endTime)}`}
                    >
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {format(event.startTime, 'h:mm a')} {event.title}
                        </span>
                      </div>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 p-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Substitute Requests</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Coaching Sessions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Available Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-900"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Blocked Time</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CalendarView;
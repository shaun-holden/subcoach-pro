import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, TrendingUp } from "lucide-react";

interface HeatMapData {
  day: string;
  hour: number;
  demandLevel: number; // 0-4 scale
  requestCount: number;
  fillRate: number;
}

interface AvailabilityHeatMapProps {
  requests: any[];
  applications: any[];
  className?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6 AM to 7 PM

export function AvailabilityHeatMap({ requests, applications, className }: AvailabilityHeatMapProps) {
  const heatMapData = useMemo(() => {
    const data: HeatMapData[] = [];
    
    // Generate heat map data for each day and hour
    DAYS.forEach((day, dayIndex) => {
      HOURS.forEach(hour => {
        // Filter requests for this day and hour
        const dayRequests = requests.filter(req => {
          const requestDate = new Date(req.startDate);
          const requestDay = requestDate.getDay();
          const requestHour = requestDate.getHours();
          const adjustedDay = requestDay === 0 ? 6 : requestDay - 1; // Convert Sunday=0 to index 6
          
          return adjustedDay === dayIndex && requestHour === hour;
        });
        
        // Calculate fill rate for this time slot
        const filledRequests = dayRequests.filter(req =>
          applications.some(app => app.requestId === req.id && app.status === 'accepted')
        );
        
        const fillRate = dayRequests.length > 0 ? (filledRequests.length / dayRequests.length) * 100 : 0;
        
        // Determine demand level (0-4 scale)
        let demandLevel = 0;
        if (dayRequests.length >= 5) demandLevel = 4;
        else if (dayRequests.length >= 3) demandLevel = 3;
        else if (dayRequests.length >= 2) demandLevel = 2;
        else if (dayRequests.length >= 1) demandLevel = 1;
        
        data.push({
          day,
          hour,
          demandLevel,
          requestCount: dayRequests.length,
          fillRate
        });
      });
    });
    
    return data;
  }, [requests, applications]);

  const getDemandColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-gray-100 border-gray-200';
      case 1: return 'bg-blue-100 border-blue-200';
      case 2: return 'bg-yellow-100 border-yellow-300';
      case 3: return 'bg-orange-200 border-orange-300';
      case 4: return 'bg-red-200 border-red-300';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getFillRateColor = (fillRate: number) => {
    if (fillRate >= 90) return 'text-green-600';
    if (fillRate >= 70) return 'text-yellow-600';
    if (fillRate >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const totalRequests = requests.length;
  const peakDemandSlots = heatMapData
    .filter(slot => slot.demandLevel >= 3)
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 3);

  return (
    <Card className={className} data-testid="heatmap-availability">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Demand Heat Map
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visual overview of substitute coaching demand patterns across the week
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Heat Map Grid */}
        <div className="space-y-2">
          {/* Hour headers */}
          <div className="grid grid-cols-15 gap-1 text-xs">
            <div></div> {/* Empty corner */}
            {HOURS.map(hour => (
              <div key={hour} className="text-center font-medium text-muted-foreground">
                {hour === 12 ? '12P' : hour > 12 ? `${hour-12}P` : `${hour}A`}
              </div>
            ))}
          </div>
          
          {/* Day rows */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="grid grid-cols-15 gap-1">
              <div className="text-xs font-medium text-muted-foreground py-2 text-right pr-2">
                {day.slice(0, 3)}
              </div>
              {HOURS.map(hour => {
                const slot = heatMapData.find(d => d.day === day && d.hour === hour);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`h-8 border rounded text-xs flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${getDemandColor(slot?.demandLevel || 0)}`}
                    title={`${day} ${hour}:00 - ${slot?.requestCount || 0} requests (${slot?.fillRate.toFixed(0) || 0}% filled)`}
                    data-testid={`heatmap-slot-${dayIndex}-${hour}`}
                  >
                    {slot && slot.requestCount > 0 && (
                      <span className="font-semibold">
                        {slot.requestCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Demand Levels</h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
              <span className="text-xs">No demand</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
              <span className="text-xs">Low (1 request)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span className="text-xs">Medium (2 requests)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 border border-orange-300 rounded"></div>
              <span className="text-xs">High (3-4 requests)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 border border-red-300 rounded"></div>
              <span className="text-xs">Very High (5+ requests)</span>
            </div>
          </div>
        </div>

        {/* Peak Demand Insights */}
        {peakDemandSlots.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Peak Demand Times
            </h4>
            <div className="grid gap-2">
              {peakDemandSlots.map((slot, index) => (
                <div 
                  key={`${slot.day}-${slot.hour}`} 
                  className="flex items-center justify-between p-2 bg-muted rounded"
                  data-testid={`peak-demand-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <span className="text-sm font-medium">
                      {slot.day} {slot.hour === 12 ? '12:00 PM' : slot.hour > 12 ? `${slot.hour-12}:00 PM` : `${slot.hour}:00 AM`}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{slot.requestCount} requests</div>
                    <div className={`text-xs ${getFillRateColor(slot.fillRate)}`}>
                      {slot.fillRate.toFixed(0)}% filled
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalRequests}</div>
            <div className="text-xs text-muted-foreground">Total Requests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {heatMapData.filter(slot => slot.demandLevel >= 3).length}
            </div>
            <div className="text-xs text-muted-foreground">High Demand Slots</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(heatMapData.reduce((sum, slot) => sum + slot.fillRate, 0) / Math.max(heatMapData.filter(slot => slot.requestCount > 0).length, 1))}%
            </div>
            <div className="text-xs text-muted-foreground">Avg Fill Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
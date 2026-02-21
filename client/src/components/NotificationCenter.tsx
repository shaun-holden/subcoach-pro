import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, X, CheckCircle, TrendingUp, AlertCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NotificationData {
  id: string;
  userId: string;
  userType: 'coach' | 'owner';
  type: 'application' | 'opportunity' | 'insight' | 'reminder' | 'achievement';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  metadata?: any;
}

interface CoachingInsight {
  id: string;
  type: 'performance' | 'opportunity' | 'improvement' | 'achievement';
  title: string;
  message: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  data?: any;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'achievement':
      return <Award className="h-4 w-4 text-yellow-600" />;
    case 'insight':
      return <TrendingUp className="h-4 w-4 text-blue-600" />;
    case 'reminder':
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    case 'application':
    case 'opportunity':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    default:
      return <Bell className="h-4 w-4 text-gray-600" />;
  }
};

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'achievement':
      return <Award className="h-5 w-5 text-yellow-600" />;
    case 'performance':
      return <TrendingUp className="h-5 w-5 text-blue-600" />;
    case 'improvement':
      return <AlertCircle className="h-5 w-5 text-orange-600" />;
    case 'opportunity':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    default:
      return <Bell className="h-5 w-5 text-gray-600" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'border-l-red-500 bg-red-50';
    case 'medium':
      return 'border-l-yellow-500 bg-yellow-50';
    case 'low':
      return 'border-l-green-500 bg-green-50';
    default:
      return 'border-l-gray-500 bg-gray-50';
  }
};

interface NotificationCenterProps {
  userType: 'coach' | 'owner';
  userId: string;
}

export function NotificationCenter({ userType, userId }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<NotificationData[]>({
    queryKey: ["/api/notifications", userId],
    retry: false,
    refetchInterval: 30000, // Check for new notifications every 30 seconds
  });

  // Fetch insights
  const { data: insights = [], refetch: refetchInsights } = useQuery<CoachingInsight[]>({
    queryKey: ["/api/insights", userId, userType],
    retry: false,
    refetchInterval: 300000, // Update insights every 5 minutes
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest(`/api/notifications/${notificationId}/read`, "POST");
    },
    onSuccess: () => {
      refetchNotifications();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = (notifications as NotificationData[]).filter((n: NotificationData) => !n.read).length;

  const handleNotificationClick = (notification: NotificationData) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      // Navigate to the action URL
      window.location.hash = notification.actionUrl;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            data-testid="button-notifications"
            variant="ghost"
            size="sm"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white"
                data-testid="badge-notification-count"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications & Insights</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-96">
            <div className="p-4 space-y-4">
              {/* Coaching Insights Section */}
              {(insights as CoachingInsight[]).length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-sm">Personalized Insights</h4>
                  </div>
                  
                  <div className="space-y-2">
                    {(insights as CoachingInsight[]).slice(0, 3).map((insight: CoachingInsight) => (
                      <Card 
                        key={insight.id} 
                        className={`border-l-4 ${getPriorityColor(insight.priority)} cursor-pointer transition-colors hover:bg-gray-50`}
                        data-testid={`insight-${insight.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            {getInsightIcon(insight.type)}
                            <div className="flex-1">
                              <h5 className="font-medium text-sm text-gray-900">
                                {insight.title}
                              </h5>
                              <p className="text-xs text-gray-600 mt-1">
                                {insight.message}
                              </p>
                              {insight.actionable && (
                                <Badge variant="secondary" className="mt-2 text-xs">
                                  Actionable
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {(insights as CoachingInsight[]).length > 3 && (
                    <Button variant="link" size="sm" className="w-full text-xs">
                      View all insights ({(insights as CoachingInsight[]).length})
                    </Button>
                  )}
                  
                  <Separator />
                </>
              )}

              {/* Notifications Section */}
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-gray-600" />
                <h4 className="font-medium text-sm">Recent Activity</h4>
              </div>

              {(notifications as NotificationData[]).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(notifications as NotificationData[]).slice(0, 10).map((notification: NotificationData) => (
                    <Card
                      key={notification.id}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        notification.read ? 'opacity-75' : 'border-l-4 border-l-blue-500'
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1">
                            <h5 className={`font-medium text-sm ${
                              notification.read ? 'text-gray-700' : 'text-gray-900'
                            }`}>
                              {notification.title}
                            </h5>
                            <p className="text-xs text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              {formatTimeAgo(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {(notifications as NotificationData[]).length > 10 && (
                <Button variant="link" size="sm" className="w-full text-xs">
                  View all notifications
                </Button>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
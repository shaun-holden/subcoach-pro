import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Settings, Mail } from "lucide-react";

interface EmailSettingsModalProps {
  children: React.ReactNode;
}

export function EmailSettingsModal({ children }: EmailSettingsModalProps) {
  const [emailReminders, setEmailReminders] = useState(true);
  const [reminderTimes, setReminderTimes] = useState({
    "15min": true,
    "1hour": true,
    "1day": false,
  });
  const [notificationTypes, setNotificationTypes] = useState({
    newOpportunities: true,
    applicationUpdates: true,
    calendarReminders: true,
    weeklyDigest: false,
  });

  const handleReminderTimeChange = (time: string, checked: boolean) => {
    setReminderTimes(prev => ({
      ...prev,
      [time]: checked
    }));
  };

  const handleNotificationTypeChange = (type: string, checked: boolean) => {
    setNotificationTypes(prev => ({
      ...prev,
      [type]: checked
    }));
  };

  const saveSettings = () => {
    // In a real app, this would make an API call to save settings
    console.log('Saving email settings:', {
      emailReminders,
      reminderTimes,
      notificationTypes
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notification Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Master Email Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-master" className="text-base font-medium">
                    Enable Email Notifications
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Receive email notifications for calendar events and opportunities
                  </p>
                </div>
                <Switch
                  id="email-master"
                  checked={emailReminders}
                  onCheckedChange={setEmailReminders}
                  data-testid="switch-email-master"
                />
              </div>
            </CardContent>
          </Card>

          {/* Calendar Reminder Timing */}
          {emailReminders && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calendar Reminder Timing</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose when to receive reminders before your scheduled events
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder-15min"
                      checked={reminderTimes["15min"]}
                      onCheckedChange={(checked) => handleReminderTimeChange("15min", checked as boolean)}
                      data-testid="checkbox-reminder-15min"
                    />
                    <Label htmlFor="reminder-15min">15 minutes before</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder-1hour"
                      checked={reminderTimes["1hour"]}
                      onCheckedChange={(checked) => handleReminderTimeChange("1hour", checked as boolean)}
                      data-testid="checkbox-reminder-1hour"
                    />
                    <Label htmlFor="reminder-1hour">1 hour before</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder-1day"
                      checked={reminderTimes["1day"]}
                      onCheckedChange={(checked) => handleReminderTimeChange("1day", checked as boolean)}
                      data-testid="checkbox-reminder-1day"
                    />
                    <Label htmlFor="reminder-1day">1 day before</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Types */}
          {emailReminders && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notification Types</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose which types of notifications you want to receive
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notif-opportunities" className="font-medium">
                        New Substitute Opportunities
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get notified when new opportunities match your availability
                      </p>
                    </div>
                    <Switch
                      id="notif-opportunities"
                      checked={notificationTypes.newOpportunities}
                      onCheckedChange={(checked) => handleNotificationTypeChange("newOpportunities", checked)}
                      data-testid="switch-notif-opportunities"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notif-applications" className="font-medium">
                        Application Updates
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Updates when your applications are accepted or rejected
                      </p>
                    </div>
                    <Switch
                      id="notif-applications"
                      checked={notificationTypes.applicationUpdates}
                      onCheckedChange={(checked) => handleNotificationTypeChange("applicationUpdates", checked)}
                      data-testid="switch-notif-applications"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notif-calendar" className="font-medium">
                        Calendar Reminders
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Reminders for upcoming coaching sessions and events
                      </p>
                    </div>
                    <Switch
                      id="notif-calendar"
                      checked={notificationTypes.calendarReminders}
                      onCheckedChange={(checked) => handleNotificationTypeChange("calendarReminders", checked)}
                      data-testid="switch-notif-calendar"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notif-digest" className="font-medium">
                        Weekly Digest
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Weekly summary of opportunities and upcoming sessions
                      </p>
                    </div>
                    <Switch
                      id="notif-digest"
                      checked={notificationTypes.weeklyDigest}
                      onCheckedChange={(checked) => handleNotificationTypeChange("weeklyDigest", checked)}
                      data-testid="switch-notif-digest"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={saveSettings}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-save-email-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
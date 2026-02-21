import { calendarIntegration } from "./calendarIntegration";

class ReminderScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    // Check for reminders every 5 minutes
    this.intervalId = setInterval(async () => {
      try {
        await calendarIntegration.sendScheduledReminders();
      } catch (error) {
        console.error('Error sending scheduled reminders:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    console.log('Reminder scheduler started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Reminder scheduler stopped');
    }
  }
}

export const reminderScheduler = new ReminderScheduler();
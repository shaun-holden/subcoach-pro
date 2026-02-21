import { db } from "./db";
import { calendarEvents, substituteRequests, applications, coaches, users } from "@shared/schema";
import { emailService } from "./emailService";
import { eq, and } from "drizzle-orm";
import { addMinutes, addHours, addDays, parseISO } from "date-fns";

export class CalendarIntegrationService {
  
  // Create calendar event when substitute request is posted
  async createEventFromSubstituteRequest(requestId: string): Promise<void> {
    try {
      const [request] = await db
        .select()
        .from(substituteRequests)
        .where(eq(substituteRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new Error(`Substitute request ${requestId} not found`);
      }

      // Create calendar event for the gym owner
      await db.insert(calendarEvents).values({
        ownerId: request.ownerId,
        title: `${request.eventType} - Substitute Needed`,
        description: request.description || `Looking for substitute coach for ${request.eventType}`,
        startTime: new Date(`${request.startDate.toISOString().split('T')[0]}T${request.startTime}`),
        endTime: new Date(`${request.startDate.toISOString().split('T')[0]}T${request.endTime}`),
        eventType: "substitute_request",
        status: "pending",
        location: request.description || "",
        substituteRequestId: requestId,
        emailReminders: true,
        reminderTimes: ["1day", "1hour"],
      });

      console.log(`Calendar event created for substitute request ${requestId}`);
    } catch (error) {
      console.error(`Failed to create calendar event for request ${requestId}:`, error);
    }
  }

  // Create calendar event when application is accepted
  async createEventFromAcceptedApplication(applicationId: string): Promise<void> {
    try {
      const applicationData = await db
        .select({
          application: applications,
          request: substituteRequests,
          coach: coaches,
          user: users,
        })
        .from(applications)
        .innerJoin(substituteRequests, eq(applications.requestId, substituteRequests.id))
        .innerJoin(coaches, eq(applications.coachId, coaches.id))
        .innerJoin(users, eq(coaches.userId, users.id))
        .where(eq(applications.id, applicationId))
        .limit(1);

      if (!applicationData.length) {
        throw new Error(`Application ${applicationId} not found`);
      }

      const { application, request, coach, user } = applicationData[0];

      // Create calendar event for the coach
      await db.insert(calendarEvents).values({
        ownerId: user.id,
        title: `${request.eventType} Coaching Session`,
        description: `Substitute coaching session at ${request.description || 'Gym'}`,
        startTime: new Date(`${request.startDate.toISOString().split('T')[0]}T${request.startTime}`),
        endTime: new Date(`${request.startDate.toISOString().split('T')[0]}T${request.endTime}`),
        eventType: "coaching_session",
        status: "confirmed",
        location: request.description || "",
        substituteRequestId: request.id,
        applicationId: applicationId,
        emailReminders: true,
        reminderTimes: ["1day", "1hour", "15min"],
      });

      // Send confirmation email to coach
      if (user.email) {
        await emailService.sendApplicationStatusUpdate(
          user.email,
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Coach',
          'accepted',
          request.eventType,
          request.description || 'Gym',
          request.startDate,
          `${request.startTime} - ${request.endTime}`
        );
      }

      console.log(`Calendar event created for accepted application ${applicationId}`);
    } catch (error) {
      console.error(`Failed to create calendar event for application ${applicationId}:`, error);
    }
  }

  // Send email reminders for upcoming events
  async sendScheduledReminders(): Promise<void> {
    try {
      const now = new Date();
      
      // Get events with email reminders enabled that are upcoming
      const upcomingEvents = await db
        .select({
          event: calendarEvents,
          user: users,
        })
        .from(calendarEvents)
        .innerJoin(users, eq(calendarEvents.ownerId, users.id))
        .where(
          and(
            eq(calendarEvents.emailReminders, true),
            eq(calendarEvents.status, "confirmed")
          )
        );

      for (const { event, user } of upcomingEvents) {
        if (!user.email || !event.reminderTimes || event.reminderTimes.length === 0) continue;

        const eventStart = event.startTime;
        
        for (const reminderTime of event.reminderTimes) {
          let reminderDateTime: Date;
          
          switch (reminderTime) {
            case '15min':
              reminderDateTime = addMinutes(eventStart, -15);
              break;
            case '1hour':
              reminderDateTime = addHours(eventStart, -1);
              break;
            case '1day':
              reminderDateTime = addDays(eventStart, -1);
              break;
            default:
              continue;
          }

          // Check if it's time to send this reminder (within 5 minutes of reminder time)
          const timeDiff = Math.abs(now.getTime() - reminderDateTime.getTime());
          const fiveMinutes = 5 * 60 * 1000;

          if (timeDiff <= fiveMinutes) {
            await emailService.sendCalendarReminder(
              user.email,
              `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
              event.title,
              eventStart,
              reminderTime as '15min' | '1hour' | '1day'
            );
            
            console.log(`Sent ${reminderTime} reminder for event ${event.id} to ${user.email}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send scheduled reminders:', error);
    }
  }

  // Notify matching coaches when new substitute request is posted
  async notifyMatchingCoaches(requestId: string): Promise<void> {
    try {
      const [request] = await db
        .select()
        .from(substituteRequests)
        .where(eq(substituteRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new Error(`Substitute request ${requestId} not found`);
      }

      // Get all coaches (in a real system, you'd filter by availability, location, etc.)
      const matchingCoaches = await db
        .select({
          coach: coaches,
          user: users,
        })
        .from(coaches)
        .innerJoin(users, eq(coaches.userId, users.id));

      for (const { coach, user } of matchingCoaches) {
        if (!user.email) continue;

        // Send notification email
        await emailService.sendSubstituteRequestNotification(
          user.email,
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Coach',
          request.description || 'Gym',
          request.eventType,
          request.startDate,
          `${request.startTime} - ${request.endTime}`,
          Number(request.hourlyRate),
          requestId
        );
      }

      console.log(`Notified ${matchingCoaches.length} coaches about new substitute request ${requestId}`);
    } catch (error) {
      console.error(`Failed to notify coaches about request ${requestId}:`, error);
    }
  }

  // Clean up calendar events when substitute request is cancelled
  async removeEventFromCancelledRequest(requestId: string): Promise<void> {
    try {
      await db
        .delete(calendarEvents)
        .where(eq(calendarEvents.substituteRequestId, requestId));

      console.log(`Removed calendar events for cancelled request ${requestId}`);
    } catch (error) {
      console.error(`Failed to remove events for cancelled request ${requestId}:`, error);
    }
  }

  // Send decline notification when application is rejected
  async sendDeclineNotification(applicationId: string): Promise<void> {
    try {
      const applicationData = await db
        .select({
          application: applications,
          request: substituteRequests,
          coach: coaches,
          user: users,
        })
        .from(applications)
        .innerJoin(substituteRequests, eq(applications.requestId, substituteRequests.id))
        .innerJoin(coaches, eq(applications.coachId, coaches.id))
        .innerJoin(users, eq(coaches.userId, users.id))
        .where(eq(applications.id, applicationId))
        .limit(1);

      if (!applicationData.length) {
        throw new Error(`Application ${applicationId} not found`);
      }

      const { request, user } = applicationData[0];

      // Send decline email to coach
      if (user.email) {
        await emailService.sendDeclineEmail({
          to: user.email,
          coachName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Coach',
          requestId: request.id,
          gymName: request.description || 'Gym'
        });
      }

      console.log(`Sent decline notification for application ${applicationId}`);
    } catch (error) {
      console.error(`Failed to send decline notification for application ${applicationId}:`, error);
    }
  }
}

export const calendarIntegration = new CalendarIntegrationService();
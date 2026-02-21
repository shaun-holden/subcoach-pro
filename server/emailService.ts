import sgMail from '@sendgrid/mail';
import { format, addMinutes, addHours, addDays } from 'date-fns';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private fromEmail = 'noreply@subcoachpro.com';
  private getBaseUrl() {
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    return domain ? `https://${domain}` : 'http://localhost:5000';
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      await sgMail.send({
        to: params.to,
        from: params.from || this.fromEmail,
        subject: params.subject,
        text: params.text || '',
        html: params.html || '',
      });
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }

  async sendSubstituteRequestNotification(
    coachEmail: string,
    coachName: string,
    gymName: string,
    className: string,
    date: Date,
    time: string,
    hourlyRate: number,
    requestId: string
  ): Promise<boolean> {
    const formattedDate = format(date, 'EEEE, MMMM do, yyyy');
    
    const subject = `New Substitute Opportunity: ${className} at ${gymName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Substitute Coaching Opportunity</h2>
        
        <p>Hi ${coachName},</p>
        
        <p>A new substitute coaching opportunity has been posted that matches your availability:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${className}</h3>
          <p><strong>Gym:</strong> ${gymName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Rate:</strong> $${hourlyRate}/hour</p>
        </div>
        
        <p>To apply for this opportunity, log in to your SubCoach Pro dashboard and view the details.</p>
        
        <a href="${this.getBaseUrl()}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          View Opportunity
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      New Substitute Coaching Opportunity
      
      Hi ${coachName},
      
      A new substitute coaching opportunity has been posted:
      
      Class: ${className}
      Gym: ${gymName}
      Date: ${formattedDate}
      Time: ${time}
      Rate: $${hourlyRate}/hour
      
      To apply, visit your SubCoach Pro dashboard.
    `;

    return this.sendEmail({
      to: coachEmail,
      from: this.fromEmail,
      subject,
      html,
      text
    });
  }

  async sendApplicationStatusUpdate(
    coachEmail: string,
    coachName: string,
    status: 'accepted' | 'rejected',
    className: string,
    gymName: string,
    date: Date,
    time: string
  ): Promise<boolean> {
    const formattedDate = format(date, 'EEEE, MMMM do, yyyy');
    const isAccepted = status === 'accepted';
    
    const subject = `Application ${isAccepted ? 'Accepted' : 'Update'}: ${className} at ${gymName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isAccepted ? '#059669' : '#dc2626'};">
          Application ${isAccepted ? 'Accepted!' : 'Update'}
        </h2>
        
        <p>Hi ${coachName},</p>
        
        <p>Your application for the substitute coaching position has been <strong>${status}</strong>:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${className}</h3>
          <p><strong>Gym:</strong> ${gymName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${time}</p>
        </div>
        
        ${isAccepted ? `
          <p>Congratulations! Please check your calendar for the coaching session details and arrive 15 minutes early.</p>
          
          <p>The gym owner will contact you directly with any specific instructions or requirements.</p>
        ` : `
          <p>Unfortunately, your application was not selected for this position. Don't worry - new opportunities are posted regularly!</p>
          
          <p>Keep checking your dashboard for new substitute coaching opportunities that match your availability.</p>
        `}
        
        <a href="${this.getBaseUrl()}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          View Dashboard
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      Application ${isAccepted ? 'Accepted!' : 'Update'}
      
      Hi ${coachName},
      
      Your application for ${className} at ${gymName} on ${formattedDate} at ${time} has been ${status}.
      
      ${isAccepted ? 
        'Congratulations! Please arrive 15 minutes early and check your calendar for details.' :
        "Unfortunately, your application was not selected. Keep checking for new opportunities!"
      }
      
      Visit your SubCoach Pro dashboard for more details.
    `;

    return this.sendEmail({
      to: coachEmail,
      from: this.fromEmail,
      subject,
      html,
      text
    });
  }

  async sendNewApplicationNotification({
    ownerEmail,
    ownerName,
    coachName,
    className,
    date,
    time,
    requestedRate
  }: {
    ownerEmail: string;
    ownerName: string;
    coachName: string;
    className: string;
    date: Date;
    time: string;
    requestedRate: string;
  }): Promise<boolean> {
    const formattedDate = format(date, 'EEEE, MMMM do, yyyy');
    
    const subject = `New Application: ${coachName} applied for ${className}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Coach Application Received</h2>
        
        <p>Hi ${ownerName},</p>
        
        <p>You have a new application for your substitute coaching request:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="margin-top: 0; color: #374151;">${className}</h3>
          <p><strong>Coach:</strong> ${coachName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Requested Rate:</strong> $${requestedRate}/hour</p>
        </div>
        
        <p>Please log in to your dashboard to review the application. You can:</p>
        <ul>
          <li><strong>Accept</strong> the application</li>
          <li><strong>Decline</strong> the application</li>
          <li><strong>Negotiate</strong> the rate with the coach</li>
        </ul>
        
        <a href="${this.getBaseUrl()}/owner-dashboard" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          Review Application
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      New Coach Application Received
      
      Hi ${ownerName},
      
      You have a new application for your substitute coaching request:
      
      Class: ${className}
      Coach: ${coachName}
      Date: ${formattedDate}
      Time: ${time}
      Requested Rate: $${requestedRate}/hour
      
      Log in to your dashboard to review and respond to this application.
      
      Best regards,
      The SubCoach Pro Team
    `;

    return this.sendEmail({
      to: ownerEmail,
      subject,
      html,
      text
    });
  }

  async sendAcceptanceEmail({
    to,
    coachName,
    requestId,
    gymName
  }: {
    to: string;
    coachName: string;
    requestId: string;
    gymName: string;
  }): Promise<boolean> {
    const subject = `🎉 Application Accepted - Substitute Coaching Opportunity at ${gymName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">🎉 Congratulations! Your Application Has Been Accepted</h2>
        
        <p>Hi ${coachName},</p>
        
        <p>Great news! Your application for the substitute coaching position has been <strong>ACCEPTED</strong>!</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #374151;">Next Steps:</h3>
          <ul style="margin: 10px 0;">
            <li>Check your calendar for the coaching session details</li>
            <li>Arrive 15 minutes early to the gym</li>
            <li>The gym owner will contact you with specific instructions</li>
            <li>Bring any required certifications or equipment</li>
          </ul>
        </div>
        
        <p>Thank you for being part of the SubCoach Pro community!</p>
        
        <a href="${this.getBaseUrl()}" 
           style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          View Your Dashboard
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      🎉 Congratulations! Your Application Has Been Accepted
      
      Hi ${coachName},
      
      Great news! Your application for the substitute coaching position at ${gymName} has been ACCEPTED!
      
      Next Steps:
      - Check your calendar for session details
      - Arrive 15 minutes early
      - Wait for gym owner contact with instructions
      
      Visit your SubCoach Pro dashboard for more details.
      
      Best regards,
      The SubCoach Pro Team
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  async sendDeclineEmail({
    to,
    coachName,
    requestId,
    gymName
  }: {
    to: string;
    coachName: string;
    requestId: string;
    gymName: string;
  }): Promise<boolean> {
    const subject = `Application Update - Substitute Coaching Opportunity at ${gymName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Application Update</h2>
        
        <p>Hi ${coachName},</p>
        
        <p>Thank you for your interest in the substitute coaching position at ${gymName}. Unfortunately, we have decided to go with another candidate for this opportunity.</p>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #374151;">Don't be discouraged!</h3>
          <ul style="margin: 10px 0;">
            <li>New substitute opportunities are posted regularly</li>
            <li>Keep your profile updated and availability current</li>
            <li>Continue building your coaching experience and certifications</li>
            <li>Consider expanding your available locations or specializations</li>
          </ul>
        </div>
        
        <p>We encourage you to continue applying for future opportunities that match your skills and availability.</p>
        
        <a href="${this.getBaseUrl()}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          Browse New Opportunities
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      Application Update
      
      Hi ${coachName},
      
      Thank you for your interest in the substitute coaching position at ${gymName}. Unfortunately, we have decided to go with another candidate for this opportunity.
      
      Don't be discouraged! New opportunities are posted regularly. Keep your profile updated and continue applying for positions that match your skills.
      
      Visit your SubCoach Pro dashboard to browse new opportunities.
      
      Best regards,
      The SubCoach Pro Team
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  async sendCalendarReminder(
    userEmail: string,
    userName: string,
    eventTitle: string,
    eventDate: Date,
    reminderType: '15min' | '1hour' | '1day'
  ): Promise<boolean> {
    const formattedDate = format(eventDate, 'EEEE, MMMM do, yyyy');
    const formattedTime = format(eventDate, 'h:mm a');
    
    const reminderText = {
      '15min': '15 minutes',
      '1hour': '1 hour', 
      '1day': '1 day'
    }[reminderType];

    const subject = `Reminder: ${eventTitle} in ${reminderText}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Calendar Reminder</h2>
        
        <p>Hi ${userName},</p>
        
        <p>This is a reminder that you have an upcoming event:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${eventTitle}</h3>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Starts in:</strong> ${reminderText}</p>
        </div>
        
        <p>Make sure you're prepared and arrive on time!</p>
        
        <a href="${this.getBaseUrl()}/calendar" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          View Calendar
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      Calendar Reminder
      
      Hi ${userName},
      
      Reminder: ${eventTitle}
      Date: ${formattedDate}
      Time: ${formattedTime}
      Starts in: ${reminderText}
      
      Make sure you're prepared and arrive on time!
    `;

    return this.sendEmail({
      to: userEmail,
      from: this.fromEmail,
      subject,
      html,
      text
    });
  }

  async sendOwnerNotification(
    ownerEmail: string,
    ownerName: string,
    coachName: string,
    className: string,
    date: Date,
    time: string,
    applicationId: string
  ): Promise<boolean> {
    const formattedDate = format(date, 'EEEE, MMMM do, yyyy');
    
    const subject = `New Application: ${coachName} for ${className}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Coach Application</h2>
        
        <p>Hi ${ownerName},</p>
        
        <p>A new coach has applied for your substitute request:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${className}</h3>
          <p><strong>Coach:</strong> ${coachName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${time}</p>
        </div>
        
        <p>Please review the coach's profile and decide whether to accept their application.</p>
        
        <a href="${this.getBaseUrl()}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
          Review Application
        </a>
        
        <p>Best regards,<br>The SubCoach Pro Team</p>
      </div>
    `;

    const text = `
      New Coach Application
      
      Hi ${ownerName},
      
      ${coachName} has applied for your substitute request:
      
      Class: ${className}
      Date: ${formattedDate}
      Time: ${time}
      
      Please review their profile and respond to the application.
    `;

    return this.sendEmail({
      to: ownerEmail,
      from: this.fromEmail,
      subject,
      html,
      text
    });
  }
}

export const emailService = new EmailService();
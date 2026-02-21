import { emailService } from './emailService';

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  applicationUpdates: boolean;
  newOpportunities: boolean;
  performanceInsights: boolean;
  weeklyDigest: boolean;
}

export interface CoachingInsight {
  id: string;
  type: 'performance' | 'opportunity' | 'improvement' | 'achievement';
  title: string;
  message: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  data?: any;
}

export interface NotificationData {
  id: string;
  userId: string;
  userType: 'coach' | 'owner';
  type: 'application' | 'opportunity' | 'insight' | 'reminder' | 'achievement';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
  metadata?: any;
}

class NotificationService {
  private notifications: NotificationData[] = [];
  private insights: CoachingInsight[] = [];

  // Generate personalized coaching insights for coaches
  async generateCoachInsights(coachId: string, applications: any[], opportunities: any[]): Promise<CoachingInsight[]> {
    const insights: CoachingInsight[] = [];
    const now = new Date();

    // Performance insights
    const acceptedApps = applications.filter(app => app.status === 'accepted');
    const pendingApps = applications.filter(app => app.status === 'pending');
    const declinedApps = applications.filter(app => app.status === 'declined');
    
    const acceptanceRate = applications.length > 0 ? (acceptedApps.length / applications.length) * 100 : 0;
    
    // Acceptance rate insight
    if (applications.length >= 3) {
      if (acceptanceRate >= 75) {
        insights.push({
          id: `insight-${Date.now()}-1`,
          type: 'achievement',
          title: 'Excellent Success Rate!',
          message: `Your application acceptance rate is ${acceptanceRate.toFixed(0)}%. Gyms love working with you!`,
          actionable: false,
          priority: 'high',
          createdAt: now,
          data: { acceptanceRate, totalApplications: applications.length }
        });
      } else if (acceptanceRate < 50) {
        insights.push({
          id: `insight-${Date.now()}-2`,
          type: 'improvement',
          title: 'Boost Your Success Rate',
          message: `Your acceptance rate is ${acceptanceRate.toFixed(0)}%. Consider customizing your application messages or adjusting your rates.`,
          actionable: true,
          priority: 'medium',
          createdAt: now,
          data: { acceptanceRate, suggestions: ['Personalize messages', 'Review rate competitiveness'] }
        });
      }
    }

    // Rate competitiveness insight
    const avgRequestedRate = applications.length > 0 
      ? applications.reduce((sum, app) => sum + (app.requestedRate || 0), 0) / applications.length 
      : 0;
    
    const avgOfferedRate = opportunities.length > 0
      ? opportunities.reduce((sum, opp) => sum + (parseFloat(opp.rateOffer) || 0), 0) / opportunities.length
      : 0;

    if (avgRequestedRate > avgOfferedRate * 1.2 && applications.length > 0) {
      insights.push({
        id: `insight-${Date.now()}-3`,
        type: 'opportunity',
        title: 'Rate Optimization Opportunity',
        message: `Your average rate ($${avgRequestedRate.toFixed(0)}/hr) is higher than market average ($${avgOfferedRate.toFixed(0)}/hr). Consider flexible pricing for more opportunities.`,
        actionable: true,
        priority: 'medium',
        createdAt: now,
        data: { yourRate: avgRequestedRate, marketRate: avgOfferedRate }
      });
    }

    // New opportunities insight
    const newOpportunities = opportunities.filter(opp => 
      new Date(opp.createdAt).getTime() > Date.now() - (24 * 60 * 60 * 1000)
    );

    if (newOpportunities.length > 0) {
      insights.push({
        id: `insight-${Date.now()}-4`,
        type: 'opportunity',
        title: 'Fresh Opportunities Available',
        message: `${newOpportunities.length} new opportunities posted in the last 24 hours. Apply early for better chances!`,
        actionable: true,
        priority: 'high',
        createdAt: now,
        data: { count: newOpportunities.length, opportunities: newOpportunities }
      });
    }

    // Activity streak insight
    const recentActivity = applications.filter(app => 
      new Date(app.appliedAt).getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000)
    );

    if (recentActivity.length >= 3) {
      insights.push({
        id: `insight-${Date.now()}-5`,
        type: 'achievement',
        title: 'Stay Active Streak!',
        message: `You've applied to ${recentActivity.length} positions this week. Consistent activity leads to more opportunities!`,
        actionable: false,
        priority: 'low',
        createdAt: now,
        data: { weeklyApplications: recentActivity.length }
      });
    }

    return insights;
  }

  // Generate insights for gym owners
  async generateOwnerInsights(ownerId: string, requests: any[], applications: any[]): Promise<CoachingInsight[]> {
    const insights: CoachingInsight[] = [];
    const now = new Date();

    // Fill rate and demand analysis
    const filledRequests = requests.filter(req => 
      applications.some(app => app.requestId === req.id && app.status === 'accepted')
    );
    const fillRate = requests.length > 0 ? (filledRequests.length / requests.length) * 100 : 0;
    
    if (requests.length >= 2) {
      if (fillRate > 85) {
        insights.push({
          id: `insight-${Date.now()}-1`,
          type: 'achievement',
          title: 'Excellent Substitute Coverage',
          message: `${fillRate.toFixed(0)}% of your positions get filled! Your gym is a popular choice among coaches.`,
          actionable: false,
          priority: 'high',
          createdAt: now,
          data: { fillRate, filledCount: filledRequests.length }
        });
      } else if (fillRate < 40) {
        insights.push({
          id: `insight-${Date.now()}-2`,
          type: 'improvement',
          title: 'Boost Your Fill Rate',
          message: `Only ${fillRate.toFixed(0)}% of positions are getting filled. Consider increasing rates or improving job descriptions.`,
          actionable: true,
          priority: 'high',
          createdAt: now,
          data: { fillRate, suggestions: ['Increase hourly rate', 'Add perks/benefits', 'Flexible scheduling', 'Better location details'] }
        });
      }
    }

    // Peak demand timing insight
    const weekendRequests = requests.filter(req => {
      const day = new Date(req.startDate).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });
    
    if (weekendRequests.length > requests.length * 0.6 && requests.length >= 3) {
      insights.push({
        id: `insight-${Date.now()}-3`,
        type: 'pattern',
        title: 'Weekend Coverage Specialist',
        message: `${Math.round((weekendRequests.length / requests.length) * 100)}% of your requests are for weekends. Consider building relationships with weekend-available coaches.`,
        actionable: true,
        priority: 'medium',
        createdAt: now,
        data: { weekendPercentage: Math.round((weekendRequests.length / requests.length) * 100) }
      });
    }

    // Coach retention and relationship insights
    const acceptedApps = applications.filter(app => app.status === 'accepted');
    const uniqueCoaches = [...new Set(acceptedApps.map(app => app.coachId))];
    const repeatCoaches = uniqueCoaches.filter(coachId => 
      acceptedApps.filter(app => app.coachId === coachId).length > 1
    );

    if (repeatCoaches.length > 0) {
      insights.push({
        id: `insight-${Date.now()}-4`,
        type: 'achievement',
        title: 'Building Coach Loyalty',
        message: `${repeatCoaches.length} coaches have worked multiple shifts for you. Strong relationships lead to better coverage!`,
        actionable: true,
        priority: 'medium',
        createdAt: now,
        data: { repeatCoaches: repeatCoaches.length, totalCoaches: uniqueCoaches.length }
      });
    }

    // Competition and market positioning
    const avgOfferedRate = requests.length > 0
      ? requests.reduce((sum, req) => sum + (parseFloat(req.rateOffer) || 0), 0) / requests.length
      : 0;

    const marketRate = 28; // Realistic gymnastics coaching market rate
    
    if (avgOfferedRate > marketRate * 1.15) {
      insights.push({
        id: `insight-${Date.now()}-5`,
        type: 'opportunity',
        title: 'Premium Rate Strategy',
        message: `Your $${avgOfferedRate.toFixed(0)}/hr average is above market ($${marketRate}/hr). This attracts top-quality coaches!`,
        actionable: false,
        priority: 'medium',
        createdAt: now,
        data: { yourRate: avgOfferedRate, marketRate, premium: true }
      });
    } else if (avgOfferedRate < marketRate * 0.85) {
      insights.push({
        id: `insight-${Date.now()}-6`,
        type: 'improvement',
        title: 'Rate Competitiveness Gap',
        message: `Your $${avgOfferedRate.toFixed(0)}/hr average is below market ($${marketRate}/hr). Higher rates could attract more experienced coaches.`,
        actionable: true,
        priority: 'medium',
        createdAt: now,
        data: { yourRate: avgOfferedRate, marketRate, suggestions: ['Gradual rate increase', 'Performance bonuses', 'Loyalty incentives'] }
      });
    }

    // Urgent scheduling insights
    const lastMinuteRequests = requests.filter(req => {
      const createdDate = new Date(req.createdAt);
      const startDate = new Date(req.startDate);
      const hoursNotice = (startDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
      return hoursNotice < 48; // Less than 48 hours notice
    });

    if (lastMinuteRequests.length > requests.length * 0.4 && requests.length >= 3) {
      insights.push({
        id: `insight-${Date.now()}-7`,
        type: 'improvement',
        title: 'Last-Minute Scheduling Pattern',
        message: `${Math.round((lastMinuteRequests.length / requests.length) * 100)}% of requests are posted with <48hrs notice. Earlier posting increases fill rates.`,
        actionable: true,
        priority: 'medium',
        createdAt: now,
        data: { 
          lastMinutePercentage: Math.round((lastMinuteRequests.length / requests.length) * 100),
          suggestions: ['Plan ahead when possible', 'Build backup coach list', 'Emergency rate premium']
        }
      });
    }

    // Seasonal and growth insights
    const recentRequests = requests.filter(req => 
      new Date(req.createdAt).getTime() > Date.now() - (30 * 24 * 60 * 60 * 1000)
    );
    
    if (recentRequests.length >= 3 && requests.length >= 5) {
      insights.push({
        id: `insight-${Date.now()}-8`,
        type: 'achievement',
        title: 'Active Coaching Operation',
        message: `${recentRequests.length} requests in the last 30 days shows strong program activity. Your gym is thriving!`,
        actionable: false,
        priority: 'low',
        createdAt: now,
        data: { monthlyRequests: recentRequests.length, growthTrend: 'positive' }
      });
    }

    // Quality and specialization insights
    const recreationRequests = requests.filter(req => req.eventType === 'Recreation');
    const teamRequests = requests.filter(req => req.eventType === 'Team');
    const ninjaRequests = requests.filter(req => req.eventType === 'Ninja');

    const dominantType = recreationRequests.length > teamRequests.length && recreationRequests.length > ninjaRequests.length ? 'Recreation' :
                        teamRequests.length > ninjaRequests.length ? 'Team' : 'Ninja';

    if (requests.length >= 4) {
      const dominantCount = requests.filter(req => req.eventType === dominantType).length;
      const percentage = Math.round((dominantCount / requests.length) * 100);
      
      if (percentage > 70) {
        insights.push({
          id: `insight-${Date.now()}-9`,
          type: 'pattern',
          title: `${dominantType} Program Focus`,
          message: `${percentage}% of your substitute needs are for ${dominantType} classes. Consider developing specialist coach relationships.`,
          actionable: true,
          priority: 'low',
          createdAt: now,
          data: { programType: dominantType, percentage, specialization: true }
        });
      }
    }

    return insights;
  }

  // Create notification
  async createNotification(notification: Omit<NotificationData, 'id' | 'createdAt'>): Promise<NotificationData> {
    const newNotification: NotificationData = {
      ...notification,
      id: `notif-${Date.now()}`,
      createdAt: new Date(),
    };

    this.notifications.push(newNotification);
    return newNotification;
  }

  // Get notifications for user
  async getNotifications(userId: string, limit = 10): Promise<NotificationData[]> {
    return this.notifications
      .filter(notif => notif.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    return this.notifications.filter(n => n.userId === userId && !n.read).length;
  }

  // Send email notification if enabled
  async sendEmailNotification(
    userId: string, 
    email: string, 
    subject: string, 
    content: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    if (preferences.emailEnabled) {
      try {
        await emailService.sendEmail({
          to: email,
          from: 'notifications@subcoachpro.com',
          subject,
          html: content
        });
      } catch (error) {
        console.error('Failed to send email notification:', error);
      }
    }
  }

  // Generate weekly digest for coaches
  async generateCoachWeeklyDigest(coachId: string, email: string): Promise<void> {
    // This would aggregate weekly stats and send via email
    const weeklyStats = {
      applicationsSubmitted: 3,
      newOpportunities: 7,
      acceptanceRate: 75,
      averageRate: 45
    };

    const digestContent = `
      <h2>Your Weekly Coaching Summary</h2>
      <p>Here's how your week looked:</p>
      <ul>
        <li>Applications submitted: ${weeklyStats.applicationsSubmitted}</li>
        <li>New opportunities available: ${weeklyStats.newOpportunities}</li>
        <li>Acceptance rate: ${weeklyStats.acceptanceRate}%</li>
        <li>Average requested rate: $${weeklyStats.averageRate}/hr</li>
      </ul>
      <p>Keep up the great work!</p>
    `;

    try {
      await emailService.sendEmail({
        to: email,
        from: 'digest@subcoachpro.com',
        subject: 'Your Weekly SubCoach Summary',
        html: digestContent
      });
    } catch (error) {
      console.error('Failed to send weekly digest:', error);
    }
  }

  // Generate achievement notifications
  async checkAchievements(userId: string, userType: 'coach' | 'owner', data: any): Promise<void> {
    if (userType === 'coach') {
      const { applications, acceptedCount } = data;
      
      // First application milestone
      if (applications.length === 1) {
        await this.createNotification({
          userId,
          userType,
          type: 'achievement',
          title: 'Welcome to SubCoach Pro!',
          message: 'You submitted your first application! Great start on your coaching journey.',
          read: false,
          actionUrl: '/coach?tab=applications'
        });
      }

      // Five accepted jobs milestone
      if (acceptedCount === 5) {
        await this.createNotification({
          userId,
          userType,
          type: 'achievement',
          title: 'Rising Star Coach!',
          message: 'Congratulations! You\'ve completed 5 successful coaching positions.',
          read: false,
          actionUrl: '/coach?tab=experience'
        });
      }
    } else if (userType === 'owner') {
      const { requests, filledCount } = data;

      // First request milestone
      if (requests.length === 1) {
        await this.createNotification({
          userId,
          userType,
          type: 'achievement',
          title: 'Welcome to SubCoach Pro!',
          message: 'You posted your first substitute request! Qualified coaches will start applying soon.',
          read: false,
          actionUrl: '/owner?tab=requests'
        });
      }

      // Ten filled positions milestone
      if (filledCount === 10) {
        await this.createNotification({
          userId,
          userType,
          type: 'achievement',
          title: 'Staffing Pro!',
          message: 'Amazing! You\'ve successfully filled 10 positions through SubCoach Pro.',
          read: false,
          actionUrl: '/owner?tab=analytics'
        });
      }
    }
  }
}

export const notificationService = new NotificationService();
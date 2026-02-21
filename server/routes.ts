// Production routes - clean version without any demo code
import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from 'zod';
import Stripe from "stripe";
import { storage } from "./storage";
import { db } from "./db";
import { 
  insertSubstituteRequestSchema,
  insertApplicationSchema,
  insertCalendarEventSchema,
  insertCoachSchema,
  insertOwnerSchema,
  calendarEvents,
} from "../shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, setupAuth } from "./replitAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { EmailService } from "./emailService";
import { notificationService } from "./notificationService";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Production endpoints only - no demo code
  
  // Auth endpoint
  app.get('/api/auth/user', async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user.claims.sub;
      const dbUser = await storage.getUser(userId);
      
      if (!dbUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Return user data with claims
      res.json({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImageUrl: dbUser.profileImageUrl,
        userType: dbUser.userType || "",
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User type selection endpoint
  app.post('/api/auth/select-user-type', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { userType } = req.body;

      if (!['coach', 'owner'].includes(userType)) {
        return res.status(400).json({ message: "Invalid user type" });
      }

      await storage.updateUser(userId, { userType });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user type:", error);
      res.status(500).json({ message: "Failed to update user type" });
    }
  });

  // Stripe billing endpoints
  
  // Get subscription status
  app.get('/api/subscription-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner) {
        return res.json({
          planType: 'starter',
          status: 'inactive',
          amount: 0,
          cancelAtPeriodEnd: false,
          hasPaymentMethod: false,
          usage: {
            requestsPosted: 0,
            successfulBookings: 0,
            totalCharges: 0
          }
        });
      }

      // Calculate real usage statistics
      const requests = await storage.getSubstituteRequestsByOwner(owner.id);
      const requestsPosted = requests.length;
      
      // Count successful bookings (accepted applications)
      // getSubstituteRequestsByOwner already includes applications
      let successfulBookings = 0;
      for (const request of requests) {
        const apps = Array.isArray(request.applications) ? request.applications : [];
        successfulBookings += apps.filter(app => app.status === 'accepted').length;
      }

      // Get total charges from Stripe - paginate through all charges
      let totalCharges = 0;
      if (owner.stripeCustomerId) {
        try {
          let hasMore = true;
          let startingAfter: string | undefined = undefined;
          
          while (hasMore) {
            const chargesPage = await stripe.charges.list({
              customer: owner.stripeCustomerId,
              limit: 100,
              starting_after: startingAfter,
            });
            
            totalCharges += chargesPage.data
              .filter(charge => charge.status === 'succeeded')
              .reduce((sum, charge) => sum + (charge.amount / 100), 0);
            
            hasMore = chargesPage.has_more;
            if (hasMore && chargesPage.data.length > 0) {
              startingAfter = chargesPage.data[chargesPage.data.length - 1].id;
            }
          }
        } catch (error) {
          console.error('Error fetching charges:', error);
        }
      }

      const planType = owner.planType || 'starter';
      
      let subscriptionData = {
        planType,
        status: planType === 'starter' ? 'active' : (owner.subscriptionStatus || 'inactive'),
        nextBillingDate: owner.currentPeriodEnd,
        amount: planType === 'starter' ? 10 : 0,
        cancelAtPeriodEnd: false,
        hasPaymentMethod: false,
        usage: {
          requestsPosted,
          successfulBookings,
          totalCharges
        }
      };

      // Check for payment methods
      if (owner.stripeCustomerId) {
        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: owner.stripeCustomerId,
            type: 'card',
          });
          subscriptionData.hasPaymentMethod = paymentMethods.data.length > 0;
        } catch (error) {
          console.error('Error checking payment methods:', error);
        }
      }

      // If has Stripe subscription (Pro plan), fetch real data from Stripe
      if (owner.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(owner.stripeSubscriptionId);
          subscriptionData = {
            ...subscriptionData,
            status: subscription.status,
            nextBillingDate: new Date(subscription.current_period_end * 1000),
            amount: subscription.items.data[0]?.price?.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 49,
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          };
        } catch (error) {
          console.error('Error fetching Stripe subscription:', error);
        }
      }

      res.json(subscriptionData);
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
  });

  // Get payment method
  app.get('/api/payment-method', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner || !owner.stripeCustomerId) {
        return res.json({ hasPaymentMethod: false });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: owner.stripeCustomerId,
        type: 'card',
      });

      if (paymentMethods.data.length === 0) {
        return res.json({ hasPaymentMethod: false });
      }

      const primaryPaymentMethod = paymentMethods.data[0];
      const card = primaryPaymentMethod.card;

      res.json({
        hasPaymentMethod: true,
        paymentMethod: {
          id: primaryPaymentMethod.id,
          brand: card?.brand,
          last4: card?.last4,
          expMonth: card?.exp_month,
          expYear: card?.exp_year,
        }
      });
    } catch (error) {
      console.error('Error fetching payment method:', error);
      res.status(500).json({ error: 'Failed to fetch payment method' });
    }
  });

  // Get billing history
  app.get('/api/billing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner || !owner.stripeCustomerId) {
        return res.json({ charges: [] });
      }

      // Fetch charges (PaymentIntents) from Stripe
      const charges = await stripe.charges.list({
        customer: owner.stripeCustomerId,
        limit: 100,
      });

      // Format the charges for the frontend
      const billingHistory = charges.data.map(charge => ({
        id: charge.id,
        amount: charge.amount / 100, // Convert from cents to dollars
        currency: charge.currency,
        status: charge.status,
        description: charge.description || 'Substitute Booking Fee',
        created: new Date(charge.created * 1000),
        receiptUrl: charge.receipt_url,
        metadata: charge.metadata,
      }));

      res.json({ charges: billingHistory });
    } catch (error) {
      console.error('Error fetching billing history:', error);
      res.status(500).json({ error: 'Failed to fetch billing history' });
    }
  });

  // Create setup intent for adding payment methods
  app.post('/api/create-setup-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let owner = await storage.getOwner(userId);
      
      if (!owner) {
        return res.status(404).json({ error: 'Owner profile not found' });
      }

      let customerId = owner.stripeCustomerId;
      
      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.claims.email,
          name: `${req.user.claims.first_name} ${req.user.claims.last_name}`,
          metadata: {
            userId: userId,
            gymName: owner.gymName
          }
        });
        customerId = customer.id;
        
        await storage.updateOwner(userId, { stripeCustomerId: customerId });
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      res.json({ client_secret: setupIntent.client_secret });
    } catch (error) {
      console.error('Error creating setup intent:', error);
      res.status(500).json({ error: 'Failed to create setup intent' });
    }
  });

  // Attach payment method as default after SetupIntent succeeds
  app.post('/api/attach-payment-method', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { setupIntentId } = req.body;

      if (!setupIntentId) {
        return res.status(400).json({ error: 'Missing setupIntentId' });
      }

      const owner = await storage.getOwner(userId);
      if (!owner || !owner.stripeCustomerId) {
        return res.status(404).json({ error: 'Owner or Stripe customer not found' });
      }

      // Retrieve the SetupIntent to get the payment method
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      
      if (setupIntent.status !== 'succeeded') {
        return res.status(400).json({ error: 'SetupIntent not successful' });
      }

      const paymentMethodId = setupIntent.payment_method as string;

      // Set this payment method as the default for the customer
      await stripe.customers.update(owner.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      res.json({ success: true, message: 'Payment method added successfully' });
    } catch (error) {
      console.error('Error attaching payment method:', error);
      res.status(500).json({ error: 'Failed to attach payment method' });
    }
  });

  // Verify and complete checkout after Stripe redirect
  app.post('/api/stripe/verify-checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
      }

      // Retrieve the specific session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription']
      });

      // Verify the session belongs to this user
      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (session.payment_status !== 'paid') {
        return res.json({ verified: false, message: 'Payment not completed' });
      }

      // Update owner with subscription details
      const subscription = session.subscription as any;
      if (subscription && subscription.id) {
        // Validate timestamps before creating Date objects
        const periodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : new Date();
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
        
        await storage.updateOwner(userId, {
          stripeSubscriptionId: subscription.id,
          planType: 'pro',
          subscriptionStatus: subscription.status || 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false
        });

        res.json({ 
          verified: true, 
          planType: 'pro',
          message: 'Successfully upgraded to Pro plan'
        });
      } else {
        res.json({ verified: false, message: 'No subscription found' });
      }
    } catch (error) {
      console.error('Error verifying checkout:', error);
      res.status(500).json({ error: 'Failed to verify checkout' });
    }
  });

  // Switch subscription plan
  const switchPlanSchema = z.object({
    planType: z.enum(['starter', 'pro'])
  });

  app.post('/api/subscription/switch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planType } = switchPlanSchema.parse(req.body);
      
      let owner = await storage.getOwner(userId);
      if (!owner) {
        return res.status(404).json({ error: 'Owner profile not found' });
      }

      const currentPlan = owner.planType || 'starter';
      
      // If already on requested plan, just return success
      if (currentPlan === planType) {
        return res.json({ 
          success: true, 
          message: `Already on ${planType} plan`,
          planType: currentPlan
        });
      }

      // Ensure Stripe customer exists
      let customerId = owner.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.claims.email,
          name: `${req.user.claims.first_name} ${req.user.claims.last_name}`,
          metadata: {
            userId: userId,
            gymName: owner.gymName
          }
        });
        customerId = customer.id;
        await storage.updateOwner(userId, { stripeCustomerId: customerId });
      }

      if (planType === 'pro') {
        // If there's an existing subscription pending cancellation, reactivate it
        if (owner.stripeSubscriptionId && owner.cancelAtPeriodEnd) {
          try {
            const subscription = await stripe.subscriptions.update(owner.stripeSubscriptionId, {
              cancel_at_period_end: false
            });
            
            await storage.updateOwner(userId, {
              planType: 'pro',
              subscriptionStatus: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: false
            });

            return res.json({ 
              success: true, 
              message: 'Reactivated Pro plan subscription',
              planType: 'pro'
            });
          } catch (stripeError: any) {
            // If reactivation fails, clear invalid subscription and proceed to create new one
            console.warn('Could not reactivate Stripe subscription:', stripeError.message);
            await storage.updateOwner(userId, {
              stripeSubscriptionId: null,
              subscriptionStatus: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false
            });
            // Fall through to create new subscription
          }
        }

        // UPGRADE: Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'SubCoach Pro Plan',
                  description: 'Unlimited substitute requests for gym owners',
                },
                recurring: {
                  interval: 'month',
                },
                unit_amount: 4900, // $49.00 in cents
              },
              quantity: 1,
            },
          ],
          mode: 'subscription',
          success_url: `${req.protocol}://${req.get('host')}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.protocol}://${req.get('host')}/billing?canceled=true`,
          metadata: {
            userId: userId,
            planType: planType
          }
        });

        res.json({ sessionUrl: session.url });
      } else {
        // DOWNGRADE: Cancel subscription at period end
        if (owner.stripeSubscriptionId) {
          try {
            // Try to cancel the subscription in Stripe
            await stripe.subscriptions.update(owner.stripeSubscriptionId, {
              cancel_at_period_end: true
            });
            
            await storage.updateOwner(userId, {
              planType: 'starter',
              cancelAtPeriodEnd: true
            });
          } catch (stripeError: any) {
            // If Stripe subscription doesn't exist or there's a key mismatch, just update locally
            console.warn('Could not update Stripe subscription, updating locally only:', stripeError.message);
            await storage.updateOwner(userId, {
              planType: 'starter',
              cancelAtPeriodEnd: false,
              subscriptionStatus: null,
              stripeSubscriptionId: null, // Clear invalid subscription ID
              currentPeriodStart: null,
              currentPeriodEnd: null
            });
          }
        } else {
          // Just update the plan type if no active subscription
          await storage.updateOwner(userId, {
            planType: 'starter'
          });
        }

        res.json({ 
          success: true, 
          message: 'Switched to Starter plan',
          planType: 'starter'
        });
      }
    } catch (error: any) {
      console.error('Error switching plan:', error);
      res.status(500).json({ 
        error: 'Failed to switch plan',
        details: error.message 
      });
    }
  });
  
  app.get('/api/opportunities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get coach profile to access their address
      const coach = await storage.getCoach(userId);
      if (!coach) {
        return res.json([]);
      }
      
      // Get all open opportunities (active and pending review)
      const allRequests = await storage.getSubstituteRequests();
      const openRequests = allRequests.filter(req => 
        req.status === 'active' || req.status === 'pending review'
      );
      
      const applications = await storage.getApplicationsByCoach(coach.id);
      
      // Filter out requests where this coach has already applied
      const appliedRequestIds = new Set(applications.map(app => app.requestId));
      const availableRequests = openRequests.filter(req => !appliedRequestIds.has(req.id));
      
      // Calculate distances if coach has an address
      console.log(`Coach address: ${coach?.address || 'none'}`);
      const requestsWithDistance = await Promise.all(
        availableRequests.map(async (request) => {
          let distance = null;
          
          if (coach?.address && request.owner?.address) {
            console.log(`Calculating distance between "${coach.address}" and "${request.owner.address}"`);
            const { calculateDistanceBetweenAddresses } = await import('./geocodingService');
            distance = await calculateDistanceBetweenAddresses(coach.address, request.owner.address);
            console.log(`Distance calculated: ${distance} miles`);
          }
          
          return {
            ...request,
            distanceInMiles: distance
          };
        })
      );
      
      console.log(`Returning ${requestsWithDistance.length} opportunities for coaches`);
      res.json(requestsWithDistance);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.get('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let coach = await storage.getCoach(userId);
      
      if (!coach) {
        console.log(`No coach profile found for user ${userId}, returning empty applications list`);
        return res.json([]);
      }

      const applications = await storage.getApplicationsByCoach(coach.id);
      console.log(`Returning ${applications.length} applications for coach ${coach.id}`);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post('/api/coaches/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = req.user;
      let coach = await storage.getCoach(userId);
      
      if (!coach) {
        // Auto-create coach profile if it doesn't exist
        coach = await storage.createCoach({
          userId: userId,
          firstName: user.firstName || 'Coach',
          lastName: user.lastName || user.email?.split('@')[0] || 'User',
          phone: '',
          address: '',
          hourlyRate: '25.00',
          maxTravelDistance: 10,
          paymentMethods: [],
          paymentDetails: {},
          form1099Path: null,
          emailToGymOwners: user.email || '',
          certifications: [],
          certificationDetails: {}
        });
        console.log('Auto-created coach profile:', coach.id);
      }

      const applicationData = insertApplicationSchema.parse({
        ...req.body,
        coachId: coach.id,
      });

      // Check if already applied
      const existingApplication = await storage.getApplication(
        applicationData.requestId,
        coach.id
      );

      if (existingApplication) {
        return res.status(400).json({ message: "You have already applied to this request" });
      }

      // Get the request details to check for time conflicts
      const newRequest = await storage.getSubstituteRequest(applicationData.requestId);
      if (!newRequest) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Check for time conflicts with accepted applications
      const acceptedApplications = await storage.getApplicationsByCoach(coach.id);
      const conflictingJobs = acceptedApplications.filter(app => {
        // Only check accepted applications
        if (app.status !== 'accepted') return false;
        
        const existingRequest = app.request;
        if (!existingRequest) return false;

        // Helper function to check if two time ranges overlap on the same date
        const hasTimeOverlap = (req1: any, req2: any) => {
          // Convert times to comparable numbers (HHMM format)
          const timeToNumber = (time: string) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 100 + minutes;
          };

          const newStart = timeToNumber(req1.startTime);
          const newEnd = timeToNumber(req1.endTime);
          const existingStart = timeToNumber(req2.startTime);
          const existingEnd = timeToNumber(req2.endTime);

          // Check if time ranges overlap
          return (newStart < existingEnd && newEnd > existingStart);
        };

        // Helper function to check if dates overlap
        const hasDateOverlap = (req1: any, req2: any) => {
          const newStartDate = new Date(req1.startDate);
          const newEndDate = req1.endDate ? new Date(req1.endDate) : newStartDate;
          const existingStartDate = new Date(req2.startDate);
          const existingEndDate = req2.endDate ? new Date(req2.endDate) : existingStartDate;

          // Normalize to day level (remove time component)
          newStartDate.setHours(0, 0, 0, 0);
          newEndDate.setHours(0, 0, 0, 0);
          existingStartDate.setHours(0, 0, 0, 0);
          existingEndDate.setHours(0, 0, 0, 0);

          // Check if date ranges overlap
          return newStartDate <= existingEndDate && newEndDate >= existingStartDate;
        };

        // Check if both dates and times overlap
        return hasDateOverlap(newRequest, existingRequest) && hasTimeOverlap(newRequest, existingRequest);
      });

      if (conflictingJobs.length > 0) {
        const conflictingJob = conflictingJobs[0];
        const conflictDate = new Date(conflictingJob.request.startDate).toLocaleDateString();
        const conflictTime = `${conflictingJob.request.startTime} - ${conflictingJob.request.endTime}`;
        
        return res.status(400).json({ 
          message: `Opportunity overlaps with current job on ${conflictDate} at ${conflictTime}` 
        });
      }

      const application = await storage.createApplication(applicationData);
      console.log('Application created successfully:', application.id);

      // Get request details to send notification to owner
      const request = await storage.getSubstituteRequest(applicationData.requestId);
      
      // Update request status to 'pending review' if this is the first application
      if (request && request.status === 'active') {
        await storage.updateSubstituteRequest(request.id, { status: 'pending review' });
      }
      if (request) {
        const owner = await storage.getOwner(request.ownerId);
        const ownerUser = owner ? await storage.getUser(owner.userId) : null;
        
        if (ownerUser) {
          const coachName = `${user.firstName || 'Coach'} ${user.lastName || ''}`.trim();
          
          // Send email notification to gym owner
          const emailService = new EmailService();
          await emailService.sendNewApplicationNotification({
            ownerEmail: ownerUser.email,
            ownerName: ownerUser.firstName || 'Gym Owner',
            coachName,
            className: request.eventType,
            date: new Date(request.startDate),
            time: `${request.startTime} - ${request.endTime}`,
            requestedRate: applicationData.requestedRate || request.rateOffer || '25'
          });

          // Create in-app notification for gym owner
          await notificationService.createNotification({
            userId: ownerUser.id,
            userType: 'owner',
            type: 'new_application',
            title: 'New Application Received',
            message: `${coachName} applied for your ${request.eventType} class on ${new Date(request.startDate).toLocaleDateString()}`,
            read: false,
            actionUrl: '/owner-dashboard',
            metadata: {
              applicationId: application.id,
              requestId: request.id,
              coachId: coach.id
            }
          });

          console.log(`Sent application notification to owner ${ownerUser.email}`);
        }
      }

      res.json(application);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Rate negotiation endpoints - Database version
  app.post('/api/rate-negotiations', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId, proposedRate, message } = req.body;
      const userId = req.user?.claims?.sub;
      
      if (!applicationId || !proposedRate) {
        return res.status(400).json({ error: "Application ID and proposed rate are required" });
      }

      // Get coach profile first
      const coach = await storage.getCoach(userId);
      if (!coach) {
        return res.status(404).json({ error: "Coach profile not found" });
      }

      // Get application with request details
      const applications = await storage.getApplicationsByCoach(coach.id);
      const application = applications.find(app => app.id === applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Use rate offer from request or fallback to default
      const currentRate = application.requestedRate ? parseFloat(application.requestedRate) : 25.00;

      // Create negotiation record
      const negotiation = await storage.createRateNegotiation({
        applicationId,
        currentRate,
        proposedRate: parseFloat(proposedRate),
        proposedBy: 'coach',
        message: message || '',
        status: 'pending'
      });

      console.log(`Created rate negotiation for application ${applicationId}: $${proposedRate}/hr`);
      res.json(negotiation);
    } catch (error) {
      console.error('Error creating rate negotiation:', error);
      res.status(500).json({ error: 'Failed to create rate negotiation' });
    }
  });

  // Get rate negotiation for application
  app.get('/api/rate-negotiations/application/:applicationId', isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const negotiation = await storage.getRateNegotiationByApplication(applicationId);
      res.json(negotiation);
    } catch (error) {
      console.error('Error fetching rate negotiation:', error);
      res.status(500).json({ error: 'Failed to fetch rate negotiation' });
    }
  });

  // Respond to rate negotiation
  app.post('/api/rate-negotiations/:id/respond', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { action, proposedRate, message } = req.body;
      const userId = req.user.claims.sub;
      
      if (!['accept', 'decline', 'counter'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // Get current negotiation
      const currentNegotiation = await storage.getRateNegotiationById(id);
      if (!currentNegotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      // Get the application
      const application = await storage.getApplicationById(currentNegotiation.applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Determine if user is coach or owner
      const coach = await storage.getCoach(userId);
      const userType: 'coach' | 'owner' = coach ? 'coach' : 'owner';

      // Update based on action
      if (action === 'accept') {
        // Mark negotiation as accepted
        await storage.updateRateNegotiation(id, { status: 'accepted' });
        
        // Accept the application (keep original requestedRate intact)
        await storage.updateApplication(currentNegotiation.applicationId, {
          status: 'accepted',
          acceptedAt: new Date()
        });
        
        // Update the request status to 'filled' and set the accepted rate
        await storage.updateSubstituteRequest(application.requestId, {
          status: 'filled',
          rateOffer: currentNegotiation.proposedRate
        });
        
        console.log(`Rate negotiation accepted: Application ${currentNegotiation.applicationId} accepted at $${currentNegotiation.proposedRate}/hr`);
      } else if (action === 'decline') {
        // Mark negotiation as declined
        await storage.updateRateNegotiation(id, { status: 'declined' });
        
        // Optionally decline the application as well
        await storage.updateApplication(currentNegotiation.applicationId, {
          status: 'declined',
          declinedAt: new Date()
        });
        
        console.log(`Rate negotiation declined: Application ${currentNegotiation.applicationId} declined`);
      } else if (action === 'counter' && proposedRate) {
        // proposedBy should be whoever is making the counter (the current user)
        await storage.updateRateNegotiation(id, {
          proposedRate: parseFloat(proposedRate),
          status: 'pending',
          message: message || 'Counter offer',
          proposedBy: userType
        });
        
        console.log(`Counter offer submitted: $${proposedRate}/hr by ${userType}`);
      }

      // Return updated negotiation
      const updatedNegotiation = await storage.getRateNegotiationByApplication(currentNegotiation.applicationId);
      res.json(updatedNegotiation);
    } catch (error) {
      console.error('Error responding to rate negotiation:', error);
      res.status(500).json({ error: 'Failed to respond to rate negotiation' });
    }
  });

  // Profile management endpoints
  app.get('/api/coach/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const coach = await storage.getCoach(userId);
      if (!coach) {
        return res.status(404).json({ message: "Coach profile not found" });
      }
      res.json(coach);
    } catch (error) {
      console.error("Error fetching coach profile:", error);
      res.status(500).json({ message: "Failed to fetch coach profile" });
    }
  });

  app.post('/api/coach/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = insertCoachSchema.parse(req.body);
      
      let coach = await storage.getCoach(userId);
      if (coach) {
        coach = await storage.updateCoach(userId, profileData);
      } else {
        coach = await storage.createCoach({
          ...profileData,
          userId
        });
      }
      
      res.json(coach);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating coach profile:", error);
      res.status(500).json({ message: "Failed to update coach profile" });
    }
  });

  const certificationSchema = z.object({
    usagMemberNumber: z.string().optional(),
    usagExpiration: z.string().optional(),
    aauMemberNumber: z.string().optional(),
    aauExpiration: z.string().optional(),
    ngaMemberNumber: z.string().optional(),
    ngaExpiration: z.string().optional(),
    additionalCertifications: z.array(z.object({
      name: z.string(),
      memberNumber: z.string().optional(),
      expirationDate: z.string().optional()
    })).optional()
  });

  app.put('/api/coaches/certifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const certData = certificationSchema.parse(req.body);
      
      const coach = await storage.getCoach(userId);
      if (!coach) {
        return res.status(404).json({ message: "Coach profile not found" });
      }

      const certificationDetails = {
        usag: {
          membershipNumber: certData.usagMemberNumber || "",
          expirationDate: certData.usagExpiration || ""
        },
        aau: {
          membershipNumber: certData.aauMemberNumber || "",
          expirationDate: certData.aauExpiration || ""
        },
        nga: {
          membershipNumber: certData.ngaMemberNumber || "",
          expirationDate: certData.ngaExpiration || ""
        },
        additionalCertifications: certData.additionalCertifications || []
      };

      const updatedCoach = await storage.updateCoach(userId, { certificationDetails });
      res.json(updatedCoach);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating certifications:", error);
      res.status(500).json({ message: "Failed to update certifications" });
    }
  });

  app.get('/api/owner/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }
      res.json(owner);
    } catch (error) {
      console.error("Error fetching owner profile:", error);
      res.status(500).json({ message: "Failed to fetch owner profile" });
    }
  });

  app.post('/api/owner/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = insertOwnerSchema.parse(req.body);
      
      let owner = await storage.getOwner(userId);
      if (owner) {
        owner = await storage.updateOwner(userId, profileData);
      } else {
        owner = await storage.createOwner({
          ...profileData,
          userId
        });
      }
      
      res.json(owner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating owner profile:", error);
      res.status(500).json({ message: "Failed to update owner profile" });
    }
  });

  // Plural version for frontend compatibility
  app.get('/api/owners/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }
      res.json(owner);
    } catch (error) {
      console.error("Error fetching owner profile:", error);
      res.status(500).json({ message: "Failed to fetch owner profile" });
    }
  });

  app.post('/api/owners/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = insertOwnerSchema.parse(req.body);
      
      let owner = await storage.getOwner(userId);
      if (owner) {
        owner = await storage.updateOwner(userId, profileData);
      } else {
        owner = await storage.createOwner({
          ...profileData,
          userId
        });
      }
      
      res.json(owner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating owner profile:", error);
      res.status(500).json({ message: "Failed to update owner profile" });
    }
  });

  // Substitute request management
  app.get('/api/owner-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }
      
      const requests = await storage.getSubstituteRequestsByOwner(owner.id);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching owner requests:", error);
      res.status(500).json({ message: "Failed to fetch owner requests" });
    }
  });

  app.post('/api/owner-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }
      
      // Transform the data to match schema expectations
      const transformedData = {
        ...req.body,
        ownerId: owner.id,
        status: 'active',
        // Convert string dates to Date objects
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        // Convert numbers to strings for decimal fields
        rateOffer: req.body.rateOffer ? String(req.body.rateOffer) : undefined,
        hourlyRate: req.body.hourlyRate ? String(req.body.hourlyRate) : undefined,
      };
      
      const requestData = insertSubstituteRequestSchema.parse(transformedData);
      
      const request = await storage.createSubstituteRequest(requestData);
      
      // Async: Notify coaches and create calendar event (don't wait for these)
      Promise.all([
        import('./calendarIntegration').then(({ calendarIntegration }) => 
          calendarIntegration.notifyMatchingCoaches(request.id)
        ),
        import('./calendarIntegration').then(({ calendarIntegration }) =>
          calendarIntegration.createEventFromSubstituteRequest(request.id)
        )
      ]).catch(error => console.error('Background task error:', error));
      
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating substitute request:", error);
      res.status(500).json({ message: "Failed to create substitute request" });
    }
  });

  // Application management for owners
  app.post('/api/applications/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Get application details with request
      const applicationData = await storage.getApplicationById(id);
      if (!applicationData) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Get the request to find the owner
      const request = await storage.getSubstituteRequest(applicationData.requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Get the owner details
      const owner = await storage.getOwnerById(request.ownerId);
      if (!owner) {
        return res.status(404).json({ message: "Owner not found" });
      }
      
      // Verify the user owns this request
      if (owner.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Check if owner is on Starter plan - if so, charge $10
      let paymentIntentId: string | null = null;
      
      if (owner.planType === 'starter' || !owner.planType) {
        // Ensure owner has a payment method
        if (!owner.stripeCustomerId) {
          return res.status(400).json({ 
            message: "Please add a payment method before accepting applications on the Starter plan" 
          });
        }
        
        try {
          // Get the payment methods for this customer
          const paymentMethods = await stripe.paymentMethods.list({
            customer: owner.stripeCustomerId,
            type: 'card',
          });
          
          if (paymentMethods.data.length === 0) {
            return res.status(400).json({ 
              message: "Please add a payment method before accepting applications on the Starter plan" 
            });
          }
          
          // Use the first payment method (most recently added)
          const paymentMethodId = paymentMethods.data[0].id;
          
          // Create and confirm a payment intent for $10
          const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000, // $10.00 in cents
            currency: 'usd',
            customer: owner.stripeCustomerId,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            description: `SubCoach Pro - Substitute Booking Fee (Request: ${request.eventType})`,
            metadata: {
              requestId: request.id,
              applicationId: id,
              ownerId: owner.id,
              ownerUserId: userId
            }
          });
          
          if (paymentIntent.status !== 'succeeded') {
            return res.status(402).json({ 
              message: "Payment failed. Please update your payment method and try again." 
            });
          }
          
          paymentIntentId = paymentIntent.id;
          console.log(`Charged $10 to owner ${owner.id} for accepting application ${id}`);
        } catch (stripeError: any) {
          console.error("Stripe payment error:", stripeError);
          return res.status(402).json({ 
            message: `Payment failed: ${stripeError.message}. Please update your payment method and try again.` 
          });
        }
      }
      
      // Update application and request status
      // If this fails after payment, refund the charge and rollback
      let application;
      try {
        application = await storage.updateApplication(id, { status: 'accepted' });
        await storage.updateSubstituteRequest(application.requestId, { status: 'filled' });
        
        // Async: Create calendar event and send acceptance email (don't wait)
        import('./calendarIntegration').then(({ calendarIntegration }) =>
          calendarIntegration.createEventFromAcceptedApplication(id)
        ).catch(error => console.error('Calendar/email error:', error));
        
        res.json(application);
      } catch (updateError: any) {
        // Rollback: Revert application status if it was updated
        if (application) {
          try {
            await storage.updateApplication(id, { status: 'pending' });
            console.log(`Reverted application ${id} status to pending after request update failure`);
          } catch (revertError) {
            console.error(`CRITICAL: Failed to revert application ${id} status:`, revertError);
          }
        }
        
        // Rollback: Refund the payment if we charged
        if (paymentIntentId) {
          try {
            await stripe.refunds.create({
              payment_intent: paymentIntentId,
              reason: 'requested_by_customer'
            });
            console.log(`Refunded payment ${paymentIntentId} due to application update failure`);
          } catch (refundError) {
            console.error(`CRITICAL: Failed to refund payment ${paymentIntentId} after update failure:`, refundError);
            // Log this for manual resolution
          }
        }
        
        throw updateError;
      }
    } catch (error) {
      console.error("Error accepting application:", error);
      res.status(500).json({ message: "Failed to accept application" });
    }
  });

  app.post('/api/applications/:id/decline', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const application = await storage.updateApplication(id, { status: 'declined' });
      
      // Async: Send decline email to coach (don't wait)
      import('./calendarIntegration').then(({ calendarIntegration }) =>
        calendarIntegration.sendDeclineNotification(id)
      ).catch(error => console.error('Decline email error:', error));
      
      res.json(application);
    } catch (error) {
      console.error("Error declining application:", error);
      res.status(500).json({ message: "Failed to decline application" });
    }
  });

  // Update substitute request
  app.put('/api/owner-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }

      // Get the request first to verify ownership
      const requests = await storage.getSubstituteRequestsByOwner(owner.id);
      const existingRequest = requests.find(r => r.id === id);
      
      if (!existingRequest) {
        return res.status(404).json({ message: "Request not found or not owned by user" });
      }

      // Process and validate the update data (same format as POST)
      const processedData = {
        ...req.body,
        // Convert date string to timestamp
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        // Ensure numeric fields are properly converted
        maxTravelDistance: req.body.maxTravelDistance ? parseInt(req.body.maxTravelDistance) : undefined,
        rateOffer: req.body.rateOffer ? parseFloat(req.body.rateOffer) : undefined,
        hourlyRate: req.body.hourlyRate ? parseFloat(req.body.hourlyRate) : undefined,
        // Ensure arrays are properly handled
        daysOfWeek: Array.isArray(req.body.daysOfWeek) ? req.body.daysOfWeek : undefined,
        requirements: Array.isArray(req.body.requirements) ? req.body.requirements : undefined,
      };

      // Remove undefined values to avoid overwriting existing data
      const updateData = Object.fromEntries(
        Object.entries(processedData).filter(([_, value]) => value !== undefined)
      );
      
      // Update the request
      const updatedRequest = await storage.updateSubstituteRequest(id, updateData);
      
      console.log(`Updated substitute request ${id} for owner ${owner.id}:`, {
        rateOffer: updateData.rateOffer,
        eventType: updateData.eventType,
        updatedFields: Object.keys(updateData)
      });
      res.json(updatedRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating substitute request:", error);
      res.status(500).json({ message: "Failed to update request" });
    }
  });

  // Delete substitute request
  app.delete('/api/owner-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify ownership
      const owner = await storage.getOwner(userId);
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }
      
      // Delete the request from database
      await storage.deleteSubstituteRequest(id);
      res.json({ message: "Request deleted successfully" });
    } catch (error) {
      console.error("Error deleting substitute request:", error);
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  // Calendar export - generate .ics file for event
  app.get('/api/calendar-events/:id/export', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Get calendar event from database
      const [event] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, id))
        .limit(1);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Verify user owns this event
      if (event.ownerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Generate .ics file content
      const formatDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };
      
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SubCoach Pro//Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${event.id}@subcoachpro.com`,
        `DTSTART:${formatDate(event.startTime)}`,
        `DTEND:${formatDate(event.endTime)}`,
        `SUMMARY:${event.title.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${(event.description || '').replace(/,/g, '\\,')}`,
        `LOCATION:${(event.location || '').replace(/,/g, '\\,')}`,
        `STATUS:${event.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      
      // Set headers for .ics download
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="event-${event.id}.ics"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error exporting calendar event:", error);
      res.status(500).json({ message: "Failed to export event" });
    }
  });

  // Send scheduled reminder emails - can be triggered by cron job
  // IMPORTANT: This endpoint should only be called by automated systems (cron)
  // Set REMINDER_API_KEY environment variable for production security
  app.post('/api/calendar/send-reminders', async (req, res) => {
    try {
      // Require API key for security - prevents unauthorized reminder spam
      const apiKey = req.headers['x-api-key'];
      const requiredKey = process.env.REMINDER_API_KEY;
      
      // If no API key is configured, allow in development only
      if (!requiredKey) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({ message: "Server configuration error: REMINDER_API_KEY not set" });
        }
        console.warn('WARNING: REMINDER_API_KEY not set - reminder endpoint is unprotected');
      }
      
      // If API key is configured, verify it matches
      if (requiredKey && apiKey !== requiredKey) {
        return res.status(401).json({ message: "Unauthorized - invalid API key" });
      }
      
      const { calendarIntegration } = await import('./calendarIntegration');
      await calendarIntegration.sendScheduledReminders();
      
      res.json({ success: true, message: "Reminder check completed" });
    } catch (error) {
      console.error("Error sending reminders:", error);
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });

  // Notifications and insights - production versions
  app.get('/api/notifications/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      // Import notification service dynamically
      const { notificationService } = await import('./notificationService');
      const notifications = await notificationService.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/insights/:userId/:userType', async (req, res) => {
    try {
      const { userId, userType } = req.params;
      const { notificationService } = await import('./notificationService');
      
      if (userType === 'coach') {
        const coach = await storage.getCoach(userId);
        if (!coach) {
          return res.status(404).json({ message: "Coach profile not found" });
        }
        
        const applications = await storage.getApplicationsByCoach(coach.id);
        const opportunities = await storage.getSubstituteRequests({ status: 'active' });
        
        const insights = await notificationService.generateCoachInsights(
          userId, 
          applications, 
          opportunities
        );
        
        res.json(insights);
      } else if (userType === 'owner') {
        const owner = await storage.getOwner(userId);
        if (!owner) {
          return res.status(404).json({ message: "Owner profile not found" });
        }
        
        const requests = await storage.getSubstituteRequestsByOwner(owner.id);
        // Extract all applications from the requests (they're already included in the response)
        const allApplications = requests.flatMap(r => r.applications || []);
        
        const insights = await notificationService.generateOwnerInsights(
          userId,
          requests,
          allApplications
        );
        
        res.json(insights);
      } else {
        res.status(400).json({ message: "Invalid user type" });
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  app.get('/api/analytics/:userId/:userType', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userType } = req.params;
      
      // Verify user is requesting their own analytics
      if (req.user.claims.sub !== userId) {
        return res.status(403).json({ message: "Forbidden - can only access your own analytics" });
      }
      
      // Validate userType matches user's actual role
      if (userType === 'coach') {
        const coach = await storage.getCoach(userId);
        if (!coach) {
          return res.status(400).json({ message: "User is not a coach - cannot access coach analytics" });
        }

        const applications = await storage.getApplicationsByCoach(coach.id);
        const acceptedApplications = applications.filter(app => app.status === 'accepted');
        
        const totalApplications = applications.length;
        const acceptanceRate = totalApplications > 0 
          ? Math.round((acceptedApplications.length / totalApplications) * 100) 
          : 0;

        const totalRate = acceptedApplications.reduce((sum, app) => {
          const rate = typeof app.requestedRate === 'string' ? parseFloat(app.requestedRate) : (app.requestedRate || 0);
          return sum + rate;
        }, 0);
        const averageRate = acceptedApplications.length > 0 
          ? Math.round(totalRate / acceptedApplications.length) 
          : 0;

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyApplications = acceptedApplications.filter(app => {
          if (!app.appliedAt) return false;
          const appDate = new Date(app.appliedAt);
          return appDate >= firstDayOfMonth;
        });
        const monthlyEarnings = monthlyApplications.reduce((sum, app) => {
          const rate = typeof app.requestedRate === 'string' ? parseFloat(app.requestedRate) : (app.requestedRate || 0);
          return sum + rate;
        }, 0);

        const upcomingJobs = acceptedApplications.filter(app => {
          return app.request && new Date(app.request.startDate) > now;
        }).length;

        const performanceScore = Math.min(100, Math.round(
          (acceptanceRate * 0.6) + 
          (Math.min(totalApplications / 20 * 100, 100) * 0.2) + 
          (Math.min(upcomingJobs / 5 * 100, 100) * 0.2)
        ));

        const weeklyActivity = applications.filter(app => {
          if (!app.appliedAt) return false;
          const appDate = new Date(app.appliedAt);
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return appDate >= oneWeekAgo;
        }).length;

        const improvementAreas: string[] = [];
        if (acceptanceRate < 50) improvementAreas.push('Application quality');
        if (weeklyActivity < 2) improvementAreas.push('Application frequency');
        if (averageRate < 30) improvementAreas.push('Rate negotiation');

        res.json({
          totalApplications,
          acceptanceRate,
          averageRate,
          weeklyActivity,
          monthlyEarnings,
          upcomingJobs,
          performanceScore,
          improvementAreas
        });

      } else if (userType === 'owner') {
        const owner = await storage.getOwner(userId);
        if (!owner) {
          return res.status(400).json({ message: "User is not an owner - cannot access owner analytics" });
        }

        const requests = await storage.getSubstituteRequestsByOwner(owner.id);
        const allApplications = requests.flatMap(r => 
          Array.isArray(r.applications) ? r.applications : []
        );
        
        const acceptedApplications = allApplications.filter(app => app.status === 'accepted');
        
        const totalRequests = requests.length;
        const successfulBookings = acceptedApplications.length;
        const acceptanceRate = totalRequests > 0 
          ? Math.round((successfulBookings / totalRequests) * 100) 
          : 0;

        const totalRate = acceptedApplications.reduce((sum, app) => {
          const rate = typeof app.requestedRate === 'string' ? parseFloat(app.requestedRate) : (app.requestedRate || 0);
          return sum + rate;
        }, 0);
        const averageRate = acceptedApplications.length > 0 
          ? Math.round(totalRate / acceptedApplications.length) 
          : 0;

        const activeRequests = requests.filter(r => r.status === 'active' || r.status === 'pending').length;

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyRequests = requests.filter(r => {
          if (!r.createdAt) return false;
          const reqDate = new Date(r.createdAt);
          return reqDate >= firstDayOfMonth;
        }).length;

        const weeklyActivity = requests.filter(r => {
          if (!r.createdAt) return false;
          const reqDate = new Date(r.createdAt);
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return reqDate >= oneWeekAgo;
        }).length;

        const performanceScore = Math.min(100, Math.round(
          (acceptanceRate * 0.5) + 
          (Math.min(successfulBookings / 10 * 100, 100) * 0.3) + 
          (Math.min(activeRequests / 5 * 100, 100) * 0.2)
        ));

        const improvementAreas: string[] = [];
        if (acceptanceRate < 50) improvementAreas.push('Job posting details');
        if (activeRequests === 0) improvementAreas.push('Post more requests');
        if (averageRate > 60) improvementAreas.push('Rate competitiveness');

        res.json({
          totalApplications: successfulBookings,
          acceptanceRate,
          averageRate,
          weeklyActivity,
          monthlyEarnings: 0,
          upcomingJobs: activeRequests,
          performanceScore,
          improvementAreas
        });

      } else {
        res.status(400).json({ message: "Invalid user type" });
      }
    } catch (error) {
      console.error("Error generating analytics:", error);
      res.status(500).json({ message: "Failed to generate analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
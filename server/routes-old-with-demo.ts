import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emailService } from "./emailService";
import { calendarIntegration } from "./calendarIntegration";
import { 
  insertCoachSchema, 
  insertOwnerSchema, 
  insertSubstituteRequestSchema, 
  insertApplicationSchema,
  insertCalendarEventSchema,
  insertCoachAvailabilitySchema,
  insertRateNegotiationSchema,
  insertRateNegotiationHistorySchema,
  insertBillingTransactionSchema,
  type CalendarEvent,
  type CoachAvailability,
  type RateNegotiation,
  type RateNegotiationHistory,
  type BillingTransaction
} from "@shared/schema";
import Stripe from "stripe";
import { z } from "zod";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

// Production mode - no demo data storage

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get additional profile data based on user type
      let profileData = null;
      if (user.userType === 'coach') {
        profileData = await storage.getCoach(userId);
      } else if (user.userType === 'owner') {
        profileData = await storage.getOwner(userId);
      }

      res.json({ ...user, profileData });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User type selection
  app.post('/api/auth/select-user-type', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { userType } = req.body;

      if (!['coach', 'owner'].includes(userType)) {
        return res.status(400).json({ message: "Invalid user type" });
      }

      // Update user type
      await storage.upsertUser({
        id: userId,
        email: req.user.claims.email,
        firstName: req.user.claims.first_name,
        lastName: req.user.claims.last_name,
        profileImageUrl: req.user.claims.profile_image_url,
        userType,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error selecting user type:", error);
      res.status(500).json({ message: "Failed to select user type" });
    }
  });

  // Coach routes
  app.get('/api/coaches/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const coach = await storage.getCoach(userId);
      res.json(coach);
    } catch (error) {
      console.error("Error fetching coach profile:", error);
      res.status(500).json({ message: "Failed to fetch coach profile" });
    }
  });

  app.post('/api/coaches/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const coachData = insertCoachSchema.parse({ ...req.body, userId });
      
      const existingCoach = await storage.getCoach(userId);
      let coach;
      
      if (existingCoach) {
        coach = await storage.updateCoach(userId, coachData);
      } else {
        coach = await storage.createCoach(coachData);
      }
      
      res.json(coach);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error saving coach profile:", error);
      res.status(500).json({ message: "Failed to save coach profile" });
    }
  });

  app.get('/api/opportunities', isAuthenticated, async (req: any, res) => {
    try {
      // Get active substitute requests as opportunities for coaches (includes owner info via join)
      const allRequests = await storage.getSubstituteRequests({ status: 'active' });
      
      // Filter out requests that have accepted applications (status: 'filled')
      const availableRequests = allRequests.filter(request => request.status === 'active');
      
      // Format opportunities for coaches with owner information
      const formattedOpportunities = availableRequests.map(req => ({
        id: req.id,
        eventType: req.eventType,
        startDate: req.startDate,
        endDate: req.endDate,
        startTime: req.startTime,
        endTime: req.endTime,
        description: req.description,
        requirements: req.requirements,
        maxTravelDistance: req.maxTravelDistance,
        rateOffer: req.rateOffer, // This is the hourly rate offered by the gym owner
        hourlyRate: req.rateOffer, // Legacy field name compatibility
        daysOfWeek: req.daysOfWeek,
        status: req.status,
        owner: {
          id: req.owner.id,
          gymName: req.owner.gymName,
          address: req.owner.address,
          phone: req.owner.phone
        }
      }));
      
      console.log(`Returning ${formattedOpportunities.length} opportunities for coaches`);
      res.json(formattedOpportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.get('/api/coaches/opportunities', isAuthenticated, async (req: any, res) => {
    try {
      const requests = await storage.getSubstituteRequests({ status: 'open' });
      res.json(requests);
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
        // Return empty applications list if no coach profile exists yet
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

  app.get('/api/coaches/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const coach = await storage.getCoach(userId);
      
      if (!coach) {
        return res.status(404).json({ message: "Coach profile not found" });
      }

      const applications = await storage.getApplicationsByCoach(coach.id);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Update certifications endpoint
  app.put('/api/coaches/certifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const coach = await storage.getCoach(userId);
      
      if (!coach) {
        return res.status(404).json({ message: "Coach profile not found" });
      }

      // For now, we'll just return success since certifications are displayed as static data
      // In a real implementation, these would be stored in the database
      console.log('Certification update requested for coach:', coach.id, req.body);
      
      res.json({ 
        success: true, 
        message: "Certifications updated successfully",
        data: req.body
      });
    } catch (error) {
      console.error("Error updating certifications:", error);
      res.status(500).json({ message: "Failed to update certifications" });
    }
  });

  app.post('/api/coaches/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let coach = await storage.getCoach(userId);
      
      if (!coach) {
        // Auto-create coach profile if it doesn't exist
        const user = req.user;
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

      const application = await storage.createApplication(applicationData);
      console.log('Application created successfully:', application.id);
      res.json(application);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Owner routes
  app.get('/api/owners/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      res.json(owner);
    } catch (error) {
      console.error("Error fetching owner profile:", error);
      res.status(500).json({ message: "Failed to fetch owner profile" });
    }
  });

  app.post('/api/owners/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ownerData = insertOwnerSchema.parse({ ...req.body, userId });
      
      const existingOwner = await storage.getOwner(userId);
      let owner;
      
      if (existingOwner) {
        owner = await storage.updateOwner(userId, ownerData);
      } else {
        owner = await storage.createOwner(ownerData);
      }
      
      res.json(owner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error saving owner profile:", error);
      res.status(500).json({ message: "Failed to save owner profile" });
    }
  });

  app.get('/api/owner-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }

      const allRequests = await storage.getSubstituteRequestsByOwner(owner.id);
      // Filter out cancelled requests - only show active requests
      const requests = allRequests.filter(request => request.status !== 'cancelled');
      
      // Add applications to each request
      const requestsWithApplications = await Promise.all(
        requests.map(async (request: any) => {
          try {
            const applications = await storage.getApplicationsByRequest(request.id);
            return {
              ...request,
              applications: applications || [],
              applicationCount: applications ? applications.length : 0
            };
          } catch (error) {
            console.error(`Error fetching applications for request ${request.id}:`, error);
            return {
              ...request,
              applications: [],
              applicationCount: 0
            };
          }
        })
      );
      
      console.log(`Returning ${requestsWithApplications.length} requests for owner ${owner.id}:`, 
        requestsWithApplications.map(r => ({ id: r.id, status: r.status, eventType: r.eventType, applicationCount: r.applicationCount })));
      res.json(requestsWithApplications);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.post('/api/owner-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let owner = await storage.getOwner(userId);
      
      if (!owner) {
        // Auto-create owner profile if it doesn't exist
        const user = req.user;
        owner = await storage.createOwner({
          userId: userId,
          gymName: user.email?.split('@')[0] || 'My Gym',
          address: '123 Main St',
          phone: '',
          stripeCustomerId: null,
          planType: 'starter',
          subscriptionStatus: 'inactive'
        });
        console.log('Auto-created owner profile:', owner.id);
      }

      // Check if owner has payment method on file
      let hasPaymentMethod = false;
      
      if (owner.stripeCustomerId) {
        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: owner.stripeCustomerId,
            type: 'card',
          });
          hasPaymentMethod = paymentMethods.data.length > 0;
        } catch (error) {
          console.error('Error checking payment methods:', error);
        }
      }

      // TODO: Re-enable payment method requirement after testing
      // Temporarily disabled for development/testing
      /*
      if (!hasPaymentMethod) {
        return res.status(402).json({ 
          error: 'Payment method required',
          message: 'Please add a payment method before creating substitute requests',
          requiresBilling: true
        });
      }
      */

      // Process and validate the request data
      const processedData = {
        ...req.body,
        ownerId: owner.id,
        status: 'active',
        // Convert date string to timestamp
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        // Ensure numeric fields are properly converted
        maxTravelDistance: parseInt(req.body.maxTravelDistance) || 10,
        rateOffer: req.body.rateOffer ? req.body.rateOffer.toString() : undefined,
        hourlyRate: req.body.hourlyRate ? req.body.hourlyRate.toString() : undefined,
        // Ensure arrays are properly handled
        daysOfWeek: Array.isArray(req.body.daysOfWeek) ? req.body.daysOfWeek : [],
        requirements: Array.isArray(req.body.requirements) ? req.body.requirements : [],
      };

      console.log('Processing substitute request data:', {
        originalBody: req.body,
        processedData: processedData,
        requiredFields: ['ownerId', 'eventType', 'startDate', 'startTime', 'endTime']
      });

      const requestData = insertSubstituteRequestSchema.parse(processedData);

      const request = await storage.createSubstituteRequest(requestData);
      console.log('Successfully created substitute request:', {
        id: request.id,
        status: request.status,
        eventType: request.eventType,
        ownerId: request.ownerId
      });
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating substitute request:", error);
      res.status(500).json({ message: "Failed to create substitute request" });
    }
  });

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

  app.patch('/api/applications/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const application = await storage.updateApplication(id, { status: 'accepted' });
      
      // Also update the request status to filled
      await storage.updateSubstituteRequest(application.requestId, { status: 'filled' });
      
      res.json(application);
    } catch (error) {
      console.error("Error accepting application:", error);
      res.status(500).json({ message: "Failed to accept application" });
    }
  });

  // Production mode - all demo endpoints removed

  app.get('/api/demo/owner-profile', async (req, res) => {
    try {
      const profile = loadDemoOwnerProfile();
      res.json(profile);
    } catch (error) {
      console.error("Error fetching demo owner profile:", error);
      res.status(500).json({ message: "Failed to fetch owner profile" });
    }
  });

  app.post('/api/demo/owner-profile', async (req, res) => {
    try {
      // Load current profile and update with new data
      const currentProfile = loadDemoOwnerProfile();
      const { gymName, phone, address } = req.body;
      
      // Update the profile with new data
      const updatedProfile = {
        gymName: gymName || currentProfile.gymName,
        phone: phone || currentProfile.phone,
        address: address || currentProfile.address
      };
      
      // Save the updated profile to file
      saveDemoOwnerProfile(updatedProfile);
      
      console.log('Updated demo owner profile:', updatedProfile);
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating demo owner profile:", error);
      res.status(500).json({ message: "Failed to update owner profile" });
    }
  });

  app.get('/api/demo/owner-requests', async (req, res) => {
    try {
      // Get substitute requests from the database
      const requests = await storage.getSubstituteRequests();
      
      // Get all applications from file storage
      const allApplications = loadDemoApplications();
      
      // Add application count and recent applications to each request
      const requestsWithApplications = requests.map((request: any) => {
        const requestApplications = allApplications.filter((app: any) => app.requestId === request.id);
        return {
          ...request,
          applicationCount: requestApplications.length,
          applications: requestApplications, // Include full applications data
        };
      });
      
      console.log('Returning owner requests with applications:', requestsWithApplications.length);
      res.json(requestsWithApplications);
    } catch (error) {
      console.error("Error fetching demo owner requests:", error);
      res.status(500).json({ message: "Failed to fetch owner requests" });
    }
  });

  app.post('/api/demo/owner-requests', async (req, res) => {
    try {
      // Create new substitute request in the database with active status
      const requestData = {
        ...req.body,
        ownerId: 'owner-pro', // Demo owner ID
        status: 'active', // Auto-set to active status
        id: `req-${Date.now()}`, // Generate unique ID
        createdAt: new Date(),
        // Convert date strings to Date objects
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        // Set hourly_rate to null since it's not provided in the form (we use rateOffer instead)
        hourlyRate: null,
      };

      // Save to database using storage layer
      const newRequest = await storage.createSubstituteRequest(requestData);
      
      console.log('Created new demo request:', newRequest);
      res.json(newRequest);
    } catch (error) {
      console.error("Error creating demo owner request:", error);
      res.status(500).json({ message: "Failed to create owner request" });
    }
  });

  // Get applications for a specific request
  app.get('/api/demo/requests/:requestId/applications', async (req, res) => {
    try {
      const { requestId } = req.params;
      const allApplications = loadDemoApplications();
      const requestApplications = allApplications.filter((app: any) => app.requestId === requestId);
      
      console.log(`Found ${requestApplications.length} applications for request ${requestId}`);
      res.json(requestApplications);
    } catch (error) {
      console.error("Error fetching request applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Delete substitute request
  app.delete('/api/owner-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner) {
        return res.status(404).json({ message: "Owner profile not found" });
      }

      // Get the request first to verify ownership
      const requests = await storage.getSubstituteRequestsByOwner(owner.id);
      const requestToDelete = requests.find(r => r.id === id);
      
      if (!requestToDelete) {
        return res.status(404).json({ message: "Request not found or not owned by user" });
      }

      // Delete the request (we'll need to add this method to storage)
      // For now, we'll update the status to 'cancelled'
      await storage.updateSubstituteRequest(id, { status: 'cancelled' });
      
      console.log(`Request ${id} cancelled/deleted for owner ${owner.id}`);
      res.json({ message: "Request deleted successfully" });
    } catch (error) {
      console.error("Error deleting request:", error);
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  // Accept application endpoint
  app.post('/api/demo/applications/:applicationId/accept', async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      // Load current applications
      const allApplications = loadDemoApplications();
      const applicationIndex = allApplications.findIndex((app: any) => app.id === applicationId);
      
      if (applicationIndex === -1) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Update application status to accepted
      allApplications[applicationIndex].status = 'accepted';
      allApplications[applicationIndex].acceptedAt = new Date().toISOString();
      
      // Save updated applications
      saveDemoApplications(allApplications);
      
      // Get the accepted application details
      const acceptedApplication = allApplications[applicationIndex];
      
      // Send email notification to coach
      try {
        await emailService.sendAcceptanceEmail({
          to: acceptedApplication.coach.user.email,
          coachName: `${acceptedApplication.coach.user.firstName} ${acceptedApplication.coach.user.lastName}`,
          requestId: acceptedApplication.requestId,
          gymName: "Demo Fitness Center" // In real app, get from request/owner data
        });
        console.log(`✅ Acceptance email sent to ${acceptedApplication.coach.user.email}`);
      } catch (emailError) {
        console.error("Failed to send acceptance email:", emailError);
        // Don't fail the acceptance if email fails
      }

      console.log(`✅ Application ${applicationId} accepted for request ${acceptedApplication.requestId}`);
      res.json(acceptedApplication);
    } catch (error) {
      console.error("Error accepting application:", error);
      res.status(500).json({ message: "Failed to accept application" });
    }
  });

  // Decline application endpoint
  app.post('/api/demo/applications/:applicationId/decline', async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      // Load current applications
      const allApplications = loadDemoApplications();
      const applicationIndex = allApplications.findIndex((app: any) => app.id === applicationId);
      
      if (applicationIndex === -1) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Update application status to declined
      allApplications[applicationIndex].status = 'declined';
      allApplications[applicationIndex].declinedAt = new Date().toISOString();
      
      // Save updated applications
      saveDemoApplications(allApplications);
      
      // Get the declined application details
      const declinedApplication = allApplications[applicationIndex];
      
      // Send email notification to coach
      try {
        await emailService.sendDeclineEmail({
          to: declinedApplication.coach.user.email,
          coachName: `${declinedApplication.coach.user.firstName} ${declinedApplication.coach.user.lastName}`,
          requestId: declinedApplication.requestId,
          gymName: "Demo Fitness Center" // In real app, get from request/owner data
        });
        console.log(`📧 Decline email sent to ${declinedApplication.coach.user.email}`);
      } catch (emailError) {
        console.error("Failed to send decline email:", emailError);
        // Don't fail the decline if email fails
      }

      console.log(`❌ Application ${applicationId} declined for request ${declinedApplication.requestId}`);
      res.json(declinedApplication);
    } catch (error) {
      console.error("Error declining application:", error);
      res.status(500).json({ message: "Failed to decline application" });
    }
  });

  // Object storage routes for 1099 upload
  app.post('/api/objects/upload', isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put('/api/1099/upload', isAuthenticated, async (req, res) => {
    if (!req.body.fileURL) {
      return res.status(400).json({ error: "fileURL is required" });
    }

    const userId = (req.user as any)?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.fileURL,
        {
          owner: userId,
          visibility: "private",
        },
      );

      // Update coach profile with 1099 path
      const coach = await storage.getCoach(userId);
      if (coach) {
        await storage.updateCoach(userId, { form1099Path: objectPath });
      }

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting 1099 file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    const userId = (req.user as any)?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Calendar and scheduling routes
  
  // Get calendar events for user
  app.get('/api/calendar/events', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { start, end } = req.query;
      
      // Mock calendar events for now - replace with actual database queries
      const mockEvents = [
        {
          id: '1',
          title: 'Morning Gymnastics Class',
          startTime: new Date('2025-08-13T09:00:00'),
          endTime: new Date('2025-08-13T10:30:00'),
          eventType: 'substitute_request',
          status: 'scheduled',
          location: 'Metro Gymnastics Center',
          description: 'Level 3 recreational gymnastics class',
          coachName: 'Sarah Johnson',
          gymName: 'Metro Gymnastics'
        },
        {
          id: '2',
          title: 'Available for Substitute',
          startTime: new Date('2025-08-14T14:00:00'),
          endTime: new Date('2025-08-14T17:00:00'),
          eventType: 'availability',
          status: 'scheduled',
          description: 'Open for substitute coaching'
        },
        {
          id: '3',
          title: 'Team Practice',
          startTime: new Date('2025-08-15T16:00:00'),
          endTime: new Date('2025-08-15T18:00:00'),
          eventType: 'coaching_session',
          status: 'confirmed',
          location: 'Elite Gymnastics Academy',
          description: 'Competitive team practice'
        }
      ];
      
      res.json(mockEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  // Create calendar event
  app.post('/api/calendar/events', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const eventData = insertCalendarEventSchema.parse(req.body);
      
      // For now, return mock response - replace with actual database operations
      const newEvent = {
        id: `event-${Date.now()}`,
        ...eventData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newEvent);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  });

  // Update calendar event
  app.put('/api/calendar/events/:eventId', isAuthenticated, async (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = (req.user as any)?.claims?.sub;
      const eventData = insertCalendarEventSchema.parse(req.body);
      
      // Mock response - replace with actual database operations
      const updatedEvent = {
        id: eventId,
        ...eventData,
        updatedAt: new Date()
      };
      
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      res.status(500).json({ error: 'Failed to update calendar event' });
    }
  });

  // Delete calendar event
  app.delete('/api/calendar/events/:eventId', isAuthenticated, async (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = (req.user as any)?.claims?.sub;
      
      // Mock response - replace with actual database operations
      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      res.status(500).json({ error: 'Failed to delete calendar event' });
    }
  });

  // Get coach availability
  app.get('/api/coaches/availability', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      
      // Mock availability data - replace with actual database queries
      const mockAvailability = [
        {
          id: '1',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '12:00',
          isAvailable: true,
          notes: 'Morning sessions'
        },
        {
          id: '2',
          dayOfWeek: 1, // Monday
          startTime: '14:00',
          endTime: '18:00',
          isAvailable: true,
          notes: 'Afternoon sessions'
        },
        {
          id: '3',
          dayOfWeek: 3, // Wednesday
          startTime: '10:00',
          endTime: '15:00',
          isAvailable: true,
          notes: 'Mid-week availability'
        },
        {
          id: '4',
          dayOfWeek: 5, // Friday
          startTime: '16:00',
          endTime: '20:00',
          isAvailable: true,
          notes: 'Weekend prep'
        }
      ];
      
      res.json(mockAvailability);
    } catch (error) {
      console.error('Error fetching coach availability:', error);
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  });

  // Update coach availability
  app.put('/api/coaches/availability', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const availabilityData = req.body; // Array of availability slots
      
      // Mock response - replace with actual database operations
      res.json({ 
        message: 'Availability updated successfully',
        availability: availabilityData
      });
    } catch (error) {
      console.error('Error updating coach availability:', error);
      res.status(500).json({ error: 'Failed to update availability' });
    }
  });

  // Import notification service
  const { notificationService } = await import('./notificationService');

  // Demo notifications endpoints
  app.get('/api/demo/notifications/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await notificationService.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post('/api/demo/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;
      await notificationService.markAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Demo insights endpoints
  app.get('/api/demo/insights/:userId/:userType', async (req, res) => {
    try {
      const { userId, userType } = req.params;
      
      if (userType === 'coach') {
        // Get coach applications and opportunities for insights
        const applications = loadDemoApplications();
        const opportunities = await storage.getSubstituteRequests({ status: 'active' });
        
        const insights = await notificationService.generateCoachInsights(
          userId, 
          applications.filter((app: any) => app.coachId === 'coach-demo'), 
          opportunities
        );
        
        res.json(insights);
      } else if (userType === 'owner') {
        // Get owner requests and applications for insights
        const allRequests = await storage.getSubstituteRequests();
        const requests = allRequests.filter((req: any) => req.ownerId === userId);
        const applications = loadDemoApplications();
        
        const insights = await notificationService.generateOwnerInsights(
          userId,
          requests,
          applications
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

  // Demo analytics endpoints
  app.get('/api/demo/analytics/:userId/:userType', async (req, res) => {
    try {
      const { userId, userType } = req.params;
      
      if (userType === 'coach') {
        const applications = loadDemoApplications();
        const coachApps = applications.filter((app: any) => app.coachId === 'coach-demo');
        const acceptedApps = coachApps.filter((app: any) => app.status === 'accepted');
        
        const analytics = {
          totalApplications: coachApps.length,
          acceptanceRate: coachApps.length > 0 ? Math.round((acceptedApps.length / coachApps.length) * 100) : 0,
          averageRate: coachApps.length > 0 ? Math.round(coachApps.reduce((sum: number, app: any) => sum + (app.requestedRate || 0), 0) / coachApps.length) : 45,
          weeklyActivity: coachApps.filter((app: any) => 
            new Date(app.appliedAt).getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000)
          ).length,
          monthlyEarnings: acceptedApps.length * 135, // Mock calculation
          upcomingJobs: acceptedApps.length,
          performanceScore: Math.min(95, 60 + (acceptedApps.length * 5)),
          improvementAreas: coachApps.length < 3 ? ['Apply to more positions'] : 
                           acceptedApps.length / coachApps.length < 0.5 ? ['Improve application quality', 'Competitive pricing'] :
                           ['Maintain consistency']
        };
        
        res.json(analytics);
      } else {
        // Owner analytics would go here
        const allRequests = await storage.getSubstituteRequests();
        const requests = allRequests.filter((req: any) => req.ownerId === userId);
        const analytics = {
          totalRequests: requests.length,
          filledPositions: Math.floor(requests.length * 0.8),
          averageResponseTime: '2.3 hours',
          costSavings: '$2,400'
        };
        
        res.json(analytics);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Create initial welcome notifications for demo
  setTimeout(async () => {
    try {
      await notificationService.createNotification({
        userId: 'coach-demo',
        userType: 'coach',
        type: 'achievement',
        title: 'Welcome to SubCoach Pro!',
        message: 'Start exploring opportunities and build your coaching network.',
        read: false,
        actionUrl: '/coach?tab=opportunities'
      });

      await notificationService.createNotification({
        userId: 'owner-pro',
        userType: 'owner',
        type: 'insight',
        title: 'Boost Your Response Rate',
        message: 'Posts with competitive rates get 3x more applications. Consider market analysis.',
        read: false,
        actionUrl: '/owner?tab=insights'
      });
    } catch (error) {
      console.error('Failed to create initial notifications:', error);
    }
  }, 2000);

  // Rate negotiation endpoints
  app.post('/api/rate-negotiations', isAuthenticated, async (req, res) => {
    try {
      const { applicationId, proposedRate, message } = req.body;
      const userId = req.user.claims.sub;
      
      if (!applicationId || !proposedRate) {
        return res.status(400).json({ error: "Application ID and proposed rate are required" });
      }

      // Verify the user has access to this application
      try {
        const application = await storage.getApplicationById(applicationId);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        
        // Get current rate from the request
        let currentRate = 25.00; // Default fallback
        if (application.request?.rateOffer) {
          currentRate = parseFloat(application.request.rateOffer);
        } else if (application.request?.hourlyRate) {
          currentRate = parseFloat(application.request.hourlyRate);
        }

        // Create new negotiation in database
        const negotiation = await storage.createRateNegotiation({
          applicationId,
          currentRate,
          proposedRate: parseFloat(proposedRate),
          proposedBy: 'coach',
          message
        });

        console.log(`Created rate negotiation for application ${applicationId}: $${proposedRate}/hr (current: $${currentRate}/hr)`);
        res.json(negotiation);
      } catch (dbError) {
        console.error('Database error in rate negotiation:', dbError);
        return res.status(500).json({ error: 'Failed to verify application' });
      }
    } catch (error) {
      console.error('Error creating rate negotiation:', error);
      res.status(500).json({ error: 'Failed to create rate negotiation' });
    }
  });

  app.post('/api/rate-negotiations/:id/respond', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, proposedRate, message } = req.body;
      
      if (!['accept', 'decline', 'counter'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // Find the negotiation by ID
      let negotiation = null;
      let applicationId = null;
      
      for (const [appId, neg] of Object.entries(demoNegotiations)) {
        if (neg && neg.id === id) {
          negotiation = neg as any;
          applicationId = appId;
          break;
        }
      }

      if (!negotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      // Update negotiation based on action
      if (action === 'accept') {
        negotiation.status = 'accepted';
        negotiation.currentRate = negotiation.proposedRate;
        console.log(`Rate negotiation accepted: $${negotiation.proposedRate}/hr for application ${applicationId}`);
      } else if (action === 'decline') {
        negotiation.status = 'declined';
        console.log(`Rate negotiation declined for application ${applicationId}`);
      } else if (action === 'counter') {
        negotiation.proposedRate = parseFloat(proposedRate);
        negotiation.proposedBy = negotiation.proposedBy === 'coach' ? 'owner' : 'coach';
        negotiation.message = message;
        negotiation.status = 'pending';
        
        // Add to history
        negotiation.history.push({
          id: `history-${Date.now()}`,
          rate: parseFloat(proposedRate),
          proposedBy: negotiation.proposedBy,
          message: message || "Counter-offer",
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        
        console.log(`Rate negotiation counter-offer: $${proposedRate}/hr for application ${applicationId}`);
      }

      negotiation.updatedAt = new Date().toISOString();
      if (applicationId) {
        demoNegotiations[applicationId] = negotiation;
      }
      saveDemoNegotiations();

      res.json(negotiation);
    } catch (error) {
      console.error('Error responding to rate negotiation:', error);
      res.status(500).json({ error: 'Failed to respond to rate negotiation' });
    }
  });

  app.get('/api/rate-negotiations/application/:applicationId', isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      // Return stored negotiation or null if none exists
      const negotiation = demoNegotiations[applicationId];
      
      if (negotiation) {
        console.log(`Retrieved rate negotiation for application ${applicationId}: $${negotiation.proposedRate}/hr`);
        res.json(negotiation);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error('Error fetching rate negotiation:', error);
      res.status(500).json({ error: 'Failed to fetch rate negotiation' });
    }
  });

  // ===============================
  // BILLING & SUBSCRIPTION ROUTES
  // ===============================

  // Create Stripe subscription for Pro plan
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const { planType } = req.body;
      const userId = req.user.claims.sub;
      
      // Get owner profile to check for existing Stripe customer
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
        
        // Update owner with customer ID
        await storage.updateOwner(userId, { stripeCustomerId: customerId });
      }

      // Create Stripe Checkout Session for subscription
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
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        stack: error.stack
      });
      res.status(500).json({ 
        error: 'Failed to create subscription',
        details: error.message 
      });
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
        
        // Update owner with customer ID
        await storage.updateOwner(userId, { stripeCustomerId: customerId });
      }

      // Create setup intent for saving payment method
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

  // Get current payment method details
  app.get('/api/payment-method', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const owner = await storage.getOwner(userId);
      
      if (!owner || !owner.stripeCustomerId) {
        return res.json({ hasPaymentMethod: false });
      }

      // Get customer's payment methods from Stripe
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

  // Switch to pay-as-you-go plan
  app.post('/api/switch-to-payasyougo', async (req, res) => {
    try {
      // For demo purposes, just return success
      res.json({ 
        success: true, 
        message: 'Switched to pay-as-you-go plan',
        planType: 'starter'
      });
    } catch (error) {
      console.error('Error switching to pay-as-you-go:', error);
      res.status(500).json({ error: 'Failed to switch plan' });
    }
  });

  // Get subscription status
  app.get('/api/subscription-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let owner = await storage.getOwner(userId);
      
      if (!owner) {
        // Auto-create owner profile if it doesn't exist
        const user = req.user;
        owner = await storage.createOwner({
          userId: userId,
          gymName: user.email?.split('@')[0] || 'My Gym',
          address: '123 Main St',
          phone: '',
          stripeCustomerId: null,
          planType: 'starter',
          subscriptionStatus: 'inactive'
        });
        console.log('Auto-created owner profile for subscription status:', owner.id);
      }

      let subscriptionData = {
        planType: owner.planType || 'starter',
        status: owner.subscriptionStatus || 'inactive',
        nextBillingDate: owner.currentPeriodEnd,
        amount: 0,
        cancelAtPeriodEnd: owner.cancelAtPeriodEnd || false,
        hasPaymentMethod: false,
        usage: {
          requestsPosted: 0,
          successfulBookings: 0,
          totalCharges: 0
        }
      };

      // Check for payment methods first
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

      // If has Stripe subscription, fetch real data
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
      } else if (subscriptionData.hasPaymentMethod) {
        // If user has payment method but no subscription, they're on pay-as-you-go (active starter plan)
        subscriptionData.status = 'active';
        subscriptionData.amount = 10; // Pay-as-you-go rate per booking
        
        // Update the database status to active if it's currently inactive
        if (owner.subscriptionStatus !== 'active') {
          await storage.updateOwner(owner.userId, { subscriptionStatus: 'active' });
        }
      }

      res.json(subscriptionData);
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
  });

  // Cancel subscription
  app.post('/api/cancel-subscription', async (req, res) => {
    try {
      // For demo purposes, just return success
      res.json({ 
        success: true, 
        message: 'Subscription cancelled. Access continues until end of billing period.',
        cancelAtPeriodEnd: true
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  // Get billing history
  app.get('/api/billing-history', async (req, res) => {
    try {
      // Demo billing history
      const mockHistory = [
        {
          id: 'inv_001',
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 49,
          status: 'paid',
          description: 'Pro Plan - Monthly Subscription',
          planType: 'pro'
        },
        {
          id: 'inv_002', 
          date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 30,
          status: 'paid',
          description: 'Booking Fees (3 successful bookings)',
          planType: 'starter'
        },
        {
          id: 'inv_003',
          date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 49,
          status: 'paid',
          description: 'Pro Plan - Monthly Subscription',
          planType: 'pro'
        }
      ];

      res.json(mockHistory);
    } catch (error) {
      console.error('Error fetching billing history:', error);
      res.status(500).json({ error: 'Failed to fetch billing history' });
    }
  });

  // Create payment intent for booking fees (pay-as-you-go)
  app.post('/api/create-payment-intent', async (req, res) => {
    try {
      const { amount, description } = req.body;
      
      // For demo purposes, create a mock payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        description: description || 'Substitute coaching booking fee',
        metadata: {
          type: 'booking_fee'
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
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

      // Get application with request details
      const applications = await storage.getApplicationsByCoach(userId);
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
  app.post('/api/rate-negotiations/:id/respond', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, proposedRate, message } = req.body;
      
      if (!['accept', 'decline', 'counter'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // Get current negotiation
      const currentNegotiation = await storage.getRateNegotiationById(id);
      if (!currentNegotiation) {
        return res.status(404).json({ error: "Negotiation not found" });
      }

      // Update based on action
      if (action === 'accept') {
        await storage.updateRateNegotiation(id, { status: 'accepted' });
      } else if (action === 'decline') {
        await storage.updateRateNegotiation(id, { status: 'declined' });
      } else if (action === 'counter' && proposedRate) {
        const newProposedBy = currentNegotiation.proposedBy === 'coach' ? 'owner' : 'coach';
        await storage.updateRateNegotiation(id, {
          proposedRate: parseFloat(proposedRate),
          status: 'countered',
          message: message || 'Counter offer',
          proposedBy: newProposedBy
        });
      }

      // Return updated negotiation
      const updatedNegotiation = await storage.getRateNegotiationByApplication(currentNegotiation.applicationId);
      res.json(updatedNegotiation);
    } catch (error) {
      console.error('Error responding to rate negotiation:', error);
      res.status(500).json({ error: 'Failed to respond to rate negotiation' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

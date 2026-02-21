// Rate negotiation endpoints - Database version
import type { Express } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";

export function registerRateNegotiationRoutes(app: Express) {
  // Create rate negotiation
  app.post('/api/rate-negotiations', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId, proposedRate, message } = req.body;
      const userId = req.user?.claims?.sub;
      
      if (!applicationId || !proposedRate) {
        return res.status(400).json({ error: "Application ID and proposed rate are required" });
      }

      // Verify the application exists and get current rate
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

      // Create negotiation
      const negotiation = await storage.createRateNegotiation({
        applicationId,
        currentRate,
        proposedRate: parseFloat(proposedRate),
        proposedBy: 'coach',
        message
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
}
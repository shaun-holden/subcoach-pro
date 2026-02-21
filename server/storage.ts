import {
  users,
  coaches,
  owners,
  substituteRequests,
  applications,
  rateNegotiations,
  rateNegotiationHistory,
  type User,
  type Coach,
  type Owner,
  type SubstituteRequest,
  type Application,
  type UpsertUser,
  type InsertCoach,
  type InsertOwner,
  type InsertSubstituteRequest,
  type InsertApplication,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // Coach operations
  getCoach(userId: string): Promise<Coach | undefined>;
  createCoach(coach: InsertCoach): Promise<Coach>;
  updateCoach(userId: string, updates: Partial<InsertCoach>): Promise<Coach>;
  
  // Owner operations
  getOwner(userId: string): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(userId: string, updates: Partial<InsertOwner>): Promise<Owner>;
  
  // Substitute request operations
  getSubstituteRequests(filters?: { status?: string }): Promise<(SubstituteRequest & { owner: Owner & { user: User } })[]>;
  getSubstituteRequestsByOwner(ownerId: string): Promise<(SubstituteRequest & { applications: (Application & { coach: Coach & { user: User } })[] })[]>;
  getSubstituteRequest(id: string): Promise<SubstituteRequest | undefined>;
  createSubstituteRequest(request: InsertSubstituteRequest): Promise<SubstituteRequest>;
  updateSubstituteRequest(id: string, updates: Partial<InsertSubstituteRequest>): Promise<SubstituteRequest>;
  deleteSubstituteRequest(id: string): Promise<void>;
  
  // Application operations
  getApplicationsByCoach(coachId: string): Promise<(Application & { request: SubstituteRequest & { owner: Owner & { user: User } } })[]>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application>;
  getApplication(requestId: string, coachId: string): Promise<Application | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getCoach(userId: string): Promise<Coach | undefined> {
    const [coach] = await db.select().from(coaches).where(eq(coaches.userId, userId));
    return coach;
  }

  async createCoach(coach: InsertCoach): Promise<Coach> {
    const [newCoach] = await db.insert(coaches).values(coach).returning();
    return newCoach;
  }

  async updateCoach(userId: string, updates: Partial<InsertCoach>): Promise<Coach> {
    const [updatedCoach] = await db
      .update(coaches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(coaches.userId, userId))
      .returning();
    return updatedCoach;
  }

  async getOwner(userId: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.userId, userId));
    return owner;
  }

  async getOwnerById(id: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.id, id));
    return owner;
  }

  async createOwner(owner: InsertOwner): Promise<Owner> {
    const [newOwner] = await db.insert(owners).values(owner).returning();
    return newOwner;
  }

  async updateOwner(userId: string, updates: Partial<InsertOwner>): Promise<Owner> {
    const [updatedOwner] = await db
      .update(owners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(owners.userId, userId))
      .returning();
    return updatedOwner;
  }

  async getSubstituteRequests(filters?: { status?: string }): Promise<(SubstituteRequest & { owner: Owner & { user: User } })[]> {
    let query = db
      .select()
      .from(substituteRequests)
      .leftJoin(owners, eq(substituteRequests.ownerId, owners.id))
      .leftJoin(users, eq(owners.userId, users.id))
      .orderBy(desc(substituteRequests.createdAt));

    if (filters?.status) {
      query = query.where(eq(substituteRequests.status, filters.status)) as typeof query;
    }

    const results = await query;
    return results.map(row => ({
      ...row.substitute_requests,
      owner: {
        ...row.owners!,
        user: row.users!,
      },
    }));
  }

  async getSubstituteRequestsByOwner(ownerId: string): Promise<(SubstituteRequest & { applications: (Application & { coach: Coach & { user: User } })[] })[]> {
    const requests = await db
      .select()
      .from(substituteRequests)
      .where(eq(substituteRequests.ownerId, ownerId))
      .orderBy(desc(substituteRequests.createdAt));

    const requestsWithApplications = await Promise.all(
      requests.map(async (request) => {
        const apps = await db
          .select()
          .from(applications)
          .leftJoin(coaches, eq(applications.coachId, coaches.id))
          .leftJoin(users, eq(coaches.userId, users.id))
          .where(eq(applications.requestId, request.id));

        return {
          ...request,
          applications: apps.map(row => ({
            ...row.applications,
            coach: {
              ...row.coaches!,
              user: row.users!,
            },
          })),
        };
      })
    );

    return requestsWithApplications;
  }

  async createSubstituteRequest(request: InsertSubstituteRequest): Promise<SubstituteRequest> {
    const [newRequest] = await db.insert(substituteRequests).values(request).returning();
    return newRequest;
  }

  async getSubstituteRequest(id: string): Promise<SubstituteRequest | undefined> {
    const [request] = await db
      .select()
      .from(substituteRequests)
      .where(eq(substituteRequests.id, id));
    return request;
  }

  async updateSubstituteRequest(id: string, updates: Partial<InsertSubstituteRequest>): Promise<SubstituteRequest> {
    const [updatedRequest] = await db
      .update(substituteRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(substituteRequests.id, id))
      .returning();
    return updatedRequest;
  }

  async deleteSubstituteRequest(id: string): Promise<void> {
    await db
      .delete(substituteRequests)
      .where(eq(substituteRequests.id, id));
  }

  async getApplicationsByCoach(coachId: string): Promise<(Application & { request: SubstituteRequest & { owner: Owner & { user: User } } })[]> {
    const apps = await db
      .select()
      .from(applications)
      .leftJoin(substituteRequests, eq(applications.requestId, substituteRequests.id))
      .leftJoin(owners, eq(substituteRequests.ownerId, owners.id))
      .leftJoin(users, eq(owners.userId, users.id))
      .where(eq(applications.coachId, coachId))
      .orderBy(desc(applications.appliedAt));

    return apps.map(row => ({
      ...row.applications,
      request: {
        ...row.substitute_requests!,
        owner: {
          ...row.owners!,
          user: row.users!,
        },
      },
    }));
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const [newApplication] = await db.insert(applications).values(application).returning();
    return newApplication;
  }

  async updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application> {
    const [updatedApplication] = await db
      .update(applications)
      .set(updates)
      .where(eq(applications.id, id))
      .returning();
    return updatedApplication;
  }

  async getApplication(requestId: string, coachId: string): Promise<Application | undefined> {
    const [application] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.requestId, requestId), eq(applications.coachId, coachId)));
    return application;
  }

  async getApplicationById(id: string): Promise<Application | undefined> {
    const [application] = await db
      .select({
        id: applications.id,
        requestId: applications.requestId,
        coachId: applications.coachId,
        requestedRate: applications.requestedRate,
        status: applications.status,
        appliedAt: applications.appliedAt,
        acceptedAt: applications.acceptedAt,
        declinedAt: applications.declinedAt,
        message: applications.message,
        request: {
          id: substituteRequests.id,
          eventType: substituteRequests.eventType,
          startDate: substituteRequests.startDate,
          startTime: substituteRequests.startTime,
          endTime: substituteRequests.endTime,
          hourlyRate: substituteRequests.hourlyRate,
          rateOffer: substituteRequests.rateOffer,
          ownerId: substituteRequests.ownerId
        }
      })
      .from(applications)
      .leftJoin(substituteRequests, eq(applications.requestId, substituteRequests.id))
      .where(eq(applications.id, id));
    return application;
  }

  async getApplicationsByRequest(requestId: string): Promise<Application[]> {
    const results = await db
      .select({
        id: applications.id,
        requestId: applications.requestId,
        coachId: applications.coachId,
        requestedRate: applications.requestedRate,
        status: applications.status,
        appliedAt: applications.appliedAt,
        acceptedAt: applications.acceptedAt,
        declinedAt: applications.declinedAt,
        message: applications.message,
        coach: {
          id: coaches.id,
          firstName: coaches.firstName,
          lastName: coaches.lastName,
          hourlyRate: coaches.hourlyRate,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email
          }
        }
      })
      .from(applications)
      .leftJoin(coaches, eq(applications.coachId, coaches.id))
      .leftJoin(users, eq(coaches.userId, users.id))
      .where(eq(applications.requestId, requestId));
    return results;
  }

  // Rate negotiations
  async createRateNegotiation(data: {
    applicationId: string;
    currentRate: number;
    proposedRate: number;
    proposedBy: 'coach' | 'owner';
    message?: string;
  }) {
    const [negotiation] = await db
      .insert(rateNegotiations)
      .values({
        applicationId: data.applicationId,
        currentRate: data.currentRate.toString(),
        proposedRate: data.proposedRate.toString(),
        proposedBy: data.proposedBy,
        message: data.message,
        status: 'pending'
      })
      .returning();
    
    // Create initial history entry
    await db.insert(rateNegotiationHistory).values({
      negotiationId: negotiation.id,
      rate: data.proposedRate.toString(),
      proposedBy: data.proposedBy,
      message: data.message || 'Initial rate proposal',
      status: 'pending'
    });

    return negotiation;
  }

  async getRateNegotiationById(id: string) {
    const [negotiation] = await db
      .select()
      .from(rateNegotiations)
      .where(eq(rateNegotiations.id, id))
      .limit(1);

    if (!negotiation) return null;

    // Get history
    const history = await db
      .select()
      .from(rateNegotiationHistory)
      .where(eq(rateNegotiationHistory.negotiationId, negotiation.id))
      .orderBy(sql`${rateNegotiationHistory.createdAt} ASC`);

    return {
      ...negotiation,
      history
    };
  }

  async getRateNegotiationByApplication(applicationId: string) {
    const [negotiation] = await db
      .select()
      .from(rateNegotiations)
      .where(eq(rateNegotiations.applicationId, applicationId))
      .orderBy(sql`${rateNegotiations.createdAt} DESC`)
      .limit(1);

    if (!negotiation) return null;

    // Get history
    const history = await db
      .select()
      .from(rateNegotiationHistory)
      .where(eq(rateNegotiationHistory.negotiationId, negotiation.id))
      .orderBy(sql`${rateNegotiationHistory.createdAt} ASC`);

    return {
      ...negotiation,
      history
    };
  }

  async updateRateNegotiation(id: string, data: {
    status?: string;
    proposedRate?: number;
    message?: string;
    proposedBy?: 'coach' | 'owner';
  }) {
    const updateData: any = { updatedAt: new Date() };
    if (data.status) updateData.status = data.status;
    if (data.proposedRate) updateData.proposedRate = data.proposedRate.toString();
    if (data.proposedBy) updateData.proposedBy = data.proposedBy;

    const [updated] = await db
      .update(rateNegotiations)
      .set(updateData)
      .where(eq(rateNegotiations.id, id))
      .returning();

    // Add history entry if there's a new proposal
    if (data.proposedRate && data.proposedBy) {
      await db.insert(rateNegotiationHistory).values({
        negotiationId: id,
        rate: data.proposedRate.toString(),
        proposedBy: data.proposedBy,
        message: data.message || '',
        status: data.status || 'pending'
      });
    }

    return updated;
  }
}

export const storage = new DatabaseStorage();

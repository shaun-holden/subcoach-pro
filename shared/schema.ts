import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  userType: varchar("user_type").notNull().default(""), // 'coach' or 'owner'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Coach profiles
export const coaches = pgTable("coaches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  address: text("address"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  maxTravelDistance: integer("max_travel_distance").default(10), // in miles
  paymentMethods: text("payment_methods").array().default([]), // ['cash', 'check', 'paypal', 'venmo', 'zelle']
  paymentDetails: jsonb("payment_details").$type<{
    checkNumber?: string;
    paypalHandle?: string;
    venmoHandle?: string;
    zelleContact?: string;
  }>(),
  form1099Path: varchar("form_1099_path"),
  emailToGymOwners: varchar("email_to_gym_owners"),
  certifications: text("certifications").array().default([]), // ['usag', 'aau', 'nga']
  certificationDetails: jsonb("certification_details").default({}), // {usag: {membershipNumber: '', expirationDate: ''}, aau: {...}, nga: {...}}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Gym owners
export const owners = pgTable("owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  gymName: varchar("gym_name").notNull(),
  phone: varchar("phone"),
  address: text("address").notNull(),
  // Billing fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // active, cancelled, past_due, etc.
  planType: varchar("plan_type").default('starter'), // starter (pay-as-you-go) or pro
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Substitute requests
export const substituteRequests = pgTable("substitute_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => owners.id),
  eventType: varchar("event_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
  daysOfWeek: text("days_of_week").array().default([]), // ['monday', 'tuesday', etc.]
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: varchar("recurrence_pattern"), // 'daily', 'weekly', 'monthly'
  recurrenceInterval: integer("recurrence_interval").default(1), // every N days/weeks/months
  recurrenceEndDate: timestamp("recurrence_end_date"),
  timezone: varchar("timezone").default('America/New_York'),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  rateOffer: decimal("rate_offer", { precision: 10, scale: 2 }), // gym owner's offered rate
  maxTravelDistance: integer("max_travel_distance").default(10), // in miles
  description: text("description"),
  requirements: text("requirements").array().default([]), // skill requirements
  priority: varchar("priority").default('medium'), // 'low', 'medium', 'high', 'urgent'
  status: varchar("status").default('active'), // 'active', 'filled', 'expired'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing transactions for tracking payments
export const billingTransactions = pgTable("billing_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => owners.id),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeInvoiceId: varchar("stripe_invoice_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default('usd'),
  status: varchar("status").notNull(), // pending, succeeded, failed, cancelled
  transactionType: varchar("transaction_type").notNull(), // subscription, booking_fee, refund
  description: text("description"),
  substituteRequestId: varchar("substitute_request_id").references(() => substituteRequests.id),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Calendar events for schedule management
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  eventType: varchar("event_type").notNull().default("coaching_session"), // coaching_session, substitute_request, availability, blocked_time
  status: varchar("status").notNull().default("confirmed"), // confirmed, pending, cancelled
  location: varchar("location"),
  timezone: varchar("timezone").default('America/New_York'),
  isAllDay: boolean("is_all_day").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Recurrence fields
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: varchar("recurrence_pattern"), // daily, weekly, monthly
  recurrenceInterval: integer("recurrence_interval").default(1), // every X days/weeks/months
  recurrenceEnd: timestamp("recurrence_end"), // when recurrence stops
  
  // Related entities
  substituteRequestId: varchar("substitute_request_id").references(() => substituteRequests.id),
  applicationId: varchar("application_id"),
  
  // Email reminder settings
  emailReminders: boolean("email_reminders").default(true),
  reminderTimes: text("reminder_times").array().default([]), // ['15min', '1hour', '1day']
  
  // Additional metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // flexible data storage
});

// Coach availability schedules
export const coachAvailability = pgTable("coach_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar("coach_id").notNull().references(() => coaches.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, etc.
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
  timezone: varchar("timezone").default('America/New_York'),
  isAvailable: boolean("is_available").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Applications from coaches to substitute requests
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => substituteRequests.id),
  coachId: varchar("coach_id").notNull().references(() => coaches.id),
  requestedRate: decimal("requested_rate", { precision: 10, scale: 2 }),
  message: text("message"),
  status: varchar("status").default('pending'), // 'pending', 'accepted', 'rejected'
  appliedAt: timestamp("applied_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
});

// Rate negotiations table
export const rateNegotiations = pgTable("rate_negotiations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id),
  currentRate: decimal("current_rate", { precision: 10, scale: 2 }).notNull(),
  proposedRate: decimal("proposed_rate", { precision: 10, scale: 2 }).notNull(),
  proposedBy: varchar("proposed_by").notNull(), // 'coach' or 'owner'
  status: varchar("status").notNull().default("pending"), // 'pending', 'accepted', 'declined', 'counter-offered'
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rateNegotiationHistory = pgTable("rate_negotiation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  negotiationId: varchar("negotiation_id").notNull().references(() => rateNegotiations.id),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  proposedBy: varchar("proposed_by").notNull(), // 'coach' or 'owner'
  status: varchar("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  coach: one(coaches, {
    fields: [users.id],
    references: [coaches.userId],
  }),
  owner: one(owners, {
    fields: [users.id],
    references: [owners.userId],
  }),
}));

export const coachesRelations = relations(coaches, ({ one, many }) => ({
  user: one(users, {
    fields: [coaches.userId],
    references: [users.id],
  }),
  applications: many(applications),
}));

export const ownersRelations = relations(owners, ({ one, many }) => ({
  user: one(users, {
    fields: [owners.userId],
    references: [users.id],
  }),
  substituteRequests: many(substituteRequests),
}));

export const substituteRequestsRelations = relations(substituteRequests, ({ one, many }) => ({
  owner: one(owners, {
    fields: [substituteRequests.ownerId],
    references: [owners.id],
  }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  request: one(substituteRequests, {
    fields: [applications.requestId],
    references: [substituteRequests.id],
  }),
  coach: one(coaches, {
    fields: [applications.coachId],
    references: [coaches.id],
  }),
  rateNegotiations: many(rateNegotiations),
}));

export const rateNegotiationsRelations = relations(rateNegotiations, ({ one, many }) => ({
  application: one(applications, {
    fields: [rateNegotiations.applicationId],
    references: [applications.id],
  }),
  history: many(rateNegotiationHistory),
}));

export const rateNegotiationHistoryRelations = relations(rateNegotiationHistory, ({ one }) => ({
  negotiation: one(rateNegotiations, {
    fields: [rateNegotiationHistory.negotiationId],
    references: [rateNegotiations.id],
  }),
}));

// Schemas for inserts
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoachSchema = createInsertSchema(coaches).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOwnerSchema = createInsertSchema(owners).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubstituteRequestSchema = createInsertSchema(substituteRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  appliedAt: true,
});

export const insertBillingTransactionSchema = createInsertSchema(billingTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Owner = typeof owners.$inferSelect;
export type Coach = typeof coaches.$inferSelect;
export type SubstituteRequest = typeof substituteRequests.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type BillingTransaction = typeof billingTransactions.$inferSelect;

// Insert types from Zod schemas
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCoach = z.infer<typeof insertCoachSchema>;
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type InsertSubstituteRequest = z.infer<typeof insertSubstituteRequestSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type InsertBillingTransaction = z.infer<typeof insertBillingTransactionSchema>;

// Calendar and scheduling schemas
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoachAvailabilitySchema = createInsertSchema(coachAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CoachAvailability = typeof coachAvailability.$inferSelect;
export type InsertCoachAvailability = z.infer<typeof insertCoachAvailabilitySchema>;

// Rate negotiation schemas
export const insertRateNegotiationSchema = createInsertSchema(rateNegotiations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRateNegotiationHistorySchema = createInsertSchema(rateNegotiationHistory).omit({
  id: true,
  createdAt: true,
});

export type RateNegotiation = typeof rateNegotiations.$inferSelect;
export type InsertRateNegotiation = z.infer<typeof insertRateNegotiationSchema>;
export type RateNegotiationHistory = typeof rateNegotiationHistory.$inferSelect;
export type InsertRateNegotiationHistory = z.infer<typeof insertRateNegotiationHistorySchema>;

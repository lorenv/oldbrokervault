import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const subscriptionPlans = {
  free: {
    name: "Free",
    limit: 1,
    regenerationLimit: 2,
    price: 0
  },
  standard: {
    name: "Standard",
    limit: 10,
    regenerationLimit: 5,
    price: 500
  },
  premium: {
    name: "Premium",
    limit: 100,
    regenerationLimit: Infinity,
    price: 4000
  }
} as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  subscriptionStatus: text("subscription_status").default("free").notNull(),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  monthlyUsage: integer("monthly_usage").default(0).notNull(),
  lastUsageReset: timestamp("last_usage_reset").defaultNow().notNull()
});

export const cimDocuments = pgTable("cim_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  directions: text("directions").notNull(),
  regenerationCount: integer("regeneration_count").default(0).notNull(),
  analysis: jsonb("analysis").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  adminCode: z.string().optional()
});

export const insertCimDocumentSchema = createInsertSchema(cimDocuments).pick({
  title: true,
  transcript: true,
  directions: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CimDocument = typeof cimDocuments.$inferSelect;
export type InsertCimDocument = z.infer<typeof insertCimDocumentSchema>;

// Default analysis prompt for CIM generation
export const DEFAULT_CIM_DIRECTIONS = `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers. When analyzing the provided transcript, structure the information to answer key questions about the business. Focus on:

1. Business Overview
- Company history and founding story
- Business model and services/products
- Growth trajectory and milestones

2. Market Position
- Target market and customer profile
- Competitive landscape
- Unique value propositions

3. Operations
- Key processes and systems
- Supply chain and vendor relationships
- Customer acquisition and retention

4. Team Structure
- Management team background
- Employee composition
- Roles and responsibilities

5. Investment Highlights
- Growth opportunities
- Key strengths and advantages
- Potential areas for expansion

Please analyze the transcript thoroughly and provide detailed insights in each section.`;
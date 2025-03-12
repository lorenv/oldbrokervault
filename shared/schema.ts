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
export const DEFAULT_CIM_DIRECTIONS = `You are to create custom text for generating an offering memorandum. Include extracting the exact questions from the knowledge base and applying them to the new memorandum. The answers for the Q&A section are derived directly from a provided transcript, ensuring alignment with the new data while maintaining aesthetic and organizational consistency. The answers should have a professional tone, and give as much pertinent information as possible. If the answer is not provided by the transcript, you can remove the question from the CIM.

Not only should it include the exact questions from the questions attached, but you should add additional questions that are relevant. Especially include any breakdowns in the numbers, like if revenue is 60% commercial business and 40% residential business, or break down staff roles with their tenures and responsibilities. Create tables for these breakdowns. 

At the top of the CIM, have a business summary that gives a high level, robust summary of the business and its attractive features.

Include the following sections with specific questions:

1. Business Summary
   - High-level overview of the business
   - Key attractive features
   - Investment highlights

2. Business Story
   - What year did the business begin?
   - How did you get the idea?
   - What services/products does the business provide?
   - What is the order/process flow from start to finish?
   - How did you grow it?
   - How is the company structured (LLC, Inc., etc.)?

3. Executive Summary
   - What makes the business attractive to buyers?
   - What growth opportunities are available?

4. Assets
   - List digital assets (websites, social media)
   - Business address
   - Estimated value of FF&E

5. Ownership
   - Owner's full name, percentage, background, experience, and education
   - Trademarks or copyrights

6. Market Analysis
   - What is unique about the business?
   - Profile of average customer/typical client
   - Why is the business being sold?
   - Top competitors
   - Business strengths

7. Operations
   - Suppliers information (count, transferability, concentration, terms, replaceability)
   - Customers information (recurring, relationships, concentration, contracts, replaceability)

8. Inventory
   - Lead time
   - Sourcing
   - Storage
   - Value
   - SKU count
   - Top products

9. Sales
   - Revenue breakdown by channel/category (include tables)
   - Seasonality
   - Average order value
   - Competitive pricing
   - Pricing model
   - Payment methods

10. Marketing
    - Strategies
    - Paid advertising channels and effectiveness

11. Team Structure
    - Detailed breakdown of staff roles, tenures, and responsibilities (include tables)
    - Management responsibilities
    - Training systems

12. Financials
    - Revenue and profit trends
    - Breakdown of revenue streams (include tables)
    - Operating expenses
    - Customer metrics

Present all information in a professional format suitable for potential business buyers. Create tables where appropriate to show breakdowns of financial data, customer segments, and team structure.`;
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
  },
  admin: {  // Added admin plan type
    name: "Admin",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 0
  }
} as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  subscriptionStatus: text("subscription_status").default("free").notNull(),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  monthlyUsage: integer("monthly_usage").default(0).notNull(),
  lastUsageReset: timestamp("last_usage_reset").defaultNow().notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
});

export const cimDocuments = pgTable("cim_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  directions: text("directions").notNull(),
  regenerationCount: integer("regeneration_count").default(0).notNull(),
  analysis: jsonb("analysis").notNull(),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  websiteScreenshotUrl: text("website_screenshot_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Please enter a valid email address"),
  adminCode: z.string().optional()
});

export const insertCimDocumentSchema = createInsertSchema(cimDocuments).pick({
  title: true,
  transcript: true,
  directions: true,
}).extend({
  websiteUrl: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  websiteScreenshotUrl: z.string().nullable().optional()
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CimDocument = typeof cimDocuments.$inferSelect;
export type InsertCimDocument = z.infer<typeof insertCimDocumentSchema>;

// Default analysis prompt for CIM generation
export const DEFAULT_CIM_DIRECTIONS = `You are to create custom text for generating an offering memorandum. This includes extracting the exact questions from the knowledge base attached and applying them to the new memorandum. The answers for the Q&A section are derived directly from a provided transcript, ensuring alignment with the new data while maintaining the example's aesthetic and organizational consistency. The answers should have a professional tone, and give as much pertinent information as possible. If the answer is not provided by the transcript, you can remove the question from the CIM.

Additionally, you must carefully review the transcript for any key facts or important information about the business that may not fit into the base template questions. For such information, create appropriate custom questions and provide detailed answers. This ensures that all significant business details from the transcript are captured in the CIM, even if they don't align with the standard template questions. The goal is to create a comprehensive document that includes ALL important information provided in the transcript.

Not only should it include the exact questions from the questions attached, but you should add additional questions that are relevant. Especially include any breakdowns in the numbers, like if revenue is 60% commercial business and 40% residential business, or break down staff roles with their tenures and responsibilities. Create tables for these breakdowns. At the top of the CIM, have a business summary that gives a high level, robust summary of the business and its attractive features.

Tell me the story of the business?
What year did the business begin?  
How did you get the idea? 
Can you describe the business model in your own words - what services (or products) does the business provide? 
Take me through the flow of the order/process from start to finish and how you get paid.   
How did you grow it? 

Describe each of the owner's backgrounds.  Please include: What they were doing before joining or starting the company?  Which past businesses have they worked for?  List formal education, training, and skills.)

Executive Summary: 
What makes your business extremely attractive to a prospective buyer?  
What growth opportunities are available to the buyer to expand the business?
Owners full name and their ownership percentages:
Are there any trademarks or copyright associated with the business?
What is unique about the business?
What is the profile of the average customer/typical client?
Why is the business being sold?
Who are the top three competitors?
What are the business' strengths?
Does the business have suppliers? 
How many suppliers does the business have and will the relationships transfer?  Please estimate what percentage each supplier represents.  
Describe the contracts/terms of the suppliers. (any contracts and payment terms net30, net60, etc)
Is it easy to replace suppliers if needed?
Does the business have recurring customers, or clients? 
How many recurring customers/clients does the business have and will the relationships transfer?  How does revenue by customer look - do a few customers make up a large portion? Does [broker] have a client concentration breakdown?
Describe the contracts/terms of the customers/clients. (any contracts and payment terms net30, net60, etc)
Is it easy to replace customers/clients if needed?
What is the typical lead time for inventory?
Do you buy local or import the inventory?
Where is inventory held?
How much inventory is on hand (at cost)? Is it included in the sales price?
How many SKUs, or services, does the company have?

Monetization: 
Does the business have seasonality? If so, please explain.
What is the average order value per customer?
How does the business compare in pricing with other competitors?
How does the pricing work (is it a set price per service/product, or a quote made up by someone, discount if buying large quantities, etc) 
By what methods does the business receive payments? 

Marketing:
In what ways does the owner market to find new clients? 
Has paid advertising been done? If so, what channels (Facebook, Google Ads, etc) and was it successful? Explain why or why not.  
Is there a customer email list & if so how is the list used (promotions, company news updates, etc)? How many email addresses are on the list? 
What regular SEO efforts are engaged?

Operations:
Describe the responsibilities of each owner during the average work week.  
Describe each staff member. Please include if the staff members are full-time or part-time, if they are paid hourly or salary, and if they are contractors or employees (CIM team-put information in a chart for ease of reading
Who are the key employees?`;
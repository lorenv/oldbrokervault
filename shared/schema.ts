import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  subscriptionStatus: text("subscription_status").default("free").notNull(),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
});

export const cimDocuments = pgTable("cim_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  analysis: jsonb("analysis").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCimDocumentSchema = createInsertSchema(cimDocuments).pick({
  title: true,
  transcript: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CimDocument = typeof cimDocuments.$inferSelect;
export type InsertCimDocument = z.infer<typeof insertCimDocumentSchema>;

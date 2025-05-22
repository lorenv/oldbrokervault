import { User, CimDocument, InsertUser, InsertCimDocument, subscriptionPlans, users, cimDocuments } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin: boolean }): Promise<User>;
  updateSubscription(userId: number, status: string, endsAt: Date): Promise<void>;
  updateUserUsage(userId: number): Promise<void>;
  resetMonthlyUsage(userId: number): Promise<void>;
  checkUserLimit(userId: number): Promise<boolean>;
  createCimDocument(userId: number, doc: InsertCimDocument & { analysis: any; regenerationCount: number }): Promise<CimDocument>;
  getCimDocuments(userId: number): Promise<CimDocument[]>;
  getAllUsers(): Promise<User[]>;
  getCimDocument(id: number): Promise<CimDocument | undefined>;
  updateCimDocument(id: number, doc: Partial<CimDocument>): Promise<CimDocument>;
  deleteCimDocument(id: number): Promise<void>;
  updateGoogleTokens(userId: number, tokens: { 
    accessToken: string;
    refreshToken?: string | null;
    expiryDate: Date | null;
  }): Promise<void>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser & { isAdmin: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: insertUser.email,
        password: insertUser.password,
        isAdmin: insertUser.isAdmin,
        // If user is admin, set subscription status to "admin" to grant unlimited privileges
        subscriptionStatus: insertUser.isAdmin ? "admin" : "free",
      })
      .returning();
    return user;
  }

  async updateSubscription(userId: number, status: string, endsAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        subscriptionStatus: status,
        subscriptionEndsAt: endsAt,
      })
      .where(eq(users.id, userId));
  }

  async updateUserUsage(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // Reset usage if it's a new month
    const now = new Date();
    const lastReset = new Date(user.lastUsageReset);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await this.resetMonthlyUsage(userId);
      return;
    }

    await db
      .update(users)
      .set({
        monthlyUsage: user.monthlyUsage + 1,
      })
      .where(eq(users.id, userId));
  }

  async resetMonthlyUsage(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        monthlyUsage: 0,
        lastUsageReset: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async checkUserLimit(userId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // Admin users bypass all limits
    if (user.isAdmin || user.subscriptionStatus === "admin") {
      return true;
    }

    const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];
    return user.monthlyUsage < plan.limit;
  }

  async createCimDocument(userId: number, doc: InsertCimDocument & { analysis: any; regenerationCount: number }): Promise<CimDocument> {
    // Check if user is within their limit
    const canCreate = await this.checkUserLimit(userId);
    if (!canCreate) {
      throw new Error("Monthly CIM generation limit reached");
    }

    const [cimDoc] = await db
      .insert(cimDocuments)
      .values({
        userId,
        title: doc.title,
        transcript: doc.transcript,
        directions: doc.directions,
        regenerationCount: doc.regenerationCount,
        analysis: doc.analysis,
        logoUrl: doc.logoUrl,
        websiteUrl: doc.websiteUrl,
        selectedImages: doc.selectedImages,
      })
      .returning();

    await this.updateUserUsage(userId);
    return cimDoc;
  }

  async getCimDocuments(userId: number): Promise<CimDocument[]> {
    return db.select().from(cimDocuments).where(eq(cimDocuments.userId, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getCimDocument(id: number): Promise<CimDocument | undefined> {
    const [doc] = await db.select().from(cimDocuments).where(eq(cimDocuments.id, id));
    return doc;
  }

  async updateCimDocument(id: number, doc: Partial<CimDocument>): Promise<CimDocument> {
    const [updatedDoc] = await db
      .update(cimDocuments)
      .set(doc)
      .where(eq(cimDocuments.id, id))
      .returning();

    if (!updatedDoc) {
      throw new Error("Document not found");
    }

    return updatedDoc;
  }

  async updateGoogleTokens(userId: number, tokens: { 
    accessToken: string;
    refreshToken?: string | null;
    expiryDate: Date | null;
  }): Promise<void> {
    await db
      .update(users)
      .set({
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken || undefined,
        googleTokenExpiry: tokens.expiryDate,
      })
      .where(eq(users.id, userId));
  }
  
  async deleteCimDocument(id: number): Promise<void> {
    // Check if document exists before deleting
    const [doc] = await db.select().from(cimDocuments).where(eq(cimDocuments.id, id));
    if (!doc) {
      throw new Error("Document not found");
    }
    
    // Delete the document
    await db.delete(cimDocuments).where(eq(cimDocuments.id, id));
  }
}

export const storage = new DatabaseStorage();
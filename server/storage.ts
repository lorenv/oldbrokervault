import { User, CimDocument, InsertUser, InsertCimDocument, subscriptionPlans } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateSubscription(userId: number, status: string, endsAt: Date): Promise<void>;
  updateUserUsage(userId: number): Promise<void>;
  resetMonthlyUsage(userId: number): Promise<void>;
  checkUserLimit(userId: number): Promise<boolean>;
  createCimDocument(userId: number, doc: InsertCimDocument & { analysis: any }): Promise<CimDocument>;
  getCimDocuments(userId: number): Promise<CimDocument[]>;
  getAllUsers(): Promise<User[]>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cimDocs: Map<number, CimDocument>;
  private currentId: number;
  private currentDocId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.cimDocs = new Map();
    this.currentId = 1;
    this.currentDocId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = {
      ...insertUser,
      id,
      isAdmin: false,
      subscriptionStatus: "free",
      subscriptionEndsAt: null,
      monthlyUsage: 0,
      lastUsageReset: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateSubscription(userId: number, status: string, endsAt: Date): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    this.users.set(userId, {
      ...user,
      subscriptionStatus: status,
      subscriptionEndsAt: endsAt,
    });
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

    this.users.set(userId, {
      ...user,
      monthlyUsage: user.monthlyUsage + 1,
    });
  }

  async resetMonthlyUsage(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    this.users.set(userId, {
      ...user,
      monthlyUsage: 0,
      lastUsageReset: new Date(),
    });
  }

  async checkUserLimit(userId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];
    return user.monthlyUsage < plan.limit;
  }

  async createCimDocument(userId: number, doc: InsertCimDocument & { analysis: any }): Promise<CimDocument> {
    // Check if user is within their limit
    const canCreate = await this.checkUserLimit(userId);
    if (!canCreate) {
      throw new Error("Monthly CIM generation limit reached");
    }

    const id = this.currentDocId++;
    const cimDoc: CimDocument = {
      id,
      userId,
      title: doc.title,
      transcript: doc.transcript,
      analysis: doc.analysis,
      createdAt: new Date(),
    };

    this.cimDocs.set(id, cimDoc);
    await this.updateUserUsage(userId);
    return cimDoc;
  }

  async getCimDocuments(userId: number): Promise<CimDocument[]> {
    return Array.from(this.cimDocs.values()).filter(doc => doc.userId === userId);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
}

export const storage = new MemStorage();
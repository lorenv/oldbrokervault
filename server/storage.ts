import { User, CimDocument, InsertUser, InsertCimDocument } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateSubscription(userId: number, status: string, endsAt: Date): Promise<void>;
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

  async createCimDocument(userId: number, doc: InsertCimDocument & { analysis: any }): Promise<CimDocument> {
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

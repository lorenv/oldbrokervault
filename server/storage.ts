import { User, CimDocument, InsertUser, InsertCimDocument, subscriptionPlans, users, cimDocuments, customSections, ndaTemplates, ndaSignatures, shareLinks, NdaTemplate, InsertNdaTemplate, NdaSignature, InsertNdaSignature, ShareLink, InsertShareLink, CustomSection, collaborators, Collaborator, InsertCollaborator, customTags } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, sql, desc, count, and, or, ilike } from "drizzle-orm";
import { asc } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin: boolean }): Promise<User>;
  updateSubscription(userId: number, status: string, endsAt: Date): Promise<void>;
  updateUserUsage(userId: number): Promise<void>;
  resetMonthlyUsage(userId: number): Promise<void>;
  checkUserLimit(userId: number): Promise<boolean>;
  createCimDocument(userId: number, doc: InsertCimDocument & { 
    analysis: any; 
    regenerationCount: number;
    financialsEnabled?: boolean;
    askingPrice?: string | null;
    askingPriceIncluded?: boolean;
    revenue?: string | null;
    revenueIncluded?: boolean;
    ebitda?: string | null;
    ebitdaIncluded?: boolean;
  }): Promise<CimDocument>;
  getCimDocuments(userId: number, options?: { page?: number; limit?: number; search?: string }): Promise<{ documents: CimDocument[]; total: number; hasMore: boolean }>;
  getAllUsers(): Promise<User[]>;
  getCimDocument(id: number): Promise<CimDocument | undefined>;
  updateCimDocument(id: number, doc: Partial<CimDocument>): Promise<CimDocument>;
  updateCimDocumentContent(id: number, editedContent: any): Promise<CimDocument>;
  deleteCimDocument(id: number): Promise<void>;
  updateGoogleTokens(userId: number, tokens: { 
    accessToken: string;
    refreshToken?: string | null;
    expiryDate: Date | null;
  }): Promise<void>;
  updateUserProfile(userId: number, profile: {
    name?: string;
    title?: string;
    phoneNumber?: string;
    businessName?: string;
    businessLogo?: string;
    profilePhoto?: string;
  }): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateCimImages(cimId: number, imagePaths: string[]): Promise<void>;
  createPasswordResetToken(email: string, token: string, expiry: Date): Promise<boolean>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: number): Promise<void>;
  // Sharing functionality
  updateCimShareSettings(id: number, settings: {
    shareEnabled: boolean;
    shareSlug?: string;
    sharePassword?: string | null;
    shareExpiresAt?: Date | null;
    ndaProtected?: boolean;
    ndaTemplateId?: number | null;
  }): Promise<CimDocument>;
  getCimByShareSlug(slug: string): Promise<CimDocument | undefined>;
  incrementShareViewCount(id: number): Promise<void>;
  // Custom sections
  createCustomSection(section: {
    cimDocumentId: number;
    type: 'text' | 'image';
    content?: string;
    imageUrl?: string;
    insertAfterSection: string;
  }): Promise<any>;
  getCustomSections(cimDocumentId: number): Promise<any[]>;
  updateCustomSection(id: number, content: string): Promise<void>;
  deleteCustomSection(id: number): Promise<void>;
  reorderCustomSections(sections: Array<{id: number, position: number}>): Promise<void>;
  // NDA Templates
  createNdaTemplate(userId: number, template: InsertNdaTemplate): Promise<NdaTemplate>;
  getNdaTemplates(userId: number): Promise<NdaTemplate[]>;
  updateNdaTemplate(id: number, template: Partial<NdaTemplate>): Promise<NdaTemplate>;
  deleteNdaTemplate(id: number): Promise<void>;
  setDefaultNdaTemplate(userId: number, templateId: number): Promise<void>;
  // NDA Signatures
  createNdaSignature(signature: InsertNdaSignature): Promise<NdaSignature>;
  getNdaSignatures(cimDocumentId: number): Promise<NdaSignature[]>;
  checkNdaSignature(cimDocumentId: number, email: string): Promise<NdaSignature | undefined>;
  // Collaboration
  startEditing(docId: number, userId: number, userName: string): Promise<boolean>;
  stopEditing(docId: number, userId: number): Promise<void>;
  heartbeat(docId: number, userId: number): Promise<void>;
  inviteCollaborator(collaborator: InsertCollaborator): Promise<Collaborator>;
  getCollaborators(cimDocumentId: number): Promise<Collaborator[]>;
  getCollaboratorAccess(cimDocumentId: number, userId: number): Promise<{ permission: string } | null>;
  // Custom Tags
  createCustomTag(userId: number, name: string, color: string): Promise<any>;
  getCustomTags(userId: number): Promise<any[]>;
  deleteCustomTag(id: number, userId: number): Promise<void>;
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

  async createCimDocument(userId: number, doc: any): Promise<CimDocument> {
    console.log("=== STORAGE DEBUG ===");
    console.log("Document data received in storage:", {
      financialsEnabled: doc.financialsEnabled,
      askingPrice: doc.askingPrice,
      askingPriceIncluded: doc.askingPriceIncluded,
      revenue: doc.revenue,
      revenueIncluded: doc.revenueIncluded,
      ebitda: doc.ebitda,
      ebitdaIncluded: doc.ebitdaIncluded,
    });

    // Check if user is within their limit
    const canCreate = await this.checkUserLimit(userId);
    if (!canCreate) {
      throw new Error("Monthly CIM generation limit reached");
    }

    const insertData = {
      userId,
      title: doc.title,
      transcript: doc.transcript,
      directions: doc.directions,
      regenerationCount: doc.regenerationCount,
      analysis: doc.analysis,
      logoUrl: doc.logoUrl,
      websiteUrl: doc.websiteUrl,
      websiteScreenshotUrl: doc.websiteScreenshotUrl,
      selectedImages: doc.selectedImages,
      financialsEnabled: doc.financialsEnabled || false,
      askingPrice: doc.askingPrice || null,
      askingPriceIncluded: doc.askingPriceIncluded || false,
      revenue: doc.revenue || null,
      revenueIncluded: doc.revenueIncluded || false,
      ebitda: doc.ebitda || null,
      ebitdaIncluded: doc.ebitdaIncluded || false,
    };

    console.log("Data being inserted into database:", insertData);
    console.log("SPECIFICALLY selectedImages:", insertData.selectedImages);

    const [cimDoc] = await db
      .insert(cimDocuments)
      .values(insertData)
      .returning();

    await this.updateUserUsage(userId);
    return cimDoc;
  }

  async getCimDocuments(userId: number, options?: { page?: number; limit?: number; search?: string }): Promise<{ documents: CimDocument[]; total: number; hasMore: boolean }> {
    const page = options?.page || 1;
    const limit = options?.limit || 12;
    const offset = (page - 1) * limit;
    const search = options?.search?.trim();

    // Build base query
    let whereCondition = eq(cimDocuments.userId, userId);
    
    // Add search condition if provided
    if (search) {
      const searchCondition = or(
        ilike(cimDocuments.title, `%${search}%`),
        ilike(cimDocuments.directions, `%${search}%`)
      );
      if (searchCondition) {
        whereCondition = and(
          eq(cimDocuments.userId, userId),
          searchCondition
        );
      }
    }

    // Get total count for pagination
    const [totalCount] = await db
      .select({ count: count() })
      .from(cimDocuments)
      .where(whereCondition);

    const total = Number(totalCount.count);

    // Get paginated results 
    const results = await db
      .select()
      .from(cimDocuments)
      .where(whereCondition)
      .orderBy(desc(cimDocuments.createdAt))
      .limit(limit)
      .offset(offset);

    // Count NDA signatures for each document
    const documents = await Promise.all(
      results.map(async (result) => {
        const [signatureCount] = await db
          .select({ count: count() })
          .from(ndaSignatures)
          .where(eq(ndaSignatures.cimDocumentId, result.id));
        
        return {
          ...result,
          ndaSignatureCount: Number(signatureCount.count)
        };
      })
    );

    const hasMore = offset + documents.length < total;

    return {
      documents,
      total,
      hasMore
    };
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getCimDocument(id: number): Promise<CimDocument | undefined> {
    const [doc] = await db.select().from(cimDocuments).where(eq(cimDocuments.id, id));
    return doc;
  }

  async getCim(id: number): Promise<CimDocument | undefined> {
    return this.getCimDocument(id);
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

  async updateCimDocumentContent(id: number, editedContent: any): Promise<CimDocument> {
    const [updated] = await db
      .update(cimDocuments)
      .set({ editedContent })
      .where(eq(cimDocuments.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Document not found");
    }
    
    return updated;
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

  async updateUserProfile(userId: number, profile: {
    name?: string;
    title?: string;
    phoneNumber?: string;
    businessName?: string;
    businessLogo?: string;
    profilePhoto?: string;
  }): Promise<User> {
    const [user] = await db.update(users)
      .set(profile)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async updateCimImages(cimId: number, imagePaths: string[]): Promise<void> {
    await db.update(cimDocuments)
      .set({ selectedImages: imagePaths })
      .where(eq(cimDocuments.id, cimId));
  }

  async createPasswordResetToken(email: string, token: string, expiry: Date): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return false;

    await db.update(users)
      .set({
        resetToken: token,
        resetTokenExpiry: expiry
      })
      .where(eq(users.email, email));
    return true;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(eq(users.resetToken, token));
    
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return undefined;
    }
    
    return user;
  }

  async clearPasswordResetToken(userId: number): Promise<void> {
    await db.update(users)
      .set({
        resetToken: null,
        resetTokenExpiry: null
      })
      .where(eq(users.id, userId));
  }

  async updateCimShareSettings(id: number, settings: {
    shareEnabled: boolean;
    shareSlug?: string;
    sharePassword?: string | null;
    shareExpiresAt?: Date | null;
    ndaProtected?: boolean;
    ndaTemplateId?: number | null;
  }): Promise<CimDocument> {
    const [doc] = await db.update(cimDocuments)
      .set({
        shareEnabled: settings.shareEnabled,
        shareSlug: settings.shareSlug,
        sharePassword: settings.sharePassword,
        shareExpiresAt: settings.shareExpiresAt,
        ndaProtected: settings.ndaProtected,
        ndaTemplateId: settings.ndaTemplateId,
      })
      .where(eq(cimDocuments.id, id))
      .returning();
    return doc;
  }

  async getCimByShareSlug(slug: string): Promise<CimDocument | undefined> {
    const [doc] = await db.select()
      .from(cimDocuments)
      .where(eq(cimDocuments.shareSlug, slug));
    return doc || undefined;
  }

  async incrementShareViewCount(id: number): Promise<void> {
    // First get the current count, then increment it
    const [current] = await db.select({ count: cimDocuments.shareViewCount })
      .from(cimDocuments)
      .where(eq(cimDocuments.id, id));
    
    await db.update(cimDocuments)
      .set({ 
        shareViewCount: (current?.count || 0) + 1,
        shareLastViewed: new Date()
      })
      .where(eq(cimDocuments.id, id));
  }

  async createCustomSection(section: {
    cimDocumentId: number;
    type: 'text' | 'image';
    title?: string;
    content?: string;
    imageUrl?: string;
    insertAfterSection: string;
  }): Promise<any> {
    // Get current max position for this section
    const existingSections = await db.select()
      .from(customSections)
      .where(eq(customSections.cimDocumentId, section.cimDocumentId));
    
    const maxPosition = existingSections.length > 0 
      ? Math.max(...existingSections.map(s => s.position)) 
      : 0;

    const [newSection] = await db.insert(customSections)
      .values({
        cimDocumentId: section.cimDocumentId,
        type: section.type,
        title: section.title,
        content: section.content,
        imageUrl: section.imageUrl,
        insertAfterSection: section.insertAfterSection,
        position: maxPosition + 1
      })
      .returning();
    
    return newSection;
  }

  async getCustomSections(cimDocumentId: number): Promise<any[]> {
    return await db.select()
      .from(customSections)
      .where(eq(customSections.cimDocumentId, cimDocumentId))
      .orderBy(asc(customSections.position));
  }

  async updateCustomSection(id: number, content: string): Promise<void> {
    await db.update(customSections)
      .set({ content })
      .where(eq(customSections.id, id));
  }

  async deleteCustomSection(id: number): Promise<void> {
    await db.delete(customSections)
      .where(eq(customSections.id, id));
  }

  async reorderCustomSections(sections: Array<{id: number, position: number}>): Promise<void> {
    for (const section of sections) {
      await db.update(customSections)
        .set({ position: section.position })
        .where(eq(customSections.id, section.id));
    }
  }

  // NDA Templates
  async createNdaTemplate(userId: number, template: InsertNdaTemplate): Promise<NdaTemplate> {
    // If this is set as default, unset any existing default for this user
    if (template.isDefault) {
      await db.update(ndaTemplates)
        .set({ isDefault: false })
        .where(eq(ndaTemplates.userId, userId));
    }

    const [newTemplate] = await db.insert(ndaTemplates)
      .values({
        userId,
        ...template
      })
      .returning();
    return newTemplate;
  }

  async getNdaTemplates(userId: number): Promise<NdaTemplate[]> {
    return await db.select()
      .from(ndaTemplates)
      .where(eq(ndaTemplates.userId, userId))
      .orderBy(asc(ndaTemplates.createdAt));
  }

  async updateNdaTemplate(id: number, template: Partial<NdaTemplate>): Promise<NdaTemplate> {
    // If this is being set as default, unset any existing default for this user
    if (template.isDefault) {
      const [existing] = await db.select().from(ndaTemplates).where(eq(ndaTemplates.id, id));
      if (existing) {
        await db.update(ndaTemplates)
          .set({ isDefault: false })
          .where(eq(ndaTemplates.userId, existing.userId));
      }
    }

    const [updated] = await db.update(ndaTemplates)
      .set(template)
      .where(eq(ndaTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteNdaTemplate(id: number): Promise<void> {
    await db.delete(ndaTemplates)
      .where(eq(ndaTemplates.id, id));
  }

  async setDefaultNdaTemplate(userId: number, templateId: number): Promise<void> {
    // First unset all defaults for this user
    await db.update(ndaTemplates)
      .set({ isDefault: false })
      .where(eq(ndaTemplates.userId, userId));
    
    // Then set the new default
    await db.update(ndaTemplates)
      .set({ isDefault: true })
      .where(eq(ndaTemplates.id, templateId));
  }

  // NDA Signatures
  async createNdaSignature(signature: InsertNdaSignature): Promise<NdaSignature> {
    const [newSignature] = await db.insert(ndaSignatures)
      .values(signature)
      .returning();
    return newSignature;
  }

  async getNdaSignatures(cimDocumentId: number): Promise<NdaSignature[]> {
    return await db.select()
      .from(ndaSignatures)
      .where(eq(ndaSignatures.cimDocumentId, cimDocumentId))
      .orderBy(asc(ndaSignatures.signedAt));
  }

  async checkNdaSignature(cimDocumentId: number, email: string): Promise<NdaSignature | undefined> {
    const [signature] = await db.select()
      .from(ndaSignatures)
      .where(
        sql`${ndaSignatures.cimDocumentId} = ${cimDocumentId} AND ${ndaSignatures.signerEmail} = ${email}`
      );
    return signature || undefined;
  }

  // Share Links
  async createShareLink(userId: number, shareLink: InsertShareLink): Promise<ShareLink> {
    const [newShareLink] = await db.insert(shareLinks)
      .values({
        userId,
        ...shareLink
      })
      .returning();
    return newShareLink;
  }

  async getShareLink(shareSlug: string): Promise<ShareLink | undefined> {
    const [shareLink] = await db.select().from(shareLinks).where(eq(shareLinks.shareSlug, shareSlug));
    return shareLink;
  }

  async getNdaTemplate(id: number): Promise<NdaTemplate | undefined> {
    const [template] = await db.select().from(ndaTemplates).where(eq(ndaTemplates.id, id));
    return template;
  }

  async getNdaSignaturesByShareSlug(shareSlug: string): Promise<NdaSignature[]> {
    return await db.select()
      .from(ndaSignatures)
      .where(eq(ndaSignatures.shareSlug, shareSlug))
      .orderBy(desc(ndaSignatures.signedAt));
  }

  // Collaboration methods
  async startEditing(docId: number, userId: number, userName: string): Promise<boolean> {
    const doc = await this.getCimDocument(docId);
    if (!doc) return false;

    // Check if someone else is currently editing
    if (doc.currentEditorId && doc.currentEditorId !== userId) {
      // Check if the current editing session is still active (within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (doc.lastActivityAt && doc.lastActivityAt > fiveMinutesAgo) {
        return false; // Someone else is actively editing
      }
    }

    // Start editing session
    await db.update(cimDocuments)
      .set({
        currentEditorId: userId,
        currentEditorName: userName,
        editStartedAt: new Date(),
        lastActivityAt: new Date()
      })
      .where(eq(cimDocuments.id, docId));

    return true;
  }

  async stopEditing(docId: number, userId: number): Promise<void> {
    const doc = await this.getCimDocument(docId);
    if (!doc || doc.currentEditorId !== userId) return;

    await db.update(cimDocuments)
      .set({
        currentEditorId: null,
        currentEditorName: null,
        editStartedAt: null,
        lastActivityAt: null
      })
      .where(eq(cimDocuments.id, docId));
  }

  async heartbeat(docId: number, userId: number): Promise<void> {
    const doc = await this.getCimDocument(docId);
    if (!doc || doc.currentEditorId !== userId) return;

    await db.update(cimDocuments)
      .set({ lastActivityAt: new Date() })
      .where(eq(cimDocuments.id, docId));
  }

  async inviteCollaborator(collaborator: InsertCollaborator): Promise<Collaborator> {
    // Generate unique invite token
    const inviteToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Check if user already exists with this email
    const existingUser = await this.getUserByEmail(collaborator.email);
    const userId = existingUser?.id || 0; // 0 for non-existing users

    const [newCollaborator] = await db.insert(collaborators)
      .values({
        ...collaborator,
        userId,
        inviteToken,
        status: 'pending'
      })
      .returning();

    return newCollaborator;
  }

  async getCollaborators(cimDocumentId: number): Promise<Collaborator[]> {
    return await db.select()
      .from(collaborators)
      .where(eq(collaborators.cimDocumentId, cimDocumentId))
      .orderBy(desc(collaborators.invitedAt));
  }

  async getCollaboratorAccess(cimDocumentId: number, userId: number): Promise<{ permission: string } | null> {
    const [collaborator] = await db.select({ permission: collaborators.permission })
      .from(collaborators)
      .where(
        sql`${collaborators.cimDocumentId} = ${cimDocumentId} AND ${collaborators.userId} = ${userId} AND ${collaborators.status} = 'accepted'`
      );
    
    return collaborator || null;
  }

  async createCustomTag(userId: number, name: string, color: string): Promise<any> {
    const [newTag] = await db.insert(customTags)
      .values({
        userId,
        name,
        color
      })
      .returning();

    return newTag;
  }

  async getCustomTags(userId: number): Promise<any[]> {
    return await db.select()
      .from(customTags)
      .where(eq(customTags.userId, userId))
      .orderBy(asc(customTags.name));
  }

  async deleteCustomTag(id: number, userId: number): Promise<void> {
    await db.delete(customTags)
      .where(sql`${customTags.id} = ${id} AND ${customTags.userId} = ${userId}`);
  }
}

export const storage = new DatabaseStorage();
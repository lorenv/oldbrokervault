import { User, CimDocument, InsertUser, InsertCimDocument, subscriptionPlans, users, cimDocuments, uploadedFiles, customSections, ndaTemplates, ndaSignatures, ndaAccessTokens, ndaRedirectLinks, shareLinks, NdaTemplate, InsertNdaTemplate, NdaSignature, InsertNdaSignature, NdaAccessToken, InsertNdaAccessToken, NdaRedirectLink, InsertNdaRedirectLink, ShareLink, InsertShareLink, CustomSection, collaborators, Collaborator, InsertCollaborator, customTags, analysisTemplates, AnalysisTemplate, InsertAnalysisTemplate, financialFiles, documentVersions, documentAnalytics, documentBaselines, DocumentBaseline, InsertDocumentBaseline } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, sql, desc, count, and, or, ilike } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { asc } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import { withRetry } from './db-utils';

const PostgresSessionStore = connectPg(session);

// Create a single session store instance to avoid multiple pool connections
let sessionStoreInstance: session.Store | null = null;

// Initialize session store with improved error handling and resilience
function initializeSessionStore() {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      ttl: 24 * 60 * 60,
      disableTouch: false,
      schemaName: 'public',
      pruneSessionInterval: 3600,
      // Improved error logging with connection resilience
      errorLog: (err: any) => {
        // Log only non-connection errors to reduce noise
        if (!err.message?.includes('Connection terminated') && 
            !err.message?.includes('connection timeout')) {
          console.error('Session store error:', err.message);
        }
      },
    });
    
    // Set max listeners to handle multiple concurrent sessions
    sessionStoreInstance.setMaxListeners(200);
    
    // Add error handling for the session store instance
    sessionStoreInstance.on?.('error', (err: any) => {
      // Silently handle connection errors - they will retry automatically
      if (!err.message?.includes('Connection terminated')) {
        console.error('Session store instance error:', err.message);
      }
    });
  }
  return sessionStoreInstance;
}

function getSessionStore(): session.Store {
  return initializeSessionStore();
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserProfile(id: number): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin: boolean }): Promise<User>;
  updateSubscription(userId: number, status: string, endsAt: Date): Promise<void>;
  updateUserUsage(userId: number): Promise<void>;
  updateDocumentCreationUsage(userId: number): Promise<void>;
  updateRegenerationUsage(userId: number): Promise<void>;
  resetMonthlyUsage(userId: number): Promise<void>;
  checkUserLimit(userId: number): Promise<boolean>;
  checkRegenerationLimit(userId: number): Promise<boolean>;
  createDocumentBaseline(baseline: InsertDocumentBaseline): Promise<DocumentBaseline>;
  getDocumentBaseline(cimDocumentId: number): Promise<DocumentBaseline | undefined>;
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
    shareEnabled?: boolean;
    shareSlug?: string | null;
    sharePassword?: string | null;
    shareExpiresAt?: Date | null;
    ndaProtected?: boolean;
    ndaTemplateId?: number | null;
  }): Promise<CimDocument>;
  createUploadedCimDocument(userId: number, data: {
    title: string;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
  }): Promise<CimDocument>;
  createUploadedFile(data: {
    cimDocumentId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }): Promise<any>;
  getUploadedFiles(cimDocumentId: number): Promise<any[]>;
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
    businessLogoBackup?: string;
    profilePhotoBackup?: string;
  }): Promise<User>;
  updateUserEmail(userId: number, email: string): Promise<void>;
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
  updateCustomSection(id: number, updates: { title?: string; content?: string; imageUrls?: string[]; imageUrlsBackup?: string[] }): Promise<void>;
  getAllCustomSections(): Promise<any[]>;
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
  getNdaSignatureById(signatureId: number): Promise<NdaSignature | undefined>;
  checkNdaSignature(cimDocumentId: number, email: string): Promise<NdaSignature | undefined>;
  // NDA Approval
  approveNdaSignature(signatureId: number, userId: number): Promise<NdaSignature>;
  approveNdaSignaturesBatch(signatureIds: number[], userId: number): Promise<NdaSignature[]>;
  // NDA Access Tokens
  createNdaAccessToken(token: string, cimDocumentId: number, ndaSignatureId: number, signerEmail: string, expiresAt?: Date): Promise<any>;
  getNdaAccessToken(token: string): Promise<any | undefined>;
  updateTokenLastAccessed(token: string): Promise<void>;
  deactivateToken(token: string): Promise<void>;
  // NDA Redirect Links
  createNdaRedirectLink(redirectId: string, tokenId: number, cimDocumentId: number, signerEmail: string): Promise<any>;
  getNdaRedirectLink(redirectId: string): Promise<any | undefined>;
  updateRedirectLinkToken(redirectId: string, newTokenId: number): Promise<void>;
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
  // Analysis Templates
  createAnalysisTemplate(userId: number, template: any): Promise<any>;
  getAnalysisTemplates(userId: number): Promise<any[]>;
  updateAnalysisTemplate(id: number, template: any): Promise<any>;
  deleteAnalysisTemplate(id: number, userId: number): Promise<void>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = getSessionStore();
  }

  async getUser(id: number): Promise<User | undefined> {
    return await withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return user;
    } catch (error) {
      console.error('Error in getUserByEmail:', error);
      throw error;
    }
  }

  async getUserProfile(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
    
    // Add default NDA template for new users
    await this.createDefaultNdaTemplate(user.id);
    
    return user;
  }

  async updateSubscription(userId: number, status: string, endsAt: Date, subscriptionId?: string): Promise<void> {
    await db
      .update(users)
      .set({
        subscriptionStatus: status,
        subscriptionEndsAt: endsAt,
        subscriptionId: subscriptionId || null,
      })
      .where(eq(users.id, userId));
  }

  async updateUserUsage(userId: number): Promise<void> {
    // Legacy method - kept for backward compatibility
    await this.updateDocumentCreationUsage(userId);
  }

  async updateDocumentCreationUsage(userId: number): Promise<void> {
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
        monthlyDocumentsCreated: user.monthlyDocumentsCreated + 1,
      })
      .where(eq(users.id, userId));
  }

  async updateRegenerationUsage(userId: number): Promise<void> {
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
        monthlyRegenerationsUsed: user.monthlyRegenerationsUsed + 1,
      })
      .where(eq(users.id, userId));
  }

  async resetMonthlyUsage(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        monthlyUsage: 0,
        monthlyDocumentsCreated: 0,
        monthlyRegenerationsUsed: 0,
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

    // Reset usage if it's a new month
    const now = new Date();
    const lastReset = new Date(user.lastUsageReset);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await this.resetMonthlyUsage(userId);
      return true; // After reset, user can create documents
    }

    const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];
    return user.monthlyDocumentsCreated < plan.limit;
  }

  async checkRegenerationLimit(userId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // Admin users bypass all limits
    if (user.isAdmin || user.subscriptionStatus === "admin") {
      return true;
    }

    // Reset usage if it's a new month
    const now = new Date();
    const lastReset = new Date(user.lastUsageReset);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await this.resetMonthlyUsage(userId);
      return true; // After reset, user can regenerate
    }

    const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];
    return user.monthlyRegenerationsUsed < plan.regenerationLimit;
  }

  async createDocumentBaseline(baseline: InsertDocumentBaseline): Promise<DocumentBaseline> {
    const [created] = await db
      .insert(documentBaselines)
      .values(baseline)
      .returning();
    return created;
  }

  async getDocumentBaseline(cimDocumentId: number): Promise<DocumentBaseline | undefined> {
    const [baseline] = await db
      .select()
      .from(documentBaselines)
      .where(eq(documentBaselines.cimDocumentId, cimDocumentId));
    return baseline;
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
      coverImageUrl: doc.coverImageUrl || null,
      coverImagePosition: doc.coverImagePosition || null,
      coverImageAttribution: doc.coverImageAttribution || null,
      // Share settings - enable by default
      shareEnabled: doc.shareEnabled || false,
      shareSlug: doc.shareSlug || null,
      sharePassword: doc.sharePassword || null,
      shareExpiresAt: doc.shareExpiresAt || null,
      ndaProtected: doc.ndaProtected || false,
      ndaTemplateId: doc.ndaTemplateId || null,
    };

    console.log("Data being inserted into database:", insertData);
    console.log("SPECIFICALLY selectedImages:", insertData.selectedImages);

    const [cimDoc] = await db
      .insert(cimDocuments)
      .values(insertData)
      .returning();

    // Create baseline for content validation
    const { ContentValidationService } = await import('./content-validation');
    const baseline = ContentValidationService.createBaseline(
      cimDoc.id,
      doc.transcript,
      doc.directions,
      {
        revenue: doc.revenue,
        ebitda: doc.ebitda
      }
    );
    await this.createDocumentBaseline(baseline);

    await this.updateDocumentCreationUsage(userId);
    return cimDoc;
  }

  async createUploadedCimDocument(userId: number, data: {
    title: string;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
  }): Promise<CimDocument> {
    // Check if user is within their limit
    const canCreate = await this.checkUserLimit(userId);
    if (!canCreate) {
      throw new Error("Monthly CIM generation limit reached");
    }

    // Generate automatic share link for uploaded document
    const randomId = Math.random().toString(36).substring(2, 8);
    const shareSlug = `cim-${randomId}`;

    const [cimDoc] = await db
      .insert(cimDocuments)
      .values({
        userId,
        title: data.title,
        transcript: 'Uploaded File', // Required field
        directions: 'Uploaded Document', // Required field
        regenerationCount: 0,
        analysis: { isUploadedFile: true }, // Required field with indicator
        isUploadedFile: true,
        uploadedFileName: data.fileName,
        uploadedFilePath: data.filePath,
        uploadedFileSize: data.fileSize,
        uploadedFileMimeType: data.mimeType,
        // Enable sharing by default with generated slug
        shareEnabled: true,
        shareSlug: shareSlug,
        sharePassword: null,
        shareExpiresAt: null,
        ndaProtected: false,
        ndaTemplateId: null,
      })
      .returning();

    await this.updateDocumentCreationUsage(userId);
    return cimDoc;
  }

  async createUploadedFile(data: {
    cimDocumentId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }): Promise<any> {
    const [uploadedFile] = await db
      .insert(uploadedFiles)
      .values(data)
      .returning();
    return uploadedFile;
  }

  async getUploadedFiles(cimDocumentId: number): Promise<any[]> {
    return await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.cimDocumentId, cimDocumentId));
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

    // For dashboard, only select essential fields to minimize data transfer
    const results = await db
      .select({
        id: cimDocuments.id,
        userId: cimDocuments.userId,
        title: cimDocuments.title,
        createdAt: cimDocuments.createdAt,
        shareEnabled: cimDocuments.shareEnabled,
        shareSlug: cimDocuments.shareSlug,
        isUploadedFile: cimDocuments.isUploadedFile,
        uploadedFileName: cimDocuments.uploadedFileName,
        // Minimal fields for recent documents display
        regenerationCount: cimDocuments.regenerationCount
      })
      .from(cimDocuments)
      .where(whereCondition)
      .orderBy(desc(cimDocuments.createdAt))
      .limit(limit + 1); // Get one extra to check for more

    const hasMore = results.length > limit;
    const documents = results.slice(0, limit).map(result => ({
      ...result,
      // Add missing required fields with minimal defaults for dashboard display
      version: 1,
      transcript: '',
      directions: '',
      analysis: {},
      logoUrl: null,
      websiteUrl: null,
      selectedImages: null,
      sharePassword: null,
      shareExpiresAt: null,
      shareViewCount: 0,
      ndaProtected: false,
      ndaTemplateId: null,
      financialsEnabled: false,
      askingPrice: null,
      askingPriceIncluded: false,
      revenue: null,
      revenueIncluded: false,
      ebitda: null,
      ebitdaIncluded: false,
      coverImageUrl: null,
      coverImagePosition: null,
      coverImageAttribution: null,
      updatedAt: result.createdAt,
      uploadedFilePath: null,
      uploadedFileSize: null,
      uploadedFileMimeType: null,
      editedContent: null,
      websiteScreenshotUrl: null,
      shareLastViewed: null,
      currentEditorId: null,
      currentEditorName: null,
      lastEditAt: null,
      editorsHeartbeat: {},
      lastModifiedBy: null,
      ndaSignatureCount: 0
    }));

    // For dashboard, we don't need exact total count - just use estimated
    const total = hasMore ? offset + limit + 1 : offset + documents.length;

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
    return await withRetry(async () => {
      const [doc] = await db.select().from(cimDocuments).where(eq(cimDocuments.id, id));
      return doc;
    });
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
    
    // Note: We intentionally do NOT decrement monthlyUsage to preserve accurate 
    // generation counts for subscription billing purposes
    
    // Delete related records in proper order to avoid foreign key constraints
    await db.delete(customSections).where(eq(customSections.cimDocumentId, id));
    await db.delete(uploadedFiles).where(eq(uploadedFiles.cimDocumentId, id));
    await db.delete(ndaSignatures).where(eq(ndaSignatures.cimDocumentId, id));
    await db.delete(ndaAccessTokens).where(eq(ndaAccessTokens.cimDocumentId, id));
    await db.delete(ndaRedirectLinks).where(eq(ndaRedirectLinks.cimDocumentId, id));
    await db.delete(financialFiles).where(eq(financialFiles.cimDocumentId, id));
    await db.delete(collaborators).where(eq(collaborators.cimDocumentId, id));
    await db.delete(documentVersions).where(eq(documentVersions.cimDocumentId, id));
    await db.delete(documentAnalytics).where(eq(documentAnalytics.cimDocumentId, id));
    
    // Note: share_links table uses 'cim_id' instead of 'cim_document_id'
    await db.execute(sql`DELETE FROM share_links WHERE cim_id = ${id}`);
    
    // Delete the main document last
    await db.delete(cimDocuments).where(eq(cimDocuments.id, id));
  }

  async updateUserProfile(userId: number, profile: {
    name?: string;
    title?: string;
    phoneNumber?: string;
    businessName?: string;
    businessLogo?: string;
    profilePhoto?: string;
    businessLogoBackup?: string;
    profilePhotoBackup?: string;
  }): Promise<User> {
    const [user] = await db.update(users)
      .set(profile)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserEmail(userId: number, email: string): Promise<void> {
    await db.update(users)
      .set({ email: email })
      .where(eq(users.id, userId));
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

  async createDefaultNdaTemplate(userId: number): Promise<void> {
    try {
      // Read the default NDA template file
      const defaultTemplatePath = path.join(__dirname, 'default-nda-template.pdf');
      const templateBuffer = fs.readFileSync(defaultTemplatePath);
      
      // Convert to base64 as expected by the schema
      const templateContent = templateBuffer.toString('base64');
      
      // Check if user already has a default template
      const existingDefault = await db.select().from(ndaTemplates)
        .where(and(eq(ndaTemplates.userId, userId), eq(ndaTemplates.isDefault, true)));
      
      if (existingDefault.length === 0) {
        // Create the default NDA template for the user
        await db.insert(ndaTemplates).values({
          userId,
          name: 'Default NDA Template',
          fileContent: templateContent,
          isDefault: true
        });
      }
      
      console.log(`Created default NDA template for user ${userId}`);
    } catch (error) {
      console.error(`Failed to create default NDA template for user ${userId}:`, error);
      // Don't throw error to avoid blocking user creation
    }
  }

  async addDefaultNdaTemplateToAllUsers(): Promise<{ processed: number; created: number }> {
    try {
      const allUsers = await db.select().from(users);
      let processed = 0;
      let created = 0;

      for (const user of allUsers) {
        await this.createDefaultNdaTemplate(user.id);
        processed++;
        
        // Check if template was actually created (not skipped due to existing default)
        const hasDefault = await db.select().from(ndaTemplates)
          .where(and(eq(ndaTemplates.userId, user.id), eq(ndaTemplates.isDefault, true)));
        if (hasDefault.length > 0) {
          created++;
        }
      }

      console.log(`Processed ${processed} users, created ${created} default NDA templates`);
      return { processed, created };
    } catch (error) {
      console.error('Failed to add default NDA templates to all users:', error);
      throw error;
    }
  }

  async updateCimShareSettings(id: number, settings: {
    shareEnabled: boolean;
    shareSlug?: string;
    customSlug?: string | null;
    sharePassword?: string | null;
    shareExpiresAt?: Date | null;
    ndaProtected?: boolean;
    ndaTemplateId?: number | null;
  }): Promise<CimDocument> {
    const [doc] = await db.update(cimDocuments)
      .set({
        shareEnabled: settings.shareEnabled,
        shareSlug: settings.shareSlug,
        customSlug: settings.customSlug,
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
    return await withRetry(async () => {
      const [doc] = await db.select()
        .from(cimDocuments)
        .where(or(eq(cimDocuments.shareSlug, slug), eq(cimDocuments.customSlug, slug)))
        .limit(1);
      return doc || undefined;
    });
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
    imageUrls?: string[];
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
        title: section.title || 'Custom Section',
        content: section.content,
        imageUrl: section.imageUrl,
        imageUrls: section.imageUrls,
        insertAfterSection: section.insertAfterSection,
        position: maxPosition + 1
      })
      .returning();
    
    return newSection;
  }

  async getCustomSections(cimDocumentId: number): Promise<any[]> {
    return await withRetry(async () => {
      return await db.select()
        .from(customSections)
        .where(eq(customSections.cimDocumentId, cimDocumentId))
        .orderBy(asc(customSections.position));
    });
  }

  async getAllCustomSections(): Promise<any[]> {
    return await db.select().from(customSections);
  }

  async updateCustomSection(id: number, updates: { title?: string; content?: string; imageUrls?: string[]; imageUrlsBackup?: string[] }): Promise<void> {
    // Filter out undefined values to avoid "No values to set" error
    const validUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error("No valid updates provided");
    }
    
    await db.update(customSections)
      .set(validUpdates)
      .where(eq(customSections.id, id));
  }

  async deleteCustomSection(id: number): Promise<void> {
    await db.delete(customSections)
      .where(eq(customSections.id, id));
  }

  async reorderCustomSections(sections: Array<{id: number, position: number, insertAfterSection?: string}>): Promise<void> {
    for (const section of sections) {
      const updateData: any = { position: section.position };
      if (section.insertAfterSection !== undefined) {
        updateData.insertAfterSection = section.insertAfterSection;
      }
      
      await db.update(customSections)
        .set(updateData)
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

  async getNdaSignatureById(signatureId: number): Promise<NdaSignature | undefined> {
    const [signature] = await db.select()
      .from(ndaSignatures)
      .where(eq(ndaSignatures.id, signatureId));
    return signature || undefined;
  }

  async checkNdaSignature(cimDocumentId: number, email: string): Promise<NdaSignature | undefined> {
    const [signature] = await db.select()
      .from(ndaSignatures)
      .where(
        sql`${ndaSignatures.cimDocumentId} = ${cimDocumentId} AND ${ndaSignatures.signerEmail} = ${email}`
      );
    return signature || undefined;
  }

  async approveNdaSignature(signatureId: number, userId: number): Promise<NdaSignature & { accessToken: string }> {
    const [approvedSignature] = await db.update(ndaSignatures)
      .set({
        approved: true,
        approvedAt: new Date(),
        approvedBy: userId
      })
      .where(eq(ndaSignatures.id, signatureId))
      .returning();

    // Get the access token for this signature
    const [accessToken] = await db
      .select()
      .from(ndaAccessTokens)
      .where(eq(ndaAccessTokens.ndaSignatureId, signatureId));

    return {
      ...approvedSignature,
      accessToken: accessToken?.token || ''
    };
  }

  async approveNdaSignaturesBatch(signatureIds: number[], userId: number): Promise<(NdaSignature & { accessToken: string })[]> {
    const approvedSignatures = await db.update(ndaSignatures)
      .set({
        approved: true,
        approvedAt: new Date(),
        approvedBy: userId
      })
      .where(inArray(ndaSignatures.id, signatureIds))
      .returning();

    // Get access tokens for all signatures
    const tokensResult = await db
      .select()
      .from(ndaAccessTokens)
      .where(inArray(ndaAccessTokens.ndaSignatureId, signatureIds));

    // Create a map of signature ID to access token
    const tokenMap = new Map(tokensResult.map(t => [t.ndaSignatureId, t.token]));

    // Combine signatures with their access tokens
    return approvedSignatures.map(signature => ({
      ...signature,
      accessToken: tokenMap.get(signature.id) || ''
    }));
  }

  // NDA Access Tokens
  async createNdaAccessToken(token: string, cimDocumentId: number, ndaSignatureId: number, signerEmail: string, expiresAt?: Date): Promise<NdaAccessToken> {
    const [newToken] = await db.insert(ndaAccessTokens)
      .values({
        token,
        cimDocumentId,
        ndaSignatureId,
        signerEmail,
        expiresAt
      })
      .returning();
    return newToken;
  }

  async getNdaAccessToken(token: string): Promise<NdaAccessToken | undefined> {
    const [accessToken] = await db.select()
      .from(ndaAccessTokens)
      .where(and(
        eq(ndaAccessTokens.token, token),
        eq(ndaAccessTokens.isActive, true)
      ));
    return accessToken;
  }

  async updateTokenLastAccessed(token: string): Promise<void> {
    await db.update(ndaAccessTokens)
      .set({ lastAccessedAt: new Date() })
      .where(eq(ndaAccessTokens.token, token));
  }

  async deactivateToken(token: string): Promise<void> {
    await db.update(ndaAccessTokens)
      .set({ isActive: false })
      .where(eq(ndaAccessTokens.token, token));
  }

  // NDA Redirect Links
  async createNdaRedirectLink(redirectId: string, tokenId: number, cimDocumentId: number, signerEmail: string): Promise<NdaRedirectLink> {
    const [newRedirect] = await db.insert(ndaRedirectLinks)
      .values({
        redirectId,
        currentTokenId: tokenId,
        cimDocumentId,
        signerEmail
      })
      .returning();
    return newRedirect;
  }

  async getNdaRedirectLink(redirectId: string): Promise<NdaRedirectLink | undefined> {
    const [redirect] = await db.select()
      .from(ndaRedirectLinks)
      .where(and(
        eq(ndaRedirectLinks.redirectId, redirectId),
        eq(ndaRedirectLinks.isActive, true)
      ));
    return redirect;
  }

  async updateRedirectLinkToken(redirectId: string, newTokenId: number): Promise<void> {
    await db.update(ndaRedirectLinks)
      .set({ 
        currentTokenId: newTokenId,
        updatedAt: new Date()
      })
      .where(eq(ndaRedirectLinks.redirectId, redirectId));
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

  // Analysis Templates methods
  async createAnalysisTemplate(userId: number, template: InsertAnalysisTemplate): Promise<AnalysisTemplate> {
    const [newTemplate] = await db.insert(analysisTemplates)
      .values({
        ...template,
        userId
      })
      .returning();

    return newTemplate;
  }

  async getAnalysisTemplates(userId: number): Promise<AnalysisTemplate[]> {
    return await db.select()
      .from(analysisTemplates)
      .where(eq(analysisTemplates.userId, userId))
      .orderBy(desc(analysisTemplates.createdAt));
  }

  async updateAnalysisTemplate(id: number, template: Partial<AnalysisTemplate>): Promise<AnalysisTemplate> {
    const [updatedTemplate] = await db.update(analysisTemplates)
      .set({
        ...template,
        updatedAt: new Date()
      })
      .where(eq(analysisTemplates.id, id))
      .returning();

    if (!updatedTemplate) {
      throw new Error("Template not found");
    }

    return updatedTemplate;
  }

  async deleteAnalysisTemplate(id: number, userId: number): Promise<void> {
    await db.delete(analysisTemplates)
      .where(sql`${analysisTemplates.id} = ${id} AND ${analysisTemplates.userId} = ${userId}`);
  }
}

export const storage = new DatabaseStorage();
import { User, CimDocument, InsertUser, InsertCimDocument, subscriptionPlans, users, cimDocuments, uploadedFiles, customSections, ndaTemplates, ndaSignatures, ndaAccessTokens, ndaRedirectLinks, documentViews, documentDownloads, shareLinks, NdaTemplate, InsertNdaTemplate, NdaSignature, InsertNdaSignature, NdaAccessToken, InsertNdaAccessToken, NdaRedirectLink, InsertNdaRedirectLink, ShareLink, InsertShareLink, CustomSection, collaborators, Collaborator, InsertCollaborator, documentLocks, DocumentLock, documentActivityLog, DocumentActivityLog, customTags, analysisTemplates, AnalysisTemplate, InsertAnalysisTemplate, financialFiles, documentVersions, documentAnalytics, documentBaselines, DocumentBaseline, InsertDocumentBaseline, contentStyleTemplates, ContentStyleTemplate, InsertContentStyleTemplate, messageAttachments, MessageAttachment, InsertMessageAttachment, onboardingEmailSequences, userEmailQueue, OnboardingEmailSequence, UserEmailQueue, InsertUserEmailQueue, teasers, deals, supportTickets, userNotificationPreferences, UserNotificationPreferences } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, sql, desc, count, and, or, ilike, isNull } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { asc } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import { withRetry } from './db-utils';
import { sendFirstDocumentCongratulationsEmail } from './email';

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
      disableTouch: true, // Disable session touching for better performance
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
    
    // Set max listeners to handle 100+ concurrent users with buffer
    sessionStoreInstance.setMaxListeners(2000);
    
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
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByMicrosoftId(microsoftId: string): Promise<User | undefined>;
  getUserProfile(id: number): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin: boolean }): Promise<User>;
  createOAuthUser(data: { email: string; firstName?: string; lastName?: string; profilePhoto?: string; googleId?: string; microsoftId?: string; authProvider: string }): Promise<User>;
  linkOAuthProvider(userId: number, provider: 'google' | 'microsoft', providerId: string): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
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
    sectionDirections?: Array<{id: string; content: string}> | null;
    formattingProfile?: string | null;
  }): Promise<CimDocument>;
  createExampleCimDocument(userId: number): Promise<CimDocument>;
  createUploadedCimDocument(userId: number, data: {
    title: string;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
    ndaSettings?: {
      ndaProtected: boolean;
      ndaTemplateId: number | null;
      ndaApprovalRequired: boolean;
    } | null;
    dealId?: number | null;
  }): Promise<CimDocument>;
  createUploadedFile(data: {
    cimDocumentId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }): Promise<any>;
  getUploadedFiles(cimDocumentId: number): Promise<any[]>;
  getCimDocuments(userId: number, options?: { page?: number; limit?: number; search?: string; filters?: string[]; dealId?: number }): Promise<{ documents: CimDocument[]; total: number; hasMore: boolean }>;
  getAllUsers(options?: { limit?: number; offset?: number }): Promise<User[]>;
  getAllCimDocuments(options?: { limit?: number; offset?: number }): Promise<CimDocument[]>;
  getUsersCount(): Promise<number>;
  getCimDocumentsCount(): Promise<number>;
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
    customSubdomain?: string | null;
    brandColors?: string[] | null;
    brandedPdfTemplate?: string;
  }): Promise<User>;
  getUserBySubdomain(subdomain: string): Promise<User | undefined>;
  updateUserEmail(userId: number, email: string): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateCimImages(cimId: number, imagePaths: string[]): Promise<void>;
  createPasswordResetToken(email: string, token: string, expiry: Date): Promise<boolean>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  verifyPasswordResetToken(token: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: number): Promise<void>;
  // Sharing functionality
  updateCimShareSettings(id: number, settings: {
    shareEnabled: boolean;
    shareSlug?: string;
    sharePassword?: string | null;
    shareExpiresAt?: Date | null;
    ndaProtected?: boolean;
    ndaTemplateId?: number | null;
    ndaApprovalRequired?: boolean;
    copyMeOnEmails?: boolean;
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
  // NDA Rejection
  rejectNdaSignature(signatureId: number, userId: number): Promise<NdaSignature>;
  rejectNdaSignaturesBatch(signatureIds: number[], userId: number): Promise<NdaSignature[]>;
  // NDA Stage Management
  updateNdaSignatureStage(signatureId: number, stage: string | null): Promise<NdaSignature>;
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
  getCollaboratorByToken(token: string): Promise<Collaborator | null>;
  getCollaboratorCount(documentId: number): Promise<number>;
  getUserCollaboration(documentId: number, userId: number): Promise<Collaborator | null>;
  getPendingInvitationsByEmail(email: string): Promise<Collaborator[]>;
  updateCollaborator(id: number, updates: Partial<Collaborator>): Promise<void>;
  deleteCollaborator(id: number): Promise<void>;
  // Document Locks
  getLock(documentId: number): Promise<any | null>;
  createLock(documentId: number, userId: number, userName: string, userEmail: string, takenOverFrom?: number): Promise<any>;
  updateLockActivity(documentId: number): Promise<void>;
  releaseLock(documentId: number): Promise<void>;
  releaseUserLocks(userId: number, documentId: number): Promise<void>;
  cleanupStaleLocks(minutesOld: number): Promise<number>;
  // Activity Log
  logActivity(documentId: number, userId: number | null, userName: string | null, userEmail: string | null, action: string, metadata?: any): Promise<void>;
  getActivityLog(documentId: number, options?: { limit?: number; offset?: number }): Promise<any[]>;
  // Custom Tags
  createCustomTag(userId: number, name: string, color: string): Promise<any>;
  getCustomTags(userId: number): Promise<any[]>;
  deleteCustomTag(id: number, userId: number): Promise<void>;
  // Analysis Templates
  createAnalysisTemplate(userId: number, template: any): Promise<any>;
  getAnalysisTemplates(userId: number): Promise<any[]>;
  updateAnalysisTemplate(id: number, template: any): Promise<any>;
  deleteAnalysisTemplate(id: number, userId: number): Promise<void>;
  // Content & Style Template methods
  getContentStyleTemplates(userId: number): Promise<ContentStyleTemplate[]>;
  getContentStyleTemplate(id: number, userId: number): Promise<ContentStyleTemplate | undefined>;
  createContentStyleTemplate(userId: number, template: InsertContentStyleTemplate): Promise<ContentStyleTemplate>;
  updateContentStyleTemplate(id: number, userId: number, template: Partial<ContentStyleTemplate>): Promise<ContentStyleTemplate>;
  deleteContentStyleTemplate(id: number, userId: number): Promise<void>;
  setDefaultContentStyleTemplate(id: number, userId: number): Promise<void>;
  getUserDefaultContentStyleTemplate(userId: number): Promise<ContentStyleTemplate | undefined>;
  // Message attachments
  createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment>;
  getMessageAttachments(messageId: number): Promise<MessageAttachment[]>;
  getMessageAttachment(attachmentId: number): Promise<MessageAttachment | undefined>;
  // Email management
  scheduleWelcomeEmail(userId: number): Promise<void>;
  getOnboardingSequences(): Promise<any[]>;
  getActiveOnboardingSequences(): Promise<any[]>;
  getPendingEmails(): Promise<any[]>;
  markEmailAsSent(queueId: number): Promise<void>;
  markEmailAsFailed(queueId: number, errorMessage: string): Promise<void>;
  // Support tickets
  createSupportTicket(ticket: { userId: number; organizationId?: number | null; type: string; subject: string; description: string; attachments?: any[]; browserInfo?: string; pageUrl?: string }): Promise<any>;
  // Notification preferences
  getNotificationPreferences(userId: number): Promise<UserNotificationPreferences | null>;
  upsertNotificationPreferences(userId: number, preferences: Partial<UserNotificationPreferences>): Promise<UserNotificationPreferences>;
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

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
      return user;
    } catch (error) {
      console.error('Error in getUserByGoogleId:', error);
      throw error;
    }
  }

  async getUserByMicrosoftId(microsoftId: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.microsoftId, microsoftId)).limit(1);
      return user;
    } catch (error) {
      console.error('Error in getUserByMicrosoftId:', error);
      throw error;
    }
  }

  async createOAuthUser(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    profilePhoto?: string;
    googleId?: string;
    microsoftId?: string;
    authProvider: string
  }): Promise<User> {
    // Generate a random secure password for OAuth users (they won't use it)
    const randomPassword = require('crypto').randomBytes(32).toString('hex');
    const hashedPassword = await require('./auth').hashPassword(randomPassword);

    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        profilePhoto: data.profilePhoto || null,
        googleId: data.googleId || null,
        microsoftId: data.microsoftId || null,
        authProvider: data.authProvider,
        isAdmin: false,
        subscriptionStatus: "free",
        emailVerified: true, // OAuth users are pre-verified
      })
      .returning();

    return user;
  }

  async linkOAuthProvider(userId: number, provider: 'google' | 'microsoft', providerId: string): Promise<User> {
    const updateData: Partial<User> = {};
    if (provider === 'google') {
      updateData.googleId = providerId;
    } else if (provider === 'microsoft') {
      updateData.microsoftId = providerId;
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    return user;
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
        name: insertUser.name || null,
        businessName: insertUser.businessName || null,
        phoneNumber: insertUser.phoneNumber || null,
        businessLogo: insertUser.businessLogo || null,
        profilePhoto: insertUser.profilePhoto || null,
        isAdmin: insertUser.isAdmin,
        // If user is admin, set subscription status to "admin" to grant unlimited privileges
        subscriptionStatus: insertUser.isAdmin ? "admin" : "free",
      })
      .returning();
    
    // Default NDA template creation is handled in auth.ts using populateDefaultNDAForUser
    // to ensure consistent "CIM Share NDA" naming
    // await this.createDefaultNdaTemplate(user.id);
    
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateSubscription(userId: number, status: string, endsAt: Date, subscriptionId?: string): Promise<void> {
    console.log('📝 Updating subscription for user:', { userId, status, endsAt, subscriptionId });
    const result = await db
      .update(users)
      .set({
        subscriptionStatus: status,
        subscriptionEndsAt: endsAt,
        subscriptionId: subscriptionId || null,
      })
      .where(eq(users.id, userId))
      .returning();
    console.log('✅ Subscription updated:', result[0]?.subscriptionStatus);
  }

  async updateUserUsage(userId: number): Promise<void> {
    // Legacy method - kept for backward compatibility
    await this.updateDocumentCreationUsage(userId);
  }

  async updateDocumentCreationUsage(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    // For annual plans, check if subscription has expired
    const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];
    if (plan && plan.billing === 'annual' && user.subscriptionEndsAt) {
      const now = new Date();
      if (now > user.subscriptionEndsAt) {
        await this.resetAnnualUsage(userId);
        return;
      }
    } else {
      // Reset usage if it's a new month (for legacy monthly plans)
      const now = new Date();
      const lastReset = new Date(user.lastUsageReset);
      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        await this.resetMonthlyUsage(userId);
        return;
      }
    }

    await db
      .update(users)
      .set({
        monthlyUsage: user.monthlyUsage + 1,
        annualDocumentsCreated: user.annualDocumentsCreated + 1,
        // Keep old field for backward compatibility
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
        annualRegenerationsUsed: user.annualRegenerationsUsed + 1,
        // Keep old field for backward compatibility
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

  async resetAnnualUsage(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        annualDocumentsCreated: 0,
        annualRegenerationsUsed: 0,
        // Also reset monthly for backward compatibility
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

    const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];

    // For annual and monthly plans (both have yearly limits), check subscription expiry
    if (plan && (plan.billing === 'annual' || plan.billing === 'monthly')) {
      // If subscription has expired, deny access
      if (user.subscriptionEndsAt && new Date() > user.subscriptionEndsAt) {
        return false;
      }
      // Use annual counter for both annual and monthly plans (both have yearly limits)
      return user.annualDocumentsCreated < plan.limit;
    } else {
      // Legacy free trial monthly logic
      const now = new Date();
      const lastReset = new Date(user.lastUsageReset);
      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        await this.resetMonthlyUsage(userId);
        // Re-fetch user to get updated counters
        const updatedUser = await this.getUser(userId);
        if (!updatedUser) throw new Error("User not found after reset");
        return updatedUser.monthlyDocumentsCreated < plan.limit;
      }
      return user.monthlyDocumentsCreated < plan.limit;
    }
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
      const user = await this.getUser(userId);
      const plan = subscriptionPlans[user!.subscriptionStatus as keyof typeof subscriptionPlans];
      const limitType = plan && plan.billing === 'annual' ? 'Annual' : 'Monthly';
      throw new Error(`${limitType} CIM generation limit reached`);
    }

    // Check if this is the user's first document (before creating the new one)
    const [existingDocsCount] = await db
      .select({ count: count() })
      .from(cimDocuments)
      .where(eq(cimDocuments.userId, userId));
    const isFirstDocument = existingDocsCount.count === 0;

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
      ndaApprovalRequired: doc.ndaApprovalRequired || false,
      // New fields for section directions and formatting
      sectionDirections: doc.sectionDirections || null,
      formattingProfile: doc.formattingProfile || null,
      // Deal association
      dealId: doc.dealId || null,
      // Generation status tracking
      generationStatus: doc.generationStatus || 'ready',
      generationStartedAt: doc.generationStartedAt || null,
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

    // Send congratulations email for first document (async, don't wait)
    if (isFirstDocument) {
      this.getUser(userId).then(user => {
        if (user && user.email) {
          const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';
          sendFirstDocumentCongratulationsEmail({
            userEmail: user.email,
            userName,
            documentTitle: cimDoc.title || 'Your CIM',
            documentId: cimDoc.id,
          }).then(success => {
            if (success) {
              console.log(`✅ Sent first document congratulations email to ${user.email}`);
            }
          }).catch(err => {
            console.error('Failed to send first document email:', err);
          });
        }
      }).catch(err => {
        console.error('Failed to fetch user for first document email:', err);
      });
    }

    return cimDoc;
  }

  async createExampleCimDocument(userId: number): Promise<CimDocument> {
    console.log(`Creating example CIM document with assets for user ${userId}`);
    
    // Create and upload example assets first
    const { exampleAssetsCreator } = await import('./example-assets-creator');
    const exampleAssets = await exampleAssetsCreator.createAndUploadExampleAssets();

    // Use real business content from attached assets if available
    const businessContent = exampleAssets.businessContent;
    
    const exampleData = {
      title: businessContent?.title || "Tony's Transmissions",
      transcript: businessContent?.sections ? 
        // Extract just the text content from sections for transcript
        businessContent.sections.map((section: any) => `${section.title}\n${section.content.replace(/<[^>]*>/g, '')}`).join('\n\n') :
        `Tony's Transmission Repair has established itself as a premier provider of specialized transmission repair services over the past twenty-three years. The business is recognized for its exceptional reputation, as evidenced by consistently high customer reviews across multiple platforms. Its core value proposition lies in delivering unique and technically advanced transmission repair solutions, which has enabled the company to build enduring relationships with a network of auto body shops throughout Florida and Georgia.

The companys operational model is further strengthened by a loyal base of direct consumer clients who seek out its expertise without the impetus of paid or online marketing. This organic demand underscores the businesss strong market position and the trust it has cultivated within the automotive repair sector. The owners decision to transition is driven by the growth of a new venture, presenting an opportunity for new ownership to capitalize on a well-established, profitable enterprise with a proven track record.

The business operates with twelve employees, including four key personnel who are integral to ongoing success. The two senior repair technicians bring deep technical knowledge and hands-on experience. The accountant manages financial operations, compliance, and reporting, while the general manager oversees daily workflow, customer relations, and staff coordination.

Current annual revenues are $5,500,000 with EBITDA of $1,600,000. Over the past five years, both revenue and EBITDA have shown steady growth, reflecting the companys ability to capture market share and maintain operational efficiency.`,
      directions: "Create a professional CIM document highlighting the business strengths, market position, and growth opportunities for this established automotive transmission repair business.",
      regenerationCount: 0,
      analysis: businessContent || {
        "Business Summary": "Tony's Transmission Repair has established itself as a premier provider of specialized transmission repair services over the past twenty-three years. The business is recognized for its exceptional reputation, as evidenced by consistently high customer reviews across multiple platforms. Its core value proposition lies in delivering unique and technically advanced transmission repair solutions, which has enabled the company to build enduring relationships with a network of auto body shops throughout Florida and Georgia. The companys operational model is further strengthened by a loyal base of direct consumer clients who seek out its expertise without the impetus of paid or online marketing. This organic demand underscores the businesss strong market position and the trust it has cultivated within the automotive repair sector. The owners decision to transition is driven by the growth of a new venture, presenting an opportunity for new ownership to capitalize on a well-established, profitable enterprise with a proven track record.",
        "Market Opportunity": "The automotive transmission repair market in the southeastern United States is characterized by robust demand, driven by high vehicle ownership rates and the technical complexity of modern transmissions. Tony's Transmission Repair is strategically positioned within this landscape, serving both commercial clientsprimarily auto body shopsand individual vehicle owners. The companys geographic reach across Florida and Georgia provides access to a large and diverse customer base, while its specialization in unique transmission solutions differentiates it from general automotive repair competitors. Industry trends indicate a steady increase in the need for specialized transmission services, as advancements in vehicle technology require higher levels of expertise and diagnostic capability. The absence of significant paid marketing efforts suggests that the business has untapped potential for growth through digital outreach, partnerships, and expanded service offerings. The competitive landscape is fragmented, with many smaller operators lacking the technical depth and established relationships that Tony's Transmission Repair enjoys, positioning the company as a leader in its niche.",
        "Business Model": "Tony's Transmission Repair generates revenue primarily through the provision of specialized transmission repair and rebuild services. The business model is anchored by long-term relationships with regional auto body shops, which provide a steady stream of referral work, as well as direct consumer engagements that supplement commercial volume. Revenue streams are diversified across diagnostic services, full transmission rebuilds, and unique repair solutions tailored to complex or uncommon vehicle issues. The companys pricing strategy reflects its technical expertise and the value delivered to clients, enabling it to maintain healthy margins. Key success factors include the retention of highly skilled technicians, the ability to solve challenging transmission problems, and a reputation for reliability and quality. The businesss consistent financial performance, with five years of revenue and EBITDA growth, demonstrates the effectiveness of its model and the resilience of its customer relationships.",
        "Operations": "Operational excellence is a hallmark of Tony's Transmission Repair, supported by a stable team of twelve employees, including four key personnel who are integral to the companys ongoing success. The two senior repair technicians bring deep technical knowledge and hands-on experience, ensuring that even the most complex transmission issues are addressed efficiently and effectively. The accountant manages financial operations, compliance, and reporting, while the general manager oversees daily workflow, customer relations, and staff coordination. The companys operational processes are streamlined to maximize throughput and maintain high quality standards, with established protocols for diagnostics, parts sourcing, and repair execution. Supplier relationships are well-managed, ensuring timely access to quality components and materials. The businesss ability to attract and retain skilled staff, combined with its process-driven approach, underpins its reputation for reliability and customer satisfaction.",
        "Financial Overview": "Tony's Transmission Repair has demonstrated strong and consistent financial performance, with current annual revenues of $5,500,000 and EBITDA of $1,600,000. Over the past five years, both revenue and EBITDA have shown steady growth, reflecting the companys ability to capture market share and maintain operational efficiency. The business operates with healthy margins, attributable to its specialized service offerings and efficient cost management. The asking price for the business is $5,000,000, which represents a compelling opportunity for investors seeking a profitable, established enterprise with a proven track record. Key financial metrics indicate robust cash flow, low customer concentration risk due to a diversified client base, and significant potential for further value creation through operational enhancements and market expansion.",
        "Growth Opportunities": "There are multiple avenues for growth and value creation available to new ownership. The business has achieved its current scale without any paid or online marketing, suggesting that a targeted digital marketing strategy could significantly increase brand awareness and customer acquisition. Expansion of service offerings, such as fleet maintenance contracts or mobile repair units, could further diversify revenue streams and enhance customer loyalty. Geographic expansion into adjacent markets within the southeastern United States is also feasible, leveraging the companys established reputation and operational expertise. Strategic partnerships with additional auto body shops and dealerships could deepen referral networks and drive incremental volume. Investment in advanced diagnostic equipment and technician training would ensure continued leadership in addressing the evolving complexity of modern transmissions. These growth initiatives, combined with the businesss strong foundation, position Tony's Transmission Repair as an attractive platform for scalable expansion.",
        "Management & Team": "The management team at Tony's Transmission Repair is composed of four key employees whose expertise and leadership are critical to the companys ongoing operations. The two senior repair technicians possess extensive experience in diagnosing and resolving complex transmission issues, ensuring that the business maintains its reputation for technical excellence. The accountant provides robust financial oversight, managing all aspects of accounting, compliance, and reporting to support informed decision-making. The general manager is responsible for coordinating daily operations, managing staff, and maintaining high standards of customer service. The remaining eight employees contribute across various operational roles, supporting the companys service delivery and customer engagement. The organizational structure is designed to promote accountability, efficiency, and knowledge transfer, ensuring continuity and stability through the ownership transition. The commitment of the existing team to remain with the business provides a strong foundation for future growth and operational success."
      },
      websiteUrl: "https://tonystransmissions.com",
      // Use the actual uploaded asset URLs
      selectedImages: exampleAssets.businessImages,
      logoUrl: exampleAssets.logoUrl,
      financialsEnabled: true,
      askingPrice: "$5,000,000",
      askingPriceIncluded: true,
      revenue: "$5,500,000", 
      revenueIncluded: true,
      ebitda: "$1,500,000",
      ebitdaIncluded: true,
      coverImageUrl: exampleAssets.coverImageUrl,
      coverImagePosition: "center",
      coverImageAttribution: "Demo business for CIM Share platform",
      shareEnabled: true,
      shareSlug: `example-tonys-transmissions-${Math.random().toString(36).substring(2, 8)}`,
      sharePassword: null,
      shareExpiresAt: null,
      ndaProtected: false,
      ndaTemplateId: null,
      isExample: true
    };

    const insertData = {
      userId,
      title: exampleData.title,
      transcript: exampleData.transcript,
      directions: exampleData.directions,
      regenerationCount: exampleData.regenerationCount,
      analysis: exampleData.analysis,
      logoUrl: exampleData.logoUrl,
      websiteUrl: exampleData.websiteUrl,
      websiteScreenshotUrl: null,
      selectedImages: exampleData.selectedImages,
      financialsEnabled: exampleData.financialsEnabled,
      askingPrice: exampleData.askingPrice,
      askingPriceIncluded: exampleData.askingPriceIncluded,
      revenue: exampleData.revenue,
      revenueIncluded: exampleData.revenueIncluded,
      ebitda: exampleData.ebitda,
      ebitdaIncluded: exampleData.ebitdaIncluded,
      coverImageUrl: exampleData.coverImageUrl,
      coverImagePosition: exampleData.coverImagePosition,
      coverImageAttribution: exampleData.coverImageAttribution,
      shareEnabled: exampleData.shareEnabled,
      shareSlug: exampleData.shareSlug,
      sharePassword: exampleData.sharePassword,
      shareExpiresAt: exampleData.shareExpiresAt,
      ndaProtected: exampleData.ndaProtected,
      ndaTemplateId: exampleData.ndaTemplateId,
      isExample: exampleData.isExample
    };

    const [cimDoc] = await db
      .insert(cimDocuments)
      .values(insertData)
      .returning();

    // Insert financial file records into the database
    if (exampleAssets.financialDocuments.length > 0) {
      console.log(`Inserting ${exampleAssets.financialDocuments.length} financial file records for CIM document ${cimDoc.id}`);
      
      for (const finDoc of exampleAssets.financialDocuments) {
        // Get actual file size by checking the object storage or use default
        let fileSize = 0;
        try {
          // For real files, we'll estimate based on file type
          if (finDoc.name.includes('.xls') || finDoc.name.includes('.xlsx')) {
            fileSize = 50000; // Estimate for Excel files
          } else if (finDoc.name.includes('.doc')) {
            fileSize = 30000; // Estimate for Word docs
          } else {
            fileSize = 10000; // Default fallback
          }
        } catch (error) {
          console.error('Error calculating file size for', finDoc.name, error);
          fileSize = 10000; // Default fallback
        }
        
        // Extract storage path from the URL (remove /api/object-storage/ prefix)
        const filePath = finDoc.url.replace('/api/object-storage/', '');
        
        await db.insert(financialFiles).values({
          cimDocumentId: cimDoc.id,
          filename: finDoc.name,
          filePath: filePath,
          fileSize: fileSize
        });
      }
      
      console.log(`✅ Inserted ${exampleAssets.financialDocuments.length} financial file records`);
    }

    console.log(`✅ Created example CIM document for user ${userId}: ${cimDoc.id} with ${exampleAssets.businessImages.length} business images and logo`);
    return cimDoc;
  }

  async createUploadedCimDocument(userId: number, data: {
    title: string;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
    ndaSettings?: {
      ndaProtected: boolean;
      ndaTemplateId: number | null;
      ndaApprovalRequired: boolean;
    } | null;
    dealId?: number | null;
  }): Promise<CimDocument> {
    // Check if user is within their limit
    const canCreate = await this.checkUserLimit(userId);
    if (!canCreate) {
      const user = await this.getUser(userId);
      const plan = subscriptionPlans[user!.subscriptionStatus as keyof typeof subscriptionPlans];
      const limitType = plan && plan.billing === 'annual' ? 'Annual' : 'Monthly';
      throw new Error(`${limitType} CIM generation limit reached`);
    }

    // Generate automatic share link for uploaded document
    const randomId = Math.random().toString(36).substring(2, 8);
    const shareSlug = `cim-${randomId}`;

    console.log("=== STORAGE createUploadedCimDocument ===");
    console.log("dealId received:", data.dealId, "type:", typeof data.dealId);

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
        // NDA settings from request or defaults
        ndaProtected: data.ndaSettings?.ndaProtected ?? false,
        ndaTemplateId: data.ndaSettings?.ndaTemplateId ?? null,
        ndaApprovalRequired: data.ndaSettings?.ndaApprovalRequired ?? false,
        // Deal association
        dealId: data.dealId ?? null,
      })
      .returning();

    console.log("Created uploaded CIM document with dealId:", cimDoc.dealId);

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

  async getCimDocuments(userId: number, options?: { page?: number; limit?: number; search?: string; filters?: string[]; dealId?: number }): Promise<{ documents: CimDocument[]; total: number; hasMore: boolean }> {
    const page = options?.page || 1;
    const limit = options?.limit || 12;
    const offset = (page - 1) * limit;
    const search = options?.search?.trim();
    const filters = options?.filters || [];
    const dealId = options?.dealId;

    // Build base query that includes:
    // 1. Documents owned by the user
    // 2. Documents where the user is an active collaborator
    const baseCondition = and(
      or(
        eq(cimDocuments.userId, userId), // Owned documents
        and(
          eq(collaborators.userId, userId), // Shared documents where user is collaborator
          eq(collaborators.status, 'active')
        )
      ),
      isNull(cimDocuments.deletedAt)
    );

    // Build filter conditions
    const filterConditions = [];

    // NDA Protected filter
    if (filters.includes('nda-protected')) {
      filterConditions.push(eq(cimDocuments.ndaProtected, true));
    }

    // Created This Week filter
    if (filters.includes('created-this-week')) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      filterConditions.push(sql`${cimDocuments.createdAt} >= ${oneWeekAgo}`);
    }

    // Has Views filter
    if (filters.includes('has-views')) {
      filterConditions.push(sql`${cimDocuments.shareViewCount} > 0`);
    }

    // Orphan (no deal) filter
    if (filters.includes('orphan')) {
      filterConditions.push(isNull(cimDocuments.dealId));
    }

    // Filter by specific deal ID
    if (dealId) {
      filterConditions.push(eq(cimDocuments.dealId, dealId));
    }

    // Has Published Teaser filter - uses subquery to check for published teaser
    if (filters.includes('has-published-teaser')) {
      filterConditions.push(
        sql`EXISTS (SELECT 1 FROM ${teasers} WHERE ${teasers.documentId} = ${cimDocuments.id} AND ${teasers.isPublished} = true)`
      );
    }

    // Combine base condition with filters
    const conditionsToApply = [baseCondition, ...filterConditions];

    const whereCondition = search
      ? and(
          ...conditionsToApply,
          or(
            ilike(cimDocuments.title, `%${search}%`),
            ilike(cimDocuments.directions, `%${search}%`)
          )
        )
      : (conditionsToApply.length > 1 ? and(...conditionsToApply) : conditionsToApply[0]);

    // For dashboard, only select essential fields to minimize data transfer
    // Include signature count via LEFT JOIN with ndaSignatures table
    // Include collaborator info to determine if this is a shared document
    // Include deal info via LEFT JOIN with deals table
    let query = db
      .select({
        id: cimDocuments.id,
        userId: cimDocuments.userId,
        title: cimDocuments.title,
        createdAt: cimDocuments.createdAt,
        shareEnabled: cimDocuments.shareEnabled,
        shareSlug: cimDocuments.shareSlug,
        isUploadedFile: cimDocuments.isUploadedFile,
        uploadedFileName: cimDocuments.uploadedFileName,
        regenerationCount: cimDocuments.regenerationCount,
        ndaProtected: cimDocuments.ndaProtected,
        shareViewCount: cimDocuments.shareViewCount,
        logoUrl: cimDocuments.logoUrl,
        isExample: cimDocuments.isExample,
        sectionDirections: cimDocuments.sectionDirections,
        formattingProfile: cimDocuments.formattingProfile,
        ndaSignatureCount: sql<number>`COALESCE(COUNT(DISTINCT ${ndaSignatures.id}), 0)`,
        ndaApprovalRequired: cimDocuments.ndaApprovalRequired,
        pendingNdaCount: sql<number>`COALESCE(SUM(CASE WHEN ${cimDocuments.ndaApprovalRequired} = true AND ${ndaSignatures.id} IS NOT NULL AND ${ndaSignatures.approved} = false THEN 1 ELSE 0 END), 0)`,
        // Add field to indicate if this is a shared document
        isSharedWithUser: sql<boolean>`CASE WHEN ${cimDocuments.userId} != ${userId} THEN true ELSE false END`,
        collaboratorPermission: sql<string>`MAX(CASE WHEN ${collaborators.userId} = ${userId} THEN ${collaborators.permission} ELSE NULL END)`,
        // Deal info
        dealId: cimDocuments.dealId,
        dealName: deals.name,
        // Generation status for background CIM generation
        generationStatus: cimDocuments.generationStatus
      })
      .from(cimDocuments)
      .leftJoin(collaborators, eq(cimDocuments.id, collaborators.cimDocumentId))
      .leftJoin(ndaSignatures, eq(cimDocuments.id, ndaSignatures.cimDocumentId))
      .leftJoin(deals, eq(cimDocuments.dealId, deals.id))
      .where(whereCondition)
      .groupBy(
        cimDocuments.id,
        cimDocuments.userId,
        cimDocuments.title,
        cimDocuments.createdAt,
        cimDocuments.shareEnabled,
        cimDocuments.shareSlug,
        cimDocuments.isUploadedFile,
        cimDocuments.uploadedFileName,
        cimDocuments.regenerationCount,
        cimDocuments.ndaProtected,
        cimDocuments.shareViewCount,
        cimDocuments.logoUrl,
        cimDocuments.isExample,
        cimDocuments.sectionDirections,
        cimDocuments.formattingProfile,
        cimDocuments.ndaApprovalRequired,
        cimDocuments.dealId,
        deals.name,
        cimDocuments.generationStatus
      );

    // Add HAVING clause for 'has-signatures' filter
    if (filters.includes('has-signatures')) {
      query = query.having(sql`COUNT(DISTINCT ${ndaSignatures.id}) > 0`);
    }

    const results = await query
      .orderBy(desc(cimDocuments.createdAt))
      .limit(limit + 1) // Get one extra to check for more
      .offset(offset);

    const hasMore = results.length > limit;
    const documents = results.slice(0, limit).map(result => ({
      ...result,
      // Add missing required fields with minimal defaults for dashboard display
      version: 1,
      transcript: '',
      directions: '',
      analysis: {},
      websiteUrl: null,
      selectedImages: null,
      sharePassword: null,
      shareExpiresAt: null,
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
      ndaSignatureCount: result.ndaSignatureCount,
      // Add missing required properties
      logoUrlBackup: null,
      selectedImagesBackup: null,
      customSlug: null,
      ndaApprovalRequired: result.ndaApprovalRequired || false,
      editStartedAt: null,
      lastActivityAt: null,
      searchVector: null,
      coverImageBackup: null,
      isExample: result.isExample,
      // Add new fields with defaults
      sectionDirections: result.sectionDirections || null,
      formattingProfile: result.formattingProfile || null,
      pendingNdaCount: result.pendingNdaCount || 0,
      // Add collaboration info
      isSharedWithUser: result.isSharedWithUser || false,
      collaboratorPermission: result.collaboratorPermission || null,
      // Add deal info
      dealId: result.dealId || null,
      dealName: result.dealName || null,
      // Add missing fields
      copyMeOnEmails: false,
      deletedAt: null
    }));

    // For dashboard, we don't need exact total count - just use estimated
    const total = hasMore ? offset + limit + 1 : offset + documents.length;

    return {
      documents,
      total,
      hasMore
    };
  }

  async getAllUsers(options: { limit?: number; offset?: number } = {}): Promise<User[]> {
    const { limit = 100, offset = 0 } = options;
    return db.select().from(users).limit(limit).offset(offset);
  }

  async getAllCimDocuments(options: { limit?: number; offset?: number } = {}): Promise<CimDocument[]> {
    const { limit = 100, offset = 0 } = options;
    return db.select().from(cimDocuments).limit(limit).offset(offset);
  }

  async getUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0]?.count ?? 0);
  }

  async getCimDocumentsCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(cimDocuments);
    return Number(result[0]?.count ?? 0);
  }

  async getCimDocument(id: number): Promise<CimDocument | undefined> {
    return await withRetry(async () => {
      const [doc] = await db.select().from(cimDocuments)
        .where(and(
          eq(cimDocuments.id, id),
          isNull(cimDocuments.deletedAt)
        ));
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
    // Check if document exists and isn't already deleted
    const [doc] = await db.select().from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, id),
        isNull(cimDocuments.deletedAt)
      ));
    if (!doc) {
      throw new Error("Document not found or already deleted");
    }

    console.log(`🗑️ Soft deleting CIM document ${id} for user ${doc.userId} (document preserved for subscription limit tracking)`);

    // Note: We intentionally do NOT decrement monthlyDocumentsCreated to prevent
    // subscription bypass attacks where users delete and recreate documents to exceed limits

    // SOFT DELETE: Mark document as deleted instead of removing it
    await db.update(cimDocuments)
      .set({
        deletedAt: new Date(),
        // Disable all sharing when deleted
        shareEnabled: false,
        sharePassword: null,
        shareExpiresAt: null
      })
      .where(eq(cimDocuments.id, id));

    // Deactivate all NDA access tokens for this document
    await db.update(ndaAccessTokens)
      .set({
        isActive: false,
        deactivatedAt: new Date()
      })
      .where(eq(ndaAccessTokens.cimDocumentId, id));

    // Deactivate all share links
    await db.execute(sql`
      UPDATE share_links
      SET expires_at = NOW()
      WHERE cim_document_id = ${id}
      AND (expires_at IS NULL OR expires_at > NOW())
    `);

    // Note: We keep all related records (signatures, files, etc.) for audit trail
    // They won't be accessible since the document is marked as deleted
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
    customSubdomain?: string | null;
    brandColors?: string[] | null;
    brandedPdfTemplate?: string;
  }): Promise<User> {
    const [user] = await db.update(users)
      .set(profile)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserBySubdomain(subdomain: string): Promise<User | undefined> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.customSubdomain, subdomain));
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

  async verifyPasswordResetToken(token: string): Promise<User | undefined> {
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
      const templateBuffer = await fs.promises.readFile(defaultTemplatePath);
      
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
    ndaApprovalRequired?: boolean;
    copyMeOnEmails?: boolean;
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
        ndaApprovalRequired: settings.ndaApprovalRequired,
        copyMeOnEmails: settings.copyMeOnEmails,
      })
      .where(eq(cimDocuments.id, id))
      .returning();
    return doc;
  }

  async getCimByShareSlug(slug: string): Promise<CimDocument | undefined> {
    // PERFORMANCE OPTIMIZATION: Direct database query with connection pooling optimization
    try {
      const [doc] = await db.select()
        .from(cimDocuments)
        .where(or(eq(cimDocuments.shareSlug, slug), eq(cimDocuments.customSlug, slug)))
        .limit(1);
      return doc || undefined;
    } catch (error) {
      console.error('Error in getCimByShareSlug:', error);
      throw error;
    }
  }

  async getCimByShareSlugOptimized(slug: string): Promise<CimDocument | undefined> {
    // PERFORMANCE OPTIMIZATION: Direct query without retry wrapper to prevent timeout loops
    try {
      const [doc] = await db.select({
        id: cimDocuments.id,
        userId: cimDocuments.userId,
        title: cimDocuments.title,
        transcript: cimDocuments.transcript,
        directions: cimDocuments.directions,
        regenerationCount: cimDocuments.regenerationCount,
        analysis: cimDocuments.analysis,
        isUploadedFile: cimDocuments.isUploadedFile,
        uploadedFileName: cimDocuments.uploadedFileName,
        uploadedFilePath: cimDocuments.uploadedFilePath,
        uploadedFileSize: cimDocuments.uploadedFileSize,
        uploadedFileMimeType: cimDocuments.uploadedFileMimeType,
        editedContent: cimDocuments.editedContent,
        logoUrl: cimDocuments.logoUrl,
        websiteUrl: cimDocuments.websiteUrl,
        websiteScreenshotUrl: cimDocuments.websiteScreenshotUrl,
        selectedImages: cimDocuments.selectedImages,
        logoUrlBackup: cimDocuments.logoUrlBackup,
        selectedImagesBackup: cimDocuments.selectedImagesBackup,
        createdAt: cimDocuments.createdAt,
        shareEnabled: cimDocuments.shareEnabled,
        shareSlug: cimDocuments.shareSlug,
        customSlug: cimDocuments.customSlug,
        sharePassword: cimDocuments.sharePassword,
        shareExpiresAt: cimDocuments.shareExpiresAt,
        shareViewCount: cimDocuments.shareViewCount,
        shareLastViewed: cimDocuments.shareLastViewed,
        ndaProtected: cimDocuments.ndaProtected,
        ndaTemplateId: cimDocuments.ndaTemplateId,
        ndaApprovalRequired: cimDocuments.ndaApprovalRequired,
        financialsEnabled: cimDocuments.financialsEnabled,
        askingPrice: cimDocuments.askingPrice,
        askingPriceIncluded: cimDocuments.askingPriceIncluded,
        revenue: cimDocuments.revenue,
        revenueIncluded: cimDocuments.revenueIncluded,
        ebitda: cimDocuments.ebitda,
        ebitdaIncluded: cimDocuments.ebitdaIncluded,
        coverImageUrl: cimDocuments.coverImageUrl,
        coverImagePosition: cimDocuments.coverImagePosition,
        coverImageAttribution: cimDocuments.coverImageAttribution,
        currentEditorId: cimDocuments.currentEditorId,
        currentEditorName: cimDocuments.currentEditorName,
        editStartedAt: cimDocuments.editStartedAt,
        lastActivityAt: cimDocuments.lastActivityAt,
        lastModifiedBy: cimDocuments.lastModifiedBy,
        searchVector: cimDocuments.searchVector,
        version: cimDocuments.version,
        coverImageBackup: cimDocuments.coverImageBackup,
        isExample: cimDocuments.isExample,
        sectionDirections: cimDocuments.sectionDirections,
        formattingProfile: cimDocuments.formattingProfile,
        displaySettings: cimDocuments.displaySettings
      })
        .from(cimDocuments)
        .where(or(eq(cimDocuments.shareSlug, slug), eq(cimDocuments.customSlug, slug)))
        .limit(1);
      return doc || undefined;
    } catch (error) {
      console.error('Error in getCimByShareSlugOptimized:', error);
      throw error; // Let caller handle fallback
    }
  }

  async getUserProfileOptimized(userId: number): Promise<{
    name: string | null;
    email: string;
    title: string | null;
    phone: string | null;
    businessName: string | null;
    businessLogo: string | null;
  } | undefined> {
    // PERFORMANCE OPTIMIZATION: Simplified query - use standard method due to Drizzle complexity
    try {
      const user = await this.getUser(userId);
      if (!user) return undefined;
      
      return {
        name: user.name,
        email: user.email,
        title: user.title,
        phone: user.phoneNumber, // Use the correct field name
        businessName: user.businessName,
        businessLogo: user.businessLogo
      };
    } catch (error) {
      console.error('Error in getUserProfileOptimized:', error);
      throw error;
    }
  }

  async incrementShareViewCount(id: number): Promise<void> {
    // PERFORMANCE OPTIMIZATION: Use single atomic update operation
    try {
      await db.update(cimDocuments)
        .set({ 
          shareViewCount: sql`COALESCE(${cimDocuments.shareViewCount}, 0) + 1`,
          shareLastViewed: new Date()
        })
        .where(eq(cimDocuments.id, id));
    } catch (error) {
      console.error('Error incrementing share view count:', error);
      // Don't throw error to avoid breaking share functionality
    }
  }

  // New granular view tracking methods
  async trackDocumentView(
    documentId: number,
    viewerType: 'anonymous' | 'nda_signer',
    options: {
      viewerIdentifier?: string;
      ipAddress?: string;
      userAgent?: string;
      location?: string;
      sessionId?: string;
    } = {}
  ): Promise<number> {
    const [result] = await db.insert(documentViews).values({
      cimDocumentId: documentId,
      viewerType,
      viewerIdentifier: options.viewerIdentifier,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      location: options.location,
      sessionId: options.sessionId,
      timeSpentSeconds: 0,
      lastHeartbeat: new Date(),
    }).returning({ id: documentViews.id });

    // Update document's last viewed timestamp
    await db.update(cimDocuments)
      .set({ shareLastViewed: new Date() })
      .where(eq(cimDocuments.id, documentId));

    return result.id;
  }

  // Update time spent for a viewing session via heartbeat
  async updateViewHeartbeat(sessionId: string, additionalSeconds: number): Promise<void> {
    await db.update(documentViews)
      .set({
        timeSpentSeconds: sql`COALESCE(${documentViews.timeSpentSeconds}, 0) + ${additionalSeconds}`,
        lastHeartbeat: new Date(),
      })
      .where(eq(documentViews.sessionId, sessionId));
  }

  // Track document download
  async trackDocumentDownload(
    documentId: number,
    downloadType: string,
    options: {
      viewerEmail?: string;
      viewerIdentifier?: string;
      ipAddress?: string;
    } = {}
  ): Promise<void> {
    await db.insert(documentDownloads).values({
      cimDocumentId: documentId,
      downloadType,
      viewerEmail: options.viewerEmail,
      viewerIdentifier: options.viewerIdentifier,
      ipAddress: options.ipAddress,
    });
  }

  // Get download stats for a document
  async getDocumentDownloadStats(documentId: number): Promise<{
    totalDownloads: number;
    downloadsByType: Record<string, number>;
    downloadsByViewer: { email: string; count: number }[];
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documentDownloads)
      .where(eq(documentDownloads.cimDocumentId, documentId));

    const byType = await db
      .select({
        downloadType: documentDownloads.downloadType,
        count: sql<number>`COUNT(*)`
      })
      .from(documentDownloads)
      .where(eq(documentDownloads.cimDocumentId, documentId))
      .groupBy(documentDownloads.downloadType);

    const byViewer = await db
      .select({
        email: documentDownloads.viewerEmail,
        count: sql<number>`COUNT(*)`
      })
      .from(documentDownloads)
      .where(
        and(
          eq(documentDownloads.cimDocumentId, documentId),
          sql`${documentDownloads.viewerEmail} IS NOT NULL`
        )
      )
      .groupBy(documentDownloads.viewerEmail);

    return {
      totalDownloads: totalResult?.count || 0,
      downloadsByType: byType.reduce((acc, row) => {
        acc[row.downloadType] = row.count;
        return acc;
      }, {} as Record<string, number>),
      downloadsByViewer: byViewer.map(row => ({
        email: row.email || 'unknown',
        count: row.count
      }))
    };
  }

  // Get viewer analytics for a specific signer
  async getSignerAnalytics(documentId: number, signerEmail: string): Promise<{
    totalViews: number;
    totalTimeSpentSeconds: number;
    totalDownloads: number;
    viewSessions: { viewedAt: Date; timeSpentSeconds: number }[];
    downloads: { downloadType: string; downloadedAt: Date }[];
  }> {
    const views = await db
      .select({
        viewedAt: documentViews.viewedAt,
        timeSpentSeconds: documentViews.timeSpentSeconds,
      })
      .from(documentViews)
      .where(
        and(
          eq(documentViews.cimDocumentId, documentId),
          eq(documentViews.viewerIdentifier, signerEmail)
        )
      )
      .orderBy(desc(documentViews.viewedAt));

    const downloads = await db
      .select({
        downloadType: documentDownloads.downloadType,
        downloadedAt: documentDownloads.downloadedAt,
      })
      .from(documentDownloads)
      .where(
        and(
          eq(documentDownloads.cimDocumentId, documentId),
          eq(documentDownloads.viewerEmail, signerEmail)
        )
      )
      .orderBy(desc(documentDownloads.downloadedAt));

    const totalTimeSpent = views.reduce((sum, v) => sum + (v.timeSpentSeconds || 0), 0);

    return {
      totalViews: views.length,
      totalTimeSpentSeconds: totalTimeSpent,
      totalDownloads: downloads.length,
      viewSessions: views.map(v => ({
        viewedAt: v.viewedAt,
        timeSpentSeconds: v.timeSpentSeconds || 0
      })),
      downloads: downloads.map(d => ({
        downloadType: d.downloadType,
        downloadedAt: d.downloadedAt
      }))
    };
  }

  async getDocumentViewStats(documentId: number): Promise<{
    totalViews: number;
    anonymousViews: number;
    ndaSignerViews: number;
    uniqueNdaSigners: number;
    recentViews: any[];
    dailyViews: Record<string, number>;
  }> {
    // Get total view counts by type
    const viewCounts = await db
      .select({
        viewerType: documentViews.viewerType,
        count: sql<number>`COUNT(*)`
      })
      .from(documentViews)
      .where(eq(documentViews.cimDocumentId, documentId))
      .groupBy(documentViews.viewerType);

    // Get unique NDA signers count
    const [uniqueSigners] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${documentViews.viewerIdentifier})`
      })
      .from(documentViews)
      .where(
        and(
          eq(documentViews.cimDocumentId, documentId),
          eq(documentViews.viewerType, 'nda_signer')
        )
      );

    // Get recent views with details
    const recentViews = await db
      .select({
        id: documentViews.id,
        viewerType: documentViews.viewerType,
        viewerIdentifier: documentViews.viewerIdentifier,
        ipAddress: documentViews.ipAddress,
        viewedAt: documentViews.viewedAt,
        location: documentViews.location
      })
      .from(documentViews)
      .where(eq(documentViews.cimDocumentId, documentId))
      .orderBy(desc(documentViews.viewedAt))
      .limit(50);

    // Get daily view breakdown for the last 30 days
    const dailyViewsQuery = await db
      .select({
        date: sql<string>`DATE(${documentViews.viewedAt})`,
        count: sql<number>`COUNT(*)`
      })
      .from(documentViews)
      .where(
        and(
          eq(documentViews.cimDocumentId, documentId),
          sql`${documentViews.viewedAt} >= CURRENT_DATE - INTERVAL '30 days'`
        )
      )
      .groupBy(sql`DATE(${documentViews.viewedAt})`)
      .orderBy(sql`DATE(${documentViews.viewedAt})`);

    // Convert daily views to object format
    const dailyViews: Record<string, number> = {};
    dailyViewsQuery.forEach(row => {
      dailyViews[row.date] = Number(row.count);
    });

    // DEBUG: Log daily views calculation
    console.log("🔍 DAILY VIEWS DEBUG:", {
      documentId,
      dailyViewsQuery,
      dailyViews
    });

    const anonymousViews = viewCounts.find(vc => vc.viewerType === 'anonymous')?.count || 0;
    const ndaSignerViews = viewCounts.find(vc => vc.viewerType === 'nda_signer')?.count || 0;
    
    // DEBUG: Log the actual values and types
    console.log("🔍 VIEW COUNT DEBUG:", {
      viewCounts,
      anonymousViews,
      ndaSignerViews,
      anonymousType: typeof anonymousViews,
      ndaSignerType: typeof ndaSignerViews
    });
    
    const totalViews = Number(anonymousViews) + Number(ndaSignerViews);

    return {
      totalViews,
      anonymousViews,
      ndaSignerViews,
      uniqueNdaSigners: uniqueSigners?.count || 0,
      recentViews,
      dailyViews
    };
  }

  async getNdaSignerViewHistory(
    documentId: number,
    signerEmail: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    const { limit = 50, offset = 0 } = options;
    const maxLimit = 100; // Cap the maximum to prevent unbounded results
    const safeLimit = Math.min(Math.max(1, limit), maxLimit);
    const safeOffset = Math.max(0, offset);

    return await db
      .select({
        id: documentViews.id,
        viewedAt: documentViews.viewedAt,
        ipAddress: documentViews.ipAddress,
        location: documentViews.location
      })
      .from(documentViews)
      .where(
        and(
          eq(documentViews.cimDocumentId, documentId),
          eq(documentViews.viewerType, 'nda_signer'),
          eq(documentViews.viewerIdentifier, signerEmail)
        )
      )
      .orderBy(desc(documentViews.viewedAt))
      .limit(safeLimit)
      .offset(safeOffset);
  }

  async createCustomSection(section: {
    cimDocumentId: number;
    type: 'text' | 'image' | 'html';
    title?: string;
    content?: string;
    customCss?: string;
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
        customCss: section.customCss,
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

  async getCustomSectionById(sectionId: number): Promise<any> {
    return await withRetry(async () => {
      const [section] = await db.select()
        .from(customSections)
        .where(eq(customSections.id, sectionId));
      return section;
    });
  }

  async getCustomSectionsOptimized(cimDocumentId: number): Promise<any[]> {
    // PERFORMANCE OPTIMIZATION: Direct query without retry overhead for share links
    try {
      return await db.select({
        id: customSections.id,
        type: customSections.type,
        title: customSections.title,
        content: customSections.content,
        customCss: customSections.customCss,
        imageUrls: customSections.imageUrls,
        position: customSections.position,
        insertAfterSection: customSections.insertAfterSection
      })
        .from(customSections)
        .where(eq(customSections.cimDocumentId, cimDocumentId))
        .orderBy(asc(customSections.position));
    } catch (error) {
      console.error('Error in getCustomSectionsOptimized:', error);
      // Fallback to regular method with retry logic
      return this.getCustomSections(cimDocumentId);
    }
  }

  async getAllCustomSections(): Promise<any[]> {
    return await db.select().from(customSections);
  }

  async updateCustomSection(id: number, updates: { title?: string; content?: string; customCss?: string; imageUrls?: string[]; imageUrlsBackup?: string[] }): Promise<void> {
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

    // Process PDF to images if fileContent is provided and no cached images
    let pageImages: any[] = [];
    let totalPages = 1;
    
    // Skip PDF processing for now to avoid compilation errors
    if (template.pageImages) {
      pageImages = template.pageImages;
      totalPages = template.totalPages || pageImages.length;
    }

    const [newTemplate] = await db.insert(ndaTemplates)
      .values({
        userId,
        name: template.name,
        fileContent: template.fileContent,
        isDefault: template.isDefault || false,
        signatureFields: template.signatureFields || [],
        recipients: template.recipients || [],
        pageImages,
        totalPages
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

  // Optimized version that excludes heavy fileContent for list views
  async getNdaTemplatesLight(userId: number): Promise<Omit<NdaTemplate, 'fileContent'>[]> {
    return await db.select({
      id: ndaTemplates.id,
      userId: ndaTemplates.userId,
      name: ndaTemplates.name,
      isDefault: ndaTemplates.isDefault,
      signatureFields: ndaTemplates.signatureFields,
      recipients: ndaTemplates.recipients,
      pageImages: ndaTemplates.pageImages,
      totalPages: ndaTemplates.totalPages,
      createdAt: ndaTemplates.createdAt,
      updatedAt: ndaTemplates.updatedAt
    })
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

    // Process PDF to images if fileContent has changed
    let updateData = { ...template };

    console.log('Storage: Updating NDA template in database:', {
      id,
      hasSignatureFields: !!updateData.signatureFields,
      signatureFieldsType: typeof updateData.signatureFields,
      signatureFieldsCount: Array.isArray(updateData.signatureFields) ? updateData.signatureFields.length : 'not array',
      signatureFields: updateData.signatureFields
    });

    // Skip PDF processing for now to avoid compilation errors
    if (template.fileContent && !template.pageImages) {
      console.log('PDF processing skipped - would reprocess images here');
    }

    const [updated] = await db.update(ndaTemplates)
      .set(updateData)
      .where(eq(ndaTemplates.id, id))
      .returning();

    console.log('Storage: Updated NDA template result:', {
      id: updated.id,
      hasSignatureFields: !!updated.signatureFields,
      signatureFieldsType: typeof updated.signatureFields,
      signatureFieldsCount: Array.isArray(updated.signatureFields) ? updated.signatureFields.length : 'not array'
    });

    return updated;
  }

  async deleteNdaTemplate(id: number): Promise<void> {
    // Get template data before deletion to clean up image files
    const [template] = await db.select().from(ndaTemplates).where(eq(ndaTemplates.id, id));
    
    if (template && template.pageImages) {
      try {
        // Clean up cached image files
        const pageImages = template.pageImages as any[];
        for (const page of pageImages) {
          if (page.imagePath) {
            const fullPath = path.join(process.cwd(), 'public', page.imagePath);
            try {
              await fs.promises.access(fullPath);
              await fs.promises.unlink(fullPath);
              console.log(`Cleaned up image file: ${fullPath}`);
            } catch {
              // File doesn't exist or couldn't be deleted, continue
            }
          }
        }
      } catch (error) {
        console.error('Error cleaning up template images:', error);
        // Continue with deletion even if cleanup fails
      }
    }

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

  async updateNdaSignatureStage(signatureId: number, stage: string | null): Promise<NdaSignature> {
    const [updatedSignature] = await db.update(ndaSignatures)
      .set({ stage })
      .where(eq(ndaSignatures.id, signatureId))
      .returning();
    return updatedSignature;
  }

  async rejectNdaSignature(signatureId: number, userId: number): Promise<NdaSignature> {
    const [rejectedSignature] = await db.update(ndaSignatures)
      .set({
        rejected: true,
        rejectedAt: new Date(),
        rejectedBy: userId
      })
      .where(eq(ndaSignatures.id, signatureId))
      .returning();

    // Deactivate any access tokens for this signature
    await db.update(ndaAccessTokens)
      .set({ isActive: false })
      .where(eq(ndaAccessTokens.ndaSignatureId, signatureId));

    return rejectedSignature;
  }

  async rejectNdaSignaturesBatch(signatureIds: number[], userId: number): Promise<NdaSignature[]> {
    const rejectedSignatures = await db.update(ndaSignatures)
      .set({
        rejected: true,
        rejectedAt: new Date(),
        rejectedBy: userId
      })
      .where(inArray(ndaSignatures.id, signatureIds))
      .returning();

    // Deactivate all access tokens for these signatures
    await db.update(ndaAccessTokens)
      .set({ isActive: false })
      .where(inArray(ndaAccessTokens.ndaSignatureId, signatureIds));

    return rejectedSignatures;
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

    if (template) {
      console.log('Storage: Retrieved NDA template from database:', {
        id: template.id,
        hasSignatureFields: !!template.signatureFields,
        signatureFieldsType: typeof template.signatureFields,
        signatureFieldsCount: Array.isArray(template.signatureFields) ? template.signatureFields.length : 'not array',
        signatureFields: template.signatureFields
      });
    }

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
        sql`${collaborators.cimDocumentId} = ${cimDocumentId} AND ${collaborators.userId} = ${userId} AND ${collaborators.status} = 'active'`
      );

    return collaborator || null;
  }

  async getCollaboratorByToken(token: string): Promise<Collaborator | null> {
    const [collaborator] = await db.select()
      .from(collaborators)
      .where(eq(collaborators.inviteToken, token));

    return collaborator || null;
  }

  async getCollaboratorCount(documentId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(collaborators)
      .where(
        and(
          eq(collaborators.cimDocumentId, documentId),
          eq(collaborators.status, 'active')
        )
      );

    return result[0]?.count || 0;
  }

  async getUserCollaboration(documentId: number, userId: number): Promise<Collaborator | null> {
    const [collaborator] = await db.select()
      .from(collaborators)
      .where(
        and(
          eq(collaborators.cimDocumentId, documentId),
          eq(collaborators.userId, userId),
          eq(collaborators.status, 'active')
        )
      );

    return collaborator || null;
  }

  async getPendingInvitationsByEmail(email: string): Promise<Collaborator[]> {
    const invitations = await db.select()
      .from(collaborators)
      .where(
        and(
          eq(collaborators.email, email),
          eq(collaborators.status, 'pending')
        )
      );

    return invitations;
  }

  async updateCollaborator(id: number, updates: Partial<Collaborator>): Promise<void> {
    await db.update(collaborators)
      .set(updates)
      .where(eq(collaborators.id, id));
  }

  async deleteCollaborator(id: number): Promise<void> {
    await db.update(collaborators)
      .set({ status: 'removed' as const })
      .where(eq(collaborators.id, id));
  }

  // Document Lock functions
  async getLock(documentId: number): Promise<any | null> {
    const [lock] = await db.select()
      .from(documentLocks)
      .where(eq(documentLocks.documentId, documentId));

    return lock || null;
  }

  async createLock(documentId: number, userId: number, userName: string, userEmail: string, takenOverFrom?: number): Promise<any> {
    // First delete any existing lock
    await db.delete(documentLocks)
      .where(eq(documentLocks.documentId, documentId));

    const [lock] = await db.insert(documentLocks)
      .values({
        documentId,
        userId,
        userName,
        userEmail,
        takenOverFrom: takenOverFrom || null,
      })
      .returning();

    return lock;
  }

  async updateLockActivity(documentId: number): Promise<void> {
    await db.update(documentLocks)
      .set({ lastActivityAt: new Date() })
      .where(eq(documentLocks.documentId, documentId));
  }

  async releaseLock(documentId: number): Promise<void> {
    await db.delete(documentLocks)
      .where(eq(documentLocks.documentId, documentId));
  }

  async releaseUserLocks(userId: number, documentId: number): Promise<void> {
    await db.delete(documentLocks)
      .where(
        and(
          eq(documentLocks.documentId, documentId),
          eq(documentLocks.userId, userId)
        )
      );
  }

  async cleanupStaleLocks(minutesOld: number): Promise<number> {
    const staleTimestamp = new Date(Date.now() - minutesOld * 60 * 1000);

    const staleLocks = await db.select()
      .from(documentLocks)
      .where(sql`${documentLocks.lastActivityAt} < ${staleTimestamp}`);

    if (staleLocks.length > 0) {
      await db.delete(documentLocks)
        .where(sql`${documentLocks.lastActivityAt} < ${staleTimestamp}`);
    }

    return staleLocks.length;
  }

  // Activity Log functions
  async logActivity(documentId: number, userId: number | null, userName: string | null, userEmail: string | null, action: string, metadata?: any): Promise<void> {
    await db.insert(documentActivityLog)
      .values({
        documentId,
        userId,
        userName,
        userEmail,
        action,
        metadata: metadata || null,
      });
  }

  async getActivityLog(
    documentId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    const { limit = 50, offset = 0 } = options;
    const maxLimit = 100; // Cap the maximum to prevent unbounded results
    const safeLimit = Math.min(Math.max(1, limit), maxLimit);
    const safeOffset = Math.max(0, offset);

    return await db.select()
      .from(documentActivityLog)
      .where(eq(documentActivityLog.documentId, documentId))
      .orderBy(desc(documentActivityLog.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);
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

  // Content & Style Template methods
  async getContentStyleTemplates(userId: number): Promise<ContentStyleTemplate[]> {
    return await db.select()
      .from(contentStyleTemplates)
      .where(eq(contentStyleTemplates.userId, userId))
      .orderBy(desc(contentStyleTemplates.createdAt));
  }

  async getContentStyleTemplate(id: number, userId: number): Promise<ContentStyleTemplate | undefined> {
    const [template] = await db.select()
      .from(contentStyleTemplates)
      .where(and(
        eq(contentStyleTemplates.id, id),
        eq(contentStyleTemplates.userId, userId)
      ));
    return template;
  }

  async createContentStyleTemplate(userId: number, template: InsertContentStyleTemplate): Promise<ContentStyleTemplate> {
    // If this template is being set as default, unset any existing default
    if (template.isDefault) {
      await db.update(contentStyleTemplates)
        .set({ isDefault: false })
        .where(eq(contentStyleTemplates.userId, userId));
    }

    const [newTemplate] = await db.insert(contentStyleTemplates)
      .values({
        ...template,
        userId
      })
      .returning();

    return newTemplate;
  }

  async updateContentStyleTemplate(id: number, userId: number, template: Partial<ContentStyleTemplate>): Promise<ContentStyleTemplate> {
    // If this template is being set as default, unset any existing default
    if (template.isDefault) {
      await db.update(contentStyleTemplates)
        .set({ isDefault: false })
        .where(eq(contentStyleTemplates.userId, userId));
    }

    const [updatedTemplate] = await db.update(contentStyleTemplates)
      .set({
        ...template,
        updatedAt: new Date()
      })
      .where(and(
        eq(contentStyleTemplates.id, id),
        eq(contentStyleTemplates.userId, userId)
      ))
      .returning();

    if (!updatedTemplate) {
      throw new Error("Template not found");
    }

    return updatedTemplate;
  }

  async deleteContentStyleTemplate(id: number, userId: number): Promise<void> {
    await db.delete(contentStyleTemplates)
      .where(and(
        eq(contentStyleTemplates.id, id),
        eq(contentStyleTemplates.userId, userId)
      ));
  }

  async setDefaultContentStyleTemplate(id: number, userId: number): Promise<void> {
    // First, unset any existing default templates
    await db.update(contentStyleTemplates)
      .set({ isDefault: false })
      .where(eq(contentStyleTemplates.userId, userId));

    // Then set the specified template as default
    await db.update(contentStyleTemplates)
      .set({ isDefault: true })
      .where(and(
        eq(contentStyleTemplates.id, id),
        eq(contentStyleTemplates.userId, userId)
      ));
  }

  async getUserDefaultContentStyleTemplate(userId: number): Promise<ContentStyleTemplate | undefined> {
    const [template] = await db.select()
      .from(contentStyleTemplates)
      .where(and(
        eq(contentStyleTemplates.userId, userId),
        eq(contentStyleTemplates.isDefault, true)
      ));
    return template;
  }

  // Message attachments implementation
  async createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment> {
    return await withRetry(async () => {
      const [created] = await db.insert(messageAttachments).values(attachment).returning();
      return created;
    });
  }

  async getMessageAttachments(messageId: number): Promise<MessageAttachment[]> {
    return await withRetry(async () => {
      return await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, messageId));
    });
  }

  async getMessageAttachment(attachmentId: number): Promise<MessageAttachment | undefined> {
    return await withRetry(async () => {
      const [attachment] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, attachmentId));
      return attachment;
    });
  }

  // Email management implementation
  async scheduleWelcomeEmail(userId: number): Promise<void> {
    return await withRetry(async () => {
      // Get the welcome email sequence
      const [welcomeSequence] = await db.select()
        .from(onboardingEmailSequences)
        .where(and(
          eq(onboardingEmailSequences.name, 'Welcome Email'),
          eq(onboardingEmailSequences.isActive, true)
        ));

      if (!welcomeSequence) {
        throw new Error('Welcome email sequence not found');
      }

      // Schedule the email to be sent immediately (0 days delay)
      const scheduledAt = new Date();
      await db.insert(userEmailQueue).values({
        userId,
        sequenceId: welcomeSequence.id,
        scheduledAt,
        status: 'pending'
      });
    });
  }

  async getOnboardingSequences(): Promise<OnboardingEmailSequence[]> {
    return await withRetry(async () => {
      return await db.select().from(onboardingEmailSequences).orderBy(onboardingEmailSequences.delayInDays);
    });
  }

  async getActiveOnboardingSequences(): Promise<OnboardingEmailSequence[]> {
    return await withRetry(async () => {
      return await db.select()
        .from(onboardingEmailSequences)
        .where(eq(onboardingEmailSequences.isActive, true))
        .orderBy(onboardingEmailSequences.delayInDays);
    });
  }

  async getPendingEmails(): Promise<any[]> {
    return await withRetry(async () => {
      return await db.select({
        queueId: userEmailQueue.id,
        userId: userEmailQueue.userId,
        userEmail: users.email,
        userName: users.name,
        templateId: onboardingEmailSequences.templateId,
        scheduledAt: userEmailQueue.scheduledAt,
        sequenceName: onboardingEmailSequences.name
      })
      .from(userEmailQueue)
      .innerJoin(users, eq(userEmailQueue.userId, users.id))
      .innerJoin(onboardingEmailSequences, eq(userEmailQueue.sequenceId, onboardingEmailSequences.id))
      .where(and(
        eq(userEmailQueue.status, 'pending'),
        sql`${userEmailQueue.scheduledAt} <= NOW()`
      ));
    });
  }

  async markEmailAsSent(queueId: number): Promise<void> {
    return await withRetry(async () => {
      await db.update(userEmailQueue)
        .set({ 
          status: 'sent',
          sentAt: new Date()
        })
        .where(eq(userEmailQueue.id, queueId));
    });
  }

  async markEmailAsFailed(queueId: number, errorMessage: string): Promise<void> {
    return await withRetry(async () => {
      await db.update(userEmailQueue)
        .set({
          status: 'failed',
          errorMessage
        })
        .where(eq(userEmailQueue.id, queueId));
    });
  }

  async createSupportTicket(ticket: { userId: number; organizationId?: number | null; type: string; subject: string; description: string; attachments?: any[]; browserInfo?: string; pageUrl?: string }): Promise<any> {
    return await withRetry(async () => {
      const [newTicket] = await db.insert(supportTickets).values({
        userId: ticket.userId,
        organizationId: ticket.organizationId || null,
        type: ticket.type,
        subject: ticket.subject,
        description: ticket.description,
        attachments: ticket.attachments || [],
        browserInfo: ticket.browserInfo || null,
        pageUrl: ticket.pageUrl || null,
      }).returning();
      return newTicket;
    });
  }

  async getNotificationPreferences(userId: number): Promise<UserNotificationPreferences | null> {
    return await withRetry(async () => {
      const [prefs] = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, userId))
        .limit(1);
      return prefs || null;
    });
  }

  async upsertNotificationPreferences(userId: number, preferences: Partial<UserNotificationPreferences>): Promise<UserNotificationPreferences> {
    return await withRetry(async () => {
      // Check if preferences exist
      const existing = await this.getNotificationPreferences(userId);

      if (existing) {
        // Update existing preferences
        const [updated] = await db
          .update(userNotificationPreferences)
          .set({
            ...preferences,
            updatedAt: new Date(),
          })
          .where(eq(userNotificationPreferences.userId, userId))
          .returning();
        return updated;
      } else {
        // Create new preferences with defaults
        const [created] = await db
          .insert(userNotificationPreferences)
          .values({
            userId,
            ...preferences,
          })
          .returning();
        return created;
      }
    });
  }
}

export const storage = new DatabaseStorage();
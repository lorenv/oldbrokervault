import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript, generateFlexibleCimDocument, generateCimWithWebsiteAnalysis, startWebsiteAnalysis, type FlexibleCimDocument } from "./perplexity";
import { normalizeUrl, extractLogoFromWebsite, extractWebsiteImages, downloadSelectedImages } from "./website-analyzer";
import { imageManager } from "./image-manager";
import { objectStorageImageManager } from "./image-manager-object-storage";
import { fileStorageManager } from "./file-storage";
import { insertCimDocumentSchema, insertUploadedCimSchema, subscriptionPlans, users, insertNdaTemplateSchema, insertNdaSignatureSchema, financialFiles, insertFinancialFileSchema, insertCollaboratorSchema, uploadedFiles, ndaAccessTokens, insertAnalysisTemplateSchema, userBranding } from "@shared/schema";
import { z } from "zod";
import { searchService, versionService, analyticsService } from "./premium-services";
import { db } from "./db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { withRetry } from './db-utils';
import { createSubscriptionSession, createSubscriptionSessionDirect, handleStripeWebhook, verifyCheckoutSession, createCustomerPortalSession, getPricing, addSubscriptionSeats, getSubscriptionQuantity } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { objectStorage } from './object-storage';
import { generateWordDocument, generatePDF, generateHtml, formatTextContent } from "./document-export";
import { exportToWordPress, formatWordPressContent, fetchBeaverBuilderTemplates } from "./wordpress-export";
// Geoip will be imported dynamically in the function where it's used

import JSZip from 'jszip';
import sharp from 'sharp';
import archiver from 'archiver';
import { addCertificateToNda } from "./pdf-utils";
import { sendNdaSignedEmail, sendEmail, sendApprovalEmail, sendOwnerApprovalNotification, sendRejectionEmail, sendCollaborationInvitationEmail, sendCollaboratorRemovedEmail, sendEditLockTakenOverEmail, sendNdaPendingEmail } from "./email";
import { generateSecureToken, generateRedirectId } from "./token-utils";
import { escapeHtml } from "./utils/sanitize-filename";
import { sanitizeUser, sanitizeUserForSharing, sanitizeForLogging, validateResponseSafety } from "./data-sanitizer";
import { responseSanitizationMiddleware, securityHeadersMiddleware, sensitiveEndpointLimiter } from "./security-middleware";
import { isUrlSafeForFetch } from "./security";
import { invalidateUserCache } from "./auth";
import { logger } from "./logger";
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import rateLimit from 'express-rate-limit';

const execAsync = promisify(exec);
import { registerNdaTemplateRoutes } from "./routes/nda-template-routes";
import { eSignatureRoutes } from "./routes/esignature-routes";
import { esignRoutes } from "./routes/esign-routes";
import unsubscribeRoutes from "./routes/unsubscribe-routes";
import { PdfSignatureProcessor } from "./pdf-signature-processor";
import migrateImagesToFiles from "./migrate-images";
import { coverImageService } from "./cover-image-service";
import { messageRoutes } from "./routes/messages";
import messageAttachmentRoutes from "./routes/message-attachments";
import { sendErrorReport } from "./error-reporter";
import { registerMonitoringRoutes } from "./routes/monitoring-routes";
import { setupSEORoutes } from "./seo-routes";
import { textExtractionRouter } from "./routes/text-extraction";
import { registerSDEAnalyzerRoutes } from "./routes/sde-analyzer-routes";
import { sdeProcessor } from "./sde-processor";
import webhookRoutes from "./routes/webhook-routes";
import incomingWebhookRoutes from "./routes/incoming-webhook-routes";
import integrationRoutes from "./routes/integration-routes";
import teaserRoutes from "./routes/teaser-routes";
import listingsRoutes from "./routes/listings-routes";
import crmRoutes from "./routes/crm-routes";
import dashboardRoutes from "./routes/dashboard-routes";
import aiAssistantRoutes from "./routes/ai-assistant-routes";
import extensionAuthRoutes from "./routes/extension-auth-routes";
import extensionRoutes from "./routes/extension-routes";
import { dispatchWebhookEvent } from "./webhook-dispatcher";
import { dispatchIntegrationEvent } from "./integrations";
import { registerExternalWebhooks } from "./routes/external-webhooks";

import { registerNdaSigningRoutes } from "./routes/nda-signing-routes";
import { registerSharingRoutes } from "./routes/sharing-routes";
import { registerCollaborationRoutes } from "./routes/collaboration-routes";
import { registerAnalyticsRoutes } from "./routes/analytics-tracking-routes";
import { registerSubscriptionRoutes } from "./routes/subscription-routes";
import { registerExportRoutes } from "./routes/export-routes";
import { registerAdminRoutes } from "./routes/admin-routes";
import { registerInvestorContactRoutes } from "./routes/investor-contacts-routes";
import { registerProfileSettingsRoutes } from "./routes/profile-settings-routes";
import { registerUtilityRoutes } from "./routes/utility-misc-routes";
import { registerNdaWhitelistRoutes } from "./routes/nda-whitelist-routes";
import { registerNdaHubRoutes } from "./routes/nda-hub-routes";
import { registerBuyerSurveyRoutes } from "./routes/buyer-survey-routes";
import { registerSellerIntakeRoutes } from "./routes/seller-intake-routes";
import { registerDealNdaRoutes } from "./routes/deal-nda-routes";
import { upload, isAuthorizedAdmin, hasPremiumAccess, aiGenerationLimiter, hashSharePassword, verifySharePassword, readFileFromDisk, cleanupTempFile, cleanupTempFilePath, largeFileUpload, addRoundedCorners } from "./route-utils";

// Directory paths
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
const businessImagesDir = path.join(process.cwd(), 'public', 'business-images');
const financialFilesDir = path.join(process.cwd(), 'private', 'financial-files');
const uploadedCimsDir = path.join(process.cwd(), 'private', 'uploaded-cims');

// Create directories asynchronously without blocking startup
const createDirectoriesAsync = async () => {
  try {
    await Promise.all([
      fs.mkdir(uploadsDir, { recursive: true }),
      fs.mkdir(businessImagesDir, { recursive: true }),
      fs.mkdir(financialFilesDir, { recursive: true }),
      fs.mkdir(uploadedCimsDir, { recursive: true })
    ]);
    console.log('Directories created successfully');
  } catch (error) {
    console.error('Error creating directories:', error);
  }
};

// Start directory creation in background - completely non-blocking for deployment health checks
createDirectoriesAsync().catch(error => {
  console.error('Background directory creation failed:', error);
});


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


export async function registerRoutes(app: Express): Promise<Server> {
  // Import message service for webhook processing
  const { messageService } = await import("./message-service");
  
  // SEO routes will be setup AFTER Vite middleware to avoid conflicts
  console.log('🔍 SEO routes will be configured after Vite setup in development...');
  
  // Remove the general static serving from here - it will be handled by index.ts
  // Only keep specific route static serving that's needed
  app.use('/user-images', express.static(path.join(process.cwd(), 'public', 'user-images')));
  app.use('/logos', express.static(path.join(process.cwd(), 'public', 'logos')));
  
  // IMPORTANT: Register external webhook endpoints BEFORE authentication middleware
  // These endpoints need to be accessible by external services without authentication
  await registerExternalWebhooks(app);

  // Setup authentication AFTER webhook endpoints
  setupAuth(app);
  
  // SECURITY: Apply security middleware globally, but exclude webhooks
  app.use((req, res, next) => {
    // Skip security middleware for webhook endpoints
    if (req.path.startsWith('/api/webhook/')) {
      return next();
    }
    return responseSanitizationMiddleware(req, res, next);
  });
  
  app.use((req, res, next) => {
    // Skip security headers for webhook endpoints  
    if (req.path.startsWith('/api/webhook/')) {
      return next();
    }
    return securityHeadersMiddleware(req, res, next);
  });
  
  app.use((req, res, next) => {
    // Skip rate limiting for webhook endpoints
    if (req.path.startsWith('/api/webhook/')) {
      return next();
    }
    return sensitiveEndpointLimiter(req, res, next);
  });

  // Register monitoring routes first for health checks
  registerMonitoringRoutes(app);

  // Register NDA template routes BEFORE other routes to avoid conflicts
  registerNdaTemplateRoutes(app);

  // Register e-signature routes
  console.log('=== REGISTERING E-SIGNATURE ROUTES ===');
  app.use('/api/esignature', eSignatureRoutes);
  app.use('/api/esign', esignRoutes);


  // Register unsubscribe routes
  app.use('/api/unsubscribe', unsubscribeRoutes);

  // ========== Public Incoming Webhook Receiver Endpoint ==========
  // This endpoint receives data from external services (Typeform, Calendly, etc.)
  // No authentication required - uses token-based access

  // Register text extraction routes
  app.use('/api/text-extraction', textExtractionRouter);

  // Register SDE Analyzer routes
  registerSDEAnalyzerRoutes(app);

  // Start SDE background processor
  sdeProcessor.start();
  console.log('✅ SDE Analyzer processor started');

  // Register extracted route modules
  registerNdaSigningRoutes(app);
  registerSharingRoutes(app);
  registerCollaborationRoutes(app);
  registerAnalyticsRoutes(app);
  registerSubscriptionRoutes(app);
  registerExportRoutes(app);
  registerAdminRoutes(app);
  registerInvestorContactRoutes(app);
  registerProfileSettingsRoutes(app);
  registerUtilityRoutes(app);
  registerNdaWhitelistRoutes(app);
  registerNdaHubRoutes(app);
  registerBuyerSurveyRoutes(app);
  registerSellerIntakeRoutes(app);
  registerDealNdaRoutes(app);

  // CIM Document Routes with file upload support

  // Background CIM generation helper function
  async function generateCimInBackground(
    docId: number,
    userId: number,
    data: any,
    ndaSettings: any,
    customStyleConfig: any
  ) {
    console.log(`[Background CIM] Starting generation for doc ${docId}`);

    try {
      const purpose = data.purpose || 'business_overview';
      const tone = data.tone || 'professional';
      const audience = data.audience || 'investors';

      // Start ALL website-related operations in parallel
      let normalizedUrl: string | null = null;
      let websiteAnalysisPromise: Promise<string | null> = Promise.resolve(null);
      let logoExtractionPromise: Promise<string | null> = Promise.resolve(null);
      let imageExtractionPromise: Promise<string[]> = Promise.resolve([]);

      if (data.websiteUrl) {
        if (!isUrlSafeForFetch(data.websiteUrl.startsWith('http') ? data.websiteUrl : `https://${data.websiteUrl}`)) {
          throw new Error("Invalid or blocked website URL");
        }
        try {
          normalizedUrl = normalizeUrl(data.websiteUrl);
          console.log(`[Background CIM] Starting parallel website operations for doc ${docId}`);

          websiteAnalysisPromise = startWebsiteAnalysis(data.websiteUrl);
          logoExtractionPromise = extractLogoFromWebsite(normalizedUrl, userId)
            .catch(err => {
              console.error("[Background CIM] Logo extraction error:", err);
              return null;
            });
          imageExtractionPromise = extractWebsiteImages(normalizedUrl)
            .catch(err => {
              console.error("[Background CIM] Image extraction error:", err);
              return [];
            });
        } catch (error) {
          console.error("[Background CIM] Website URL normalization error:", error);
        }
      }

      // Wait for website analysis first (needed for CIM generation)
      const websiteData = await websiteAnalysisPromise;

      // Generate CIM with pre-fetched website data
      const analysis = await generateCimWithWebsiteAnalysis(
        data.transcript,
        data.directions,
        purpose,
        tone,
        audience,
        data.financials,
        data.websiteUrl,
        data.sectionDirections,
        data.formattingProfile,
        websiteData,
        customStyleConfig
      );

      console.log(`[Background CIM] AI generation complete for doc ${docId}`);

      // Collect results from parallel logo/image extraction
      let logoUrl = null;
      let extractedImages: string[] = [];

      if (data.websiteUrl) {
        try {
          const [logoResult, imagesResult] = await Promise.allSettled([
            logoExtractionPromise,
            imageExtractionPromise
          ]);

          if (logoResult.status === 'fulfilled' && logoResult.value) {
            logoUrl = logoResult.value;
          }
          if (imagesResult.status === 'fulfilled' && Array.isArray(imagesResult.value)) {
            extractedImages = imagesResult.value;
          }
        } catch (error) {
          console.error("[Background CIM] Website processing error:", error);
        }
      }

      // Process selected images
      let savedImagePaths: string[] = [];
      if (data.selectedImages && Array.isArray(data.selectedImages) && data.selectedImages.length > 0) {
        try {
          const imagePromises = data.selectedImages.map(async (imageUrl: string) => {
            try {
              const metadata = await imageManager.saveImageFromUrl(imageUrl, userId, 'business-images');
              return metadata.publicPath;
            } catch {
              return null;
            }
          });
          const results = await Promise.allSettled(imagePromises);
          savedImagePaths = results
            .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);
        } catch (error) {
          console.error("[Background CIM] Image processing error:", error);
        }
      }

      // Update document with completed analysis
      await storage.updateCimDocument(docId, {
        analysis,
        logoUrl,
        selectedImages: savedImagePaths,
        generationStatus: 'ready',
        generationError: null,
      });

      console.log(`[Background CIM] Document ${docId} generation complete and saved`);

      // Create in-app notification for CIM completion
      try {
        const { notifications, organizationMembers } = await import("@shared/schema");
        const [membership] = await db.select().from(organizationMembers)
          .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
          .limit(1);
        if (membership) {
          await db.insert(notifications).values({
            organizationId: membership.organizationId,
            userId: userId,
            type: 'cim_ready',
            title: 'CIM Ready!',
            message: `Your CIM "${data.title || 'Untitled'}" has been generated and is ready to view.`,
            entityType: 'cim',
            entityId: docId,
          });
        }
      } catch (notifError) {
        console.error('[Background CIM] Failed to create notification:', notifError);
      }

      // Dispatch webhook events
      const doc = await storage.getCimDocument(docId);
      if (doc) {
        const cimCreatedPayload = {
          cim_id: doc.id,
          title: doc.title,
          share_url: doc.shareSlug ? `${req.protocol}://${req.get('host')}/share/${doc.shareSlug}` : null,
          created_at: doc.createdAt,
          document: { id: doc.id, title: doc.title },
        };
        dispatchWebhookEvent(userId, 'cim.created', cimCreatedPayload).catch(err => console.error('Webhook dispatch error:', err));
        dispatchIntegrationEvent(userId, 'cim.created', cimCreatedPayload).catch(err => console.error('Integration dispatch error:', err));
      }

    } catch (error) {
      console.error(`[Background CIM] Generation failed for doc ${docId}:`, error);

      // Update document with error status
      let errorMessage = "An unexpected error occurred during CIM generation";
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('json') || errorMsg.includes('unexpected token')) {
          errorMessage = "The AI service returned an invalid response. Please try regenerating.";
        } else if (errorMsg.includes('rate limit') || errorMsg.includes('quota')) {
          errorMessage = "The AI service is at capacity. Please try again in a few minutes.";
        } else {
          errorMessage = error.message;
        }
      }

      await storage.updateCimDocument(docId, {
        generationStatus: 'failed',
        generationError: errorMessage,
      });

      // Create in-app notification for CIM failure
      try {
        const { notifications, organizationMembers } = await import("@shared/schema");
        const [membership] = await db.select().from(organizationMembers)
          .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
          .limit(1);
        if (membership) {
          await db.insert(notifications).values({
            organizationId: membership.organizationId,
            userId: userId,
            type: 'cim_failed',
            title: 'CIM Generation Failed',
            message: `Generation of "${data.title || 'Untitled'}" failed: ${errorMessage}`,
            entityType: 'cim',
            entityId: docId,
          });
        }
      } catch (notifError) {
        console.error('[Background CIM] Failed to create failure notification:', notifError);
      }
    }
  }

  app.post("/api/cim/generate", aiGenerationLimiter, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Extract and validate NDA settings BEFORE main schema parsing (which strips unknown fields)
      const ndaSettingsSchema = z.object({
        ndaProtected: z.boolean(),
        ndaTemplateId: z.coerce.number().nullable(),
        ndaApprovalRequired: z.boolean()
      }).refine(s => !s.ndaProtected || s.ndaTemplateId !== null, {
        message: 'Template required when NDA is enabled'
      }).optional();


      let ndaSettings = { ndaProtected: false, ndaTemplateId: null, ndaApprovalRequired: false };
      try {
        if (req.body.ndaSettings) {
          ndaSettings = ndaSettingsSchema.parse(req.body.ndaSettings);
        } else {
        }
      } catch (error) {
      }

      // Extract custom style config if provided
      const customStyleConfigSchema = z.object({
        name: z.string(),
        wordCountTarget: z.number(),
        useBullets: z.boolean(),
        useNumberedLists: z.boolean(),
        useTables: z.boolean(),
        toneDescription: z.string()
      }).optional();

      let customStyleConfig = null;
      try {
        if (req.body.customStyleConfig) {
          customStyleConfig = customStyleConfigSchema.parse(req.body.customStyleConfig);
          console.log('🎨 Custom style config received:', customStyleConfig?.toneDescription?.substring(0, 50));
        }
      } catch (error) {
        console.error('Custom style config parsing error:', error);
      }
      
      // Now parse the main schema (this will strip out unknown fields like ndaSettings)
      const data = insertCimDocumentSchema.parse(req.body);

      // Debug: Log dealId
      console.log("=== DEAL ASSOCIATION DEBUG (GENERATE ROUTE) ===");
      console.log("Raw req.body.dealId:", req.body.dealId, "type:", typeof req.body.dealId);
      console.log("Parsed data.dealId:", data.dealId, "type:", typeof data.dealId, "truthy:", !!data.dealId);

      const docId = data.docId; // For regeneration
      const customizations = data.customizations || {};
      

      // Check if this is a regeneration request
      if (docId) {
        const existingDoc = await storage.getCimDocument(docId);
        if (!existingDoc || existingDoc.userId !== req.user!.id) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Check global regeneration limit using new tracking system
        const canRegenerate = await storage.checkRegenerationLimit(req.user!.id);
        if (!canRegenerate) {
          return res.status(403).json({ error: "Monthly regeneration limit reached" });
        }

        // Validate content changes to prevent abuse
        const baseline = await storage.getDocumentBaseline(docId);
        if (baseline) {
          const { ContentValidationService } = await import('./content-validation');
          const validation = ContentValidationService.validateRegenerationContent(
            baseline,
            data.transcript,
            data.directions,
            data.financials
          );

          if (!validation.isValid) {
            return res.status(400).json({ 
              error: "Content validation failed",
              reason: validation.reason,
              similarityScore: validation.similarityScore,
              suggestion: "These changes appear to represent a different business. Please create a new document instead."
            });
          }
        }

        // Generate flexible CIM with new directions and customizations
        const purpose = data.purpose || 'business_overview';
        const tone = data.tone || 'professional';
        const audience = data.audience || 'investors';

        // OPTIMIZATION: Start website analysis and logo extraction in parallel at the beginning
        let normalizedUrl: string | null = null;
        let websiteAnalysisPromise: Promise<string | null> = Promise.resolve(null);
        let logoExtractionPromise: Promise<string | null> = Promise.resolve(null);

        if (data.websiteUrl) {
          // Validate URL before processing to prevent SSRF attacks
          if (!isUrlSafeForFetch(data.websiteUrl.startsWith('http') ? data.websiteUrl : `https://${data.websiteUrl}`)) {
            console.error("Blocked unsafe website URL:", data.websiteUrl);
            return res.status(400).json({ error: "Invalid or blocked website URL" });
          }
          try {
            normalizedUrl = normalizeUrl(data.websiteUrl);
            console.log("🚀 Starting parallel website processing for regeneration...");

            // Start both operations immediately - don't wait
            websiteAnalysisPromise = startWebsiteAnalysis(data.websiteUrl);
            logoExtractionPromise = extractLogoFromWebsite(normalizedUrl, req.user!.id)
              .catch(err => {
                console.error("Logo extraction error:", err);
                return null;
              });
          } catch (error) {
            console.error("Website URL normalization error:", error);
          }
        }

        // Wait for website analysis to complete (it runs in parallel with logo extraction)
        const websiteData = await websiteAnalysisPromise;

        // Generate CIM with pre-fetched website data
        let analysis = await generateCimWithWebsiteAnalysis(
          data.transcript,
          data.directions,
          purpose,
          tone,
          audience,
          data.financials,
          data.websiteUrl,
          data.sectionDirections,
          data.formattingProfile,
          websiteData, // Pass pre-fetched data
          customStyleConfig
        );

        // Now wait for logo extraction (should already be done or nearly done)
        if (data.websiteUrl) {
          try {
            const logoUrl = await logoExtractionPromise;
            if (logoUrl) {
              existingDoc.logoUrl = logoUrl;
              console.log("Logo extraction completed:", logoUrl);
            }
          } catch (error) {
            console.error("Website processing error:", error);
          }
        }

        const updatedDoc = await storage.updateCimDocument(docId, {
          ...existingDoc,
          directions: data.directions,
          analysis,
          regenerationCount: existingDoc.regenerationCount + 1
        });

        // Track regeneration usage using new system
        await storage.updateRegenerationUsage(req.user!.id);

        return res.json(updatedDoc);
      }

      // NEW DOCUMENT GENERATION - Background processing approach
      // Create placeholder document immediately, then generate in background

      // Validate website URL early if provided
      if (data.websiteUrl) {
        if (!isUrlSafeForFetch(data.websiteUrl.startsWith('http') ? data.websiteUrl : `https://${data.websiteUrl}`)) {
          console.error("Blocked unsafe website URL:", data.websiteUrl);
          return res.status(400).json({ error: "Invalid or blocked website URL" });
        }
      }

      // Extract financial and cover image data for placeholder document
      const financials = data.financials;
      const coverImage = data.coverImage;
      const coverImageUrl = coverImage?.url || data.coverImageUrl || null;
      const coverImagePosition = coverImage?.position ? JSON.stringify(coverImage.position) : data.coverImagePosition || null;
      const coverImageAttribution = coverImage?.attribution || data.coverImageAttribution || null;

      // Generate automatic share link for new document
      const randomId = Math.random().toString(36).substring(2, 8);
      const shareSlug = `cim-${randomId}`;

      console.log("=== CREATING PLACEHOLDER DOCUMENT FOR BACKGROUND GENERATION ===");

      // Create placeholder document with 'generating' status
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        directions: data.directions,
        websiteUrl: data.websiteUrl,
        logoUrl: null, // Will be populated by background generation
        analysis: { sections: [], title: data.title, generatingPlaceholder: true }, // Placeholder
        selectedImages: [],
        regenerationCount: 0,
        coverImageUrl,
        coverImagePosition,
        coverImageAttribution,
        financialsEnabled: true,
        askingPrice: financials?.askingPrice || null,
        askingPriceIncluded: true,
        revenue: financials?.revenue || null,
        revenueIncluded: true,
        ebitda: financials?.ebitda || null,
        ebitdaIncluded: true,
        shareEnabled: true,
        shareSlug: shareSlug,
        sharePassword: null,
        shareExpiresAt: null,
        ndaProtected: ndaSettings.ndaProtected || false,
        ndaTemplateId: ndaSettings.ndaTemplateId || null,
        ndaApprovalRequired: ndaSettings.ndaApprovalRequired || false,
        dealId: data.dealId || null,
        // Background generation status fields
        generationStatus: 'generating',
        generationStartedAt: new Date(),
      });

      console.log(`[Background CIM] Created placeholder document ${doc.id}, starting background generation`);

      // If dealId was provided, create a deal-document link (sync, fast operation)
      if (data.dealId) {
        const { dealDocuments } = await import('@shared/schema');
        const { db } = await import('./db');
        try {
          await db.insert(dealDocuments).values({
            dealId: data.dealId,
            cimDocumentId: doc.id,
          });
          console.log(`✅ Created deal-document link: deal ${data.dealId} -> CIM ${doc.id}`);
        } catch (linkError) {
          console.error('❌ Error creating deal-document link:', linkError);
        }
      }

      // Return immediately with the document ID
      res.json({
        ...doc,
        generationStatus: 'generating',
        message: 'CIM generation started. You can safely navigate away while it completes.'
      });

      // Fire off background generation (don't await - fire and forget)
      generateCimInBackground(doc.id, req.user!.id, data, ndaSettings, customStyleConfig)
        .catch(err => console.error(`[Background CIM] Unhandled error for doc ${doc.id}:`, err));
    } catch (error) {
      console.error("CIM generation error:", error instanceof Error ? error.message : String(error));
      
      // Provide more user-friendly error messages
      let userMessage = "An unexpected error occurred while generating your CIM";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('json') || errorMsg.includes('unexpected token')) {
          userMessage = "The AI service returned an invalid response. Please try again in a moment.";
        } else if (errorMsg.includes('html') || errorMsg.includes('server error')) {
          userMessage = "The AI service is temporarily unavailable. Please try again in a few minutes.";
        } else if (errorMsg.includes('rate limit') || errorMsg.includes('quota')) {
          userMessage = "The AI service is currently at capacity. Please try again in a few minutes.";
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          userMessage = "Network connection issue. Please check your connection and try again.";
        } else if (errorMsg.includes('limit reached')) {
          userMessage = error.message; // Keep the original message for limit errors
        } else {
          userMessage = error.message; // Use the original error message for other cases
        }
      }
      
      res.status(400).json({ error: userMessage });
    }
  });

  // Image upload endpoint for CIM documents
  app.post("/api/cim/:id/upload-image", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user!.id) {
        return res.sendStatus(404);
      }

      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      // Save the uploaded image using the image manager
      const metadata = await imageManager.saveImageFromBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id,
        'business-images',
        { optimize: true, maxWidth: 1200, maxHeight: 800 }
      );

      // Get current images and add the new one
      const currentImages = cim.selectedImages || [];
      const updatedImages = [...currentImages, metadata.publicPath];
      
      // Update the CIM document with the new image
      await storage.updateCimImages(cimId, updatedImages);

      res.json({ 
        success: true, 
        imagePath: metadata.publicPath,
        metadata: metadata
      });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Upload logo endpoint
  app.post("/api/cim/:id/logo", upload.single('logo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ error: "No logo file uploaded" });
      }

      console.log(`Logo upload request - CIM ID: ${cimId}`);

      const cim = await storage.getCimDocument(cimId);
      if (!cim) {
        console.log("CIM document not found");
        return res.status(404).json({ error: "CIM not found" });
      }

      if (cim.userId !== req.user!.id) {
        console.log("Unauthorized access attempt");
        return res.sendStatus(403);
      }

      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "File must be an image" });
      }

      // Save the logo using the new ImageManager
      const metadata = await imageManager.saveImageFromBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id,
        'logos',
        { optimize: true, maxWidth: 800, maxHeight: 600 }
      );

      // Update the CIM document with the new logo path
      await storage.updateCimDocument(cimId, { logoUrl: metadata.publicPath });

      res.json({ 
        success: true, 
        logoUrl: metadata.publicPath,
        metadata: metadata
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  // Delete website logo endpoint
  app.delete("/api/cim/:id/logo", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user!.id) {
        return res.sendStatus(404);
      }

      // Remove the logo URL from the document
      await storage.updateCimDocument(cimId, { logoUrl: null });

      res.json({ success: true });
    } catch (error) {
      console.error("Logo deletion error:", error);
      res.status(500).json({ error: "Failed to delete logo" });
    }
  });

  // Upload business image endpoint - File-based storage only
  app.post("/api/cim/:id/business-image", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      console.log(`Business image upload request - CIM ID: ${cimId}`);

      const cim = await storage.getCimDocument(cimId);
      if (!cim) {
        console.log("CIM document not found");
        return res.status(404).json({ error: "CIM not found" });
      }

      if (cim.userId !== req.user!.id) {
        console.log("Unauthorized access attempt");
        return res.sendStatus(403);
      }

      // Save the uploaded image using the image manager (file-based storage)
      const metadata = await imageManager.saveImageFromBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id,
        'business-images',
        { optimize: true, maxWidth: 1200, maxHeight: 800 }
      );

      // Update the CIM document with the new file path
      const currentImages = cim.selectedImages || [];
      const updatedImages = [...currentImages, metadata.publicPath];
      await storage.updateCimImages(cimId, updatedImages);

      console.log(`Successfully uploaded business image as file: ${metadata.publicPath}`);
      res.json({ success: true, imagePath: metadata.publicPath });
    } catch (error) {
      console.error("Business image upload error:", error);
      res.status(500).json({ error: "Failed to upload business image" });
    }
  });

  // Delete individual business image endpoint
  app.delete("/api/cim/:id/business-image/:index", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      const imageIndex = parseInt(req.params.index);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user!.id) {
        return res.sendStatus(404);
      }

      if (!cim.selectedImages || imageIndex < 0 || imageIndex >= cim.selectedImages.length) {
        return res.status(400).json({ error: "Invalid image index" });
      }

      // Remove the image at the specified index
      const updatedImages = cim.selectedImages.filter((_, index) => index !== imageIndex);
      await storage.updateCimImages(cimId, updatedImages);

      res.json({ success: true });
    } catch (error) {
      console.error("Business image deletion error:", error);
      res.status(500).json({ error: "Failed to delete business image" });
    }
  });



  // File upload endpoint for large text and financial files
  // PERF-019: Apply AI generation rate limiter to this endpoint as well
  app.post("/api/cim/upload", aiGenerationLimiter, (req, res, next) => {
    largeFileUpload.any()(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File too large. Maximum size allowed is 200MB. Please reduce your file size and try again.`,
            details: `File size limit exceeded: ${(err.limit / (1024 * 1024)).toFixed(0)}MB`
          });
        } else if (err.code === 'LIMIT_FIELD_SIZE') {
          return res.status(413).json({
            error: "Form data too large. Please reduce the size of your submission.",
            details: "Field size limit exceeded"
          });
        } else {
          return res.status(400).json({
            error: "File upload failed",
            details: err.message
          });
        }
      }
      next();
    });
  }, async (req, res) => {
    console.log("🚀 CIM UPLOAD ROUTE ACCESSED");
    console.log("=== INITIAL FINANCIAL DEBUG - UPLOAD ROUTE ===");
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Has financials:", !!req.body.financials);
    console.log("Raw financials:", req.body.financials);
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Add debugging for file sizes
      const uploadedFiles = req.files as Express.Multer.File[] || [];
      if (uploadedFiles.length > 0) {
        console.log("=== FILE UPLOAD DEBUG ===");
        uploadedFiles.forEach((file, index) => {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          console.log(`File ${index + 1}: ${file.originalname} - ${sizeMB}MB (${file.size} bytes)`);
        });
        
        // Check for files over 50MB and warn
        const largeFiles = uploadedFiles.filter(file => file.size > 50 * 1024 * 1024);
        if (largeFiles.length > 0) {
          console.log(`WARNING: ${largeFiles.length} file(s) over 50MB detected`);
          largeFiles.forEach(file => {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            console.log(`Large file: ${file.originalname} - ${sizeMB}MB`);
          });
        }
      }
      // For upload endpoint, files are optional (text-only generation is allowed)
      // Check if we have either uploaded files or just text content

      const files = uploadedFiles;
      const transcriptFile = files.find(file => file.fieldname === 'transcript');
      // PERF-006: Read transcript from disk instead of memory buffer
      const transcript = transcriptFile
        ? (await readFileFromDisk(transcriptFile)).toString('utf-8')
        : req.body.transcript;
      
      // Parse JSON fields from FormData strings before schema validation
      let parsedBody = { ...req.body };
      
      // Parse selectedImages from FormData string to array
      if (req.body.selectedImages && typeof req.body.selectedImages === 'string') {
        try {
          parsedBody.selectedImages = JSON.parse(req.body.selectedImages);
          console.log("Parsed selectedImages from FormData:", parsedBody.selectedImages);
        } catch (error) {
          console.error("Failed to parse selectedImages:", error);
          parsedBody.selectedImages = [];
        }
      }
      
      // Parse coverImagePosition from FormData string (it's already a JSON string, so keep it as string)
      if (req.body.coverImagePosition && typeof req.body.coverImagePosition === 'string') {
        // coverImagePosition should remain as string since schema expects text field
        parsedBody.coverImagePosition = req.body.coverImagePosition;
        console.log("Parsed coverImagePosition from FormData:", parsedBody.coverImagePosition);
      }
      
      // Parse sectionDirections from FormData string to array
      if (req.body.sectionDirections && typeof req.body.sectionDirections === 'string') {
        try {
          parsedBody.sectionDirections = JSON.parse(req.body.sectionDirections);
          console.log("Parsed sectionDirections from FormData:", parsedBody.sectionDirections);
        } catch (error) {
          console.error("Failed to parse sectionDirections:", error);
          parsedBody.sectionDirections = [];
        }
      }

      // Parse customStyleConfig from FormData string
      let customStyleConfig = null;
      if (req.body.customStyleConfig && typeof req.body.customStyleConfig === 'string') {
        try {
          customStyleConfig = JSON.parse(req.body.customStyleConfig);
          console.log("🎨 Custom style config parsed from FormData:", customStyleConfig?.toneDescription?.substring(0, 50));
        } catch (error) {
          console.error("Failed to parse customStyleConfig:", error);
        }
      }

      // Parse dealId from FormData string to number
      console.log("=== DEAL ASSOCIATION DEBUG (UPLOAD ROUTE) ===");
      console.log("Raw req.body.dealId:", req.body.dealId, "type:", typeof req.body.dealId);
      if (req.body.dealId && typeof req.body.dealId === 'string') {
        const parsedDealId = parseInt(req.body.dealId, 10);
        if (!isNaN(parsedDealId)) {
          parsedBody.dealId = parsedDealId;
          console.log("Successfully parsed dealId from FormData:", parsedBody.dealId);
        } else {
          console.log("Failed to parse dealId - NaN result");
        }
      } else if (req.body.dealId) {
        // Already a number
        parsedBody.dealId = req.body.dealId;
        console.log("dealId already a number:", parsedBody.dealId);
      } else {
        console.log("No dealId in request body");
      }

      // Debug: Log what we're sending to schema validation
      console.log("=== SCHEMA VALIDATION DEBUG ===");
      console.log("coverImagePosition type:", typeof parsedBody.coverImagePosition);
      console.log("coverImagePosition value:", parsedBody.coverImagePosition);
      console.log("Raw req.body.coverImagePosition:", req.body.coverImagePosition);
      console.log("Is coverImagePosition a string?", typeof parsedBody.coverImagePosition === 'string');
      
      const data = insertUploadedCimSchema.parse({
        ...parsedBody,
        transcript
      });

      // Debug: Check dealId survived schema validation
      console.log("=== POST SCHEMA VALIDATION ===");
      console.log("data.dealId after schema parse:", data.dealId, "type:", typeof data.dealId);

      // Debug: Check if selectedImages are present
      console.log("Selected images in request:", data.selectedImages);
      
      // Parse customizations from upload form
      const customizations = data.customizations || {};
      
      // Debug financial data in upload endpoint
      console.log("=== UPLOAD ENDPOINT FINANCIAL DEBUG ===");
      console.log("Raw financials from form:", req.body.financials);
      console.log("financialsEnabled from parsed data:", data.financialsEnabled);
      console.log("Type of req.body.financials:", typeof req.body.financials);
      console.log("Length of req.body.financials:", req.body.financials?.length);
      
      let parsedFinancials = null;
      if (req.body.financials) {
        try {
          parsedFinancials = JSON.parse(req.body.financials);
          console.log("Parsed financials successfully:", parsedFinancials);
          console.log("Parsed financials type:", typeof parsedFinancials);
          console.log("Parsed financials keys:", Object.keys(parsedFinancials));
          console.log("Individual values:");
          console.log("- enabled:", parsedFinancials.enabled, "(type:", typeof parsedFinancials.enabled, ")");
          console.log("- askingPrice:", parsedFinancials.askingPrice, "(type:", typeof parsedFinancials.askingPrice, ")");
          console.log("- revenue:", parsedFinancials.revenue, "(type:", typeof parsedFinancials.revenue, ")");
          console.log("- ebitda:", parsedFinancials.ebitda, "(type:", typeof parsedFinancials.ebitda, ")");
        } catch (e) {
          console.error("Failed to parse financials:", e);
          console.error("Raw value that failed to parse:", req.body.financials);
        }
      } else {
        // If no financials field in FormData, create default structure (always enabled)
        console.log("No financials field in FormData, creating default enabled structure");
        parsedFinancials = {
          enabled: true, // Always enabled
          askingPrice: '',
          revenue: '',
          ebitda: '',
          askingPriceIncluded: true,
          revenueIncluded: true,
          ebitdaIncluded: true
        };
        console.log("Using default financial structure:", parsedFinancials);
      }
      console.log("Customizations from upload:", customizations);

      console.log("Custom directions provided:", data.directions ? "Yes" : "No");
      if (data.directions) {
        console.log("Custom directions content:", data.directions);
      }
      
      // Validate website URL early if provided
      if (data.websiteUrl) {
        if (!isUrlSafeForFetch(data.websiteUrl.startsWith('http') ? data.websiteUrl : `https://${data.websiteUrl}`)) {
          console.error("Blocked unsafe website URL:", data.websiteUrl);
          return res.status(400).json({ error: "Invalid or blocked website URL" });
        }
      }

      // Extract financial data from request - use parsedFinancials from req.body.financials
      const financials = parsedFinancials;
      
      // Extract and process cover image data from request
      let coverImageUrl = req.body.coverImageUrl || data.coverImageUrl || null;
      const coverImagePosition = req.body.coverImagePosition || data.coverImagePosition || null;
      const coverImageAttribution = req.body.coverImageAttribution || data.coverImageAttribution || null;
      
      console.log("=== COVER IMAGE DEBUG ===");
      console.log("Cover image URL from form:", req.body.coverImageUrl);
      console.log("Cover image URL from data:", data.coverImageUrl);
      console.log("Final cover image URL:", coverImageUrl);
      console.log("Cover image position:", coverImagePosition);
      
      // Handle cover image upload and save to persistent storage
      if (coverImageUrl && coverImageUrl.startsWith('blob:')) {
        console.log("Processing blob cover image for persistent storage...");
        // Find the cover image file in uploaded files
        const coverImageFile = files.find(file => file.fieldname === 'coverImage' || file.fieldname === 'coverImageFile');
        if (coverImageFile) {
          try {
            // PERF-006: Read from disk instead of memory buffer
            const coverImageBuffer = await readFileFromDisk(coverImageFile);
            const coverImageMetadata = await imageManager.saveImageFromBuffer(
              coverImageBuffer,
              coverImageFile.originalname,
              coverImageFile.mimetype,
              req.user!.id,
              'business-images' // Store cover images with business images for persistence
            );
            coverImageUrl = coverImageMetadata.publicPath;
            console.log('Cover image saved to persistent storage:', coverImageMetadata.publicPath);
            // Clean up temp file after successful upload
            await cleanupTempFile(coverImageFile);
          } catch (saveError) {
            console.error('Failed to save cover image to persistent storage:', saveError);
            // Keep original URL as fallback
          }
        } else {
          console.warn('Cover image blob URL found but no corresponding file upload detected');
        }
      }
      
      // Handle external image URLs (e.g., Unsplash) by downloading and storing in object storage
      if (coverImageUrl && coverImageService.isExternalImageUrl(coverImageUrl)) {
        console.log("Processing external cover image URL for local storage...");
        try {
          const downloadResult = await coverImageService.downloadAndStoreImage(coverImageUrl, req.user!.id);
          coverImageUrl = downloadResult.publicUrl;
          console.log('External cover image downloaded and stored:', downloadResult.publicUrl);
        } catch (downloadError) {
          console.error('Failed to download external cover image:', downloadError);
          // Keep original URL as fallback - the image will still work but won't be locally stored
        }
      }
      
      console.log("Creating CIM document from upload with directions:", data.directions);
      console.log("Financial data for upload route:", parsedFinancials);
      
      // Debug: Log exactly what we're passing to createCimDocument
      console.log("=== FINANCIAL DATA DEBUG FOR STORAGE ===");
      console.log("parsedFinancials?.enabled:", parsedFinancials?.enabled);
      console.log("parsedFinancials?.askingPrice:", parsedFinancials?.askingPrice);
      console.log("parsedFinancials?.revenue:", parsedFinancials?.revenue);
      console.log("parsedFinancials?.ebitda:", parsedFinancials?.ebitda);
      console.log("Will set financialsEnabled to:", parsedFinancials?.enabled || false);
      console.log("Will set askingPrice to:", parsedFinancials?.askingPrice || null);
      console.log("Will set revenue to:", parsedFinancials?.revenue || null);
      console.log("Will set ebitda to:", parsedFinancials?.ebitda || null);
      
      // Handle financial files upload using object storage
      let uploadedFinancialFiles = [];
      const financialFileFields = files.filter(file => file.fieldname.startsWith('financialFile_'));

      console.log("Found financial files to upload:", financialFileFields.length);

      if (financialFileFields.length > 0) {
        for (const file of financialFileFields) {
          try {
            console.log(`Uploading financial file: ${file.originalname} (${file.size} bytes)`);
            // PERF-006: Read from disk instead of memory buffer
            const fileBuffer = await readFileFromDisk(file);
            const fileMetadata = await fileStorageManager.saveFileFromBuffer(
              fileBuffer,
              file.originalname,
              file.mimetype,
              req.user!.id,
              'financial-files'
            );

            uploadedFinancialFiles.push({
              fileName: fileMetadata.fileName,
              originalName: fileMetadata.originalName,
              filePath: fileMetadata.filePath, // This is the object storage key
              fileSize: fileMetadata.fileSize,
              mimeType: fileMetadata.mimeType,
              publicPath: fileMetadata.publicPath
            });

            console.log(`Financial file uploaded to object storage: ${fileMetadata.publicPath}`);
            // Clean up temp file after successful upload
            await cleanupTempFile(file);
          } catch (error) {
            console.error(`Failed to upload financial file ${file.originalname}:`, error);
            // Continue with other files even if one fails
          }
        }
        console.log("Uploaded financial files:", uploadedFinancialFiles.length);
      }
      
      // Extract and validate NDA settings from form data (JSON string)
      const ndaSettingsSchema = z.object({
        ndaProtected: z.boolean(),
        ndaTemplateId: z.coerce.number().nullable(),
        ndaApprovalRequired: z.boolean()
      }).refine(s => !s.ndaProtected || s.ndaTemplateId !== null, {
        message: 'Template required when NDA is enabled'
      });
      
      let ndaSettings = { ndaProtected: false, ndaTemplateId: null, ndaApprovalRequired: false };
      if (req.body.ndaSettings) {
        try {
          const parsedSettings = JSON.parse(req.body.ndaSettings);
          ndaSettings = ndaSettingsSchema.parse(parsedSettings);
        } catch (error) {
          console.error('Failed to parse or validate NDA settings:', error);
          // Keep default values on parsing/validation failure
        }
      } else {
      }
      
      // Generate automatic share link for new document
      const randomId = Math.random().toString(36).substring(2, 8);
      const shareSlug = `cim-${randomId}`;

      console.log("=== CREATING PLACEHOLDER DOCUMENT FOR BACKGROUND GENERATION (UPLOAD ROUTE) ===");

      // Create placeholder document with 'generating' status
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        transcript: transcript, // Use the parsed transcript
        directions: data.directions,
        sectionDirections: data.sectionDirections,
        formattingProfile: data.formattingProfile,
        websiteUrl: data.websiteUrl,
        logoUrl: null, // Will be populated by background generation
        analysis: { sections: [], title: data.title, generatingPlaceholder: true }, // Placeholder
        selectedImages: [],
        regenerationCount: 0,
        coverImageUrl,
        coverImagePosition,
        coverImageAttribution,
        financialsEnabled: true,
        askingPrice: parsedFinancials?.askingPrice || null,
        askingPriceIncluded: true,
        revenue: parsedFinancials?.revenue || null,
        revenueIncluded: true,
        ebitda: parsedFinancials?.ebitda || null,
        ebitdaIncluded: true,
        shareEnabled: true,
        shareSlug: shareSlug,
        sharePassword: null,
        shareExpiresAt: null,
        ndaProtected: ndaSettings.ndaProtected || false,
        ndaTemplateId: ndaSettings.ndaTemplateId || null,
        ndaApprovalRequired: ndaSettings.ndaApprovalRequired || false,
        dealId: data.dealId || null,
        // Background generation status fields
        generationStatus: 'generating',
        generationStartedAt: new Date(),
      });

      console.log(`[Background CIM] Created placeholder document ${doc.id} (upload route)`);

      // If dealId was provided, create a deal-document link (sync, fast operation)
      if (data.dealId) {
        const { dealDocuments } = await import('@shared/schema');
        const { db: dbDealDocs } = await import('./db');
        try {
          await dbDealDocs.insert(dealDocuments).values({
            dealId: data.dealId,
            cimDocumentId: doc.id,
          });
          console.log(`✅ Created deal-document link: deal ${data.dealId} -> CIM ${doc.id}`);
        } catch (linkError) {
          console.error('❌ Error creating deal-document link:', linkError);
        }
      }

      // Save financial files to database after document creation (sync, needs doc.id)
      if (uploadedFinancialFiles.length > 0) {
        console.log("Saving financial files to database for doc ID:", doc.id);
        for (const fileData of uploadedFinancialFiles) {
          await db.insert(financialFiles).values({
            cimDocumentId: doc.id,
            filename: fileData.originalName || fileData.fileName,
            filePath: fileData.filePath,
            fileSize: fileData.fileSize
          });
        }
        console.log("Financial files saved to database successfully");
      }

      // Return immediately with the document ID
      res.json({
        ...doc,
        generationStatus: 'generating',
        message: 'CIM generation started. You can safely navigate away while it completes.'
      });

      // Fire off background generation (don't await - fire and forget)
      // Pass the transcript since it was read from the file
      const backgroundData = { ...data, transcript, financials: parsedFinancials };
      generateCimInBackground(doc.id, req.user!.id, backgroundData, ndaSettings, customStyleConfig)
        .catch(err => console.error(`[Background CIM] Unhandled error for doc ${doc.id}:`, err));
    } catch (error) {
      console.error("File upload error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Upload existing CIM file endpoint
  app.post("/api/cim/upload-file", upload.array('cimFiles', 10), async (req, res) => {
    console.log("=== CIM FILE UPLOAD REQUEST ===");
    console.log("User authenticated:", req.isAuthenticated());
    console.log("Request body:", req.body);
    console.log("Files received:", req.files?.length || 0);
    
    if (!req.isAuthenticated()) {
      console.log("Authentication failed");
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        console.log("No files in request");
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { title, ndaSettings, dealId: rawDealId } = req.body;
      if (!title || title.trim() === '') {
        console.log("No title provided:", title);
        return res.status(400).json({ error: "Title is required" });
      }

      // Parse dealId from form data
      console.log("=== DEAL ASSOCIATION DEBUG (UPLOAD-FILE ROUTE) ===");
      console.log("Raw dealId from req.body:", rawDealId, "type:", typeof rawDealId);
      let dealId: number | null = null;
      if (rawDealId) {
        const parsed = typeof rawDealId === 'string' ? parseInt(rawDealId, 10) : rawDealId;
        if (!isNaN(parsed)) {
          dealId = parsed;
          console.log("Successfully parsed dealId:", dealId);
        }
      } else {
        console.log("No dealId in request body");
      }

      // Parse NDA settings if provided
      let parsedNdaSettings = null;
      if (ndaSettings) {
        try {
          parsedNdaSettings = typeof ndaSettings === 'string' ? JSON.parse(ndaSettings) : ndaSettings;
        } catch (error) {
          console.error("Failed to parse NDA settings:", error);
        }
      }

      // Validate file types
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      for (const file of files) {
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ error: `File "${file.originalname}" is not a supported type. Only PDF, DOCX, and TXT files are supported.` });
        }
      }

      // Create CIM document record first with NDA settings and deal association
      const cimDoc = await storage.createUploadedCimDocument(req.user!.id, {
        title: title.trim(),
        ndaSettings: parsedNdaSettings,
        dealId: dealId
      });

      console.log("=== DOCUMENT CREATED (UPLOAD-FILE ROUTE) ===");
      console.log("Doc ID:", cimDoc.id, "Doc dealId:", cimDoc.dealId);

      // If dealId was provided, create a deal-document link in junction table
      console.log("=== JUNCTION TABLE CHECK (UPLOAD-FILE ROUTE) ===");
      console.log("dealId for junction table:", dealId, "type:", typeof dealId, "truthy:", !!dealId);
      if (dealId) {
        const { dealDocuments } = await import('@shared/schema');
        try {
          console.log("Inserting into deal_documents:", { dealId, cimDocumentId: cimDoc.id });
          await db.insert(dealDocuments).values({
            dealId: dealId,
            cimDocumentId: cimDoc.id,
          });
          console.log(`✅ Successfully created deal-document link: deal ${dealId} -> CIM ${cimDoc.id}`);
        } catch (linkError) {
          console.error('❌ Error creating deal-document link:', linkError);
        }
      } else {
        console.log("No dealId provided, skipping junction table insert");
      }

      // Process and save each file to object storage
      const savedFiles = [];
      for (const file of files) {
        try {
          console.log(`Uploading CIM file: ${file.originalname} (${file.size} bytes)`);
          // PERF-006: Read from disk instead of memory buffer
          const fileBuffer = await readFileFromDisk(file);
          const fileMetadata = await fileStorageManager.saveFileFromBuffer(
            fileBuffer,
            file.originalname,
            file.mimetype,
            req.user!.id,
            'uploaded-cims'
          );

          // Store file record in uploadedFiles table
          const uploadedFile = await storage.createUploadedFile({
            cimDocumentId: cimDoc.id,
            fileName: file.originalname,
            filePath: fileMetadata.filePath, // Store object storage key
            fileSize: file.size,
            mimeType: file.mimetype
          });

          savedFiles.push(uploadedFile);
          console.log(`CIM file uploaded to object storage: ${fileMetadata.publicPath}`);
          // Clean up temp file after successful upload
          await cleanupTempFile(file);
        } catch (error) {
          console.error(`Failed to upload CIM file ${file.originalname}:`, error);
          // Continue with other files even if one fails
        }
      }

      console.log(`Successfully uploaded ${savedFiles.length} files for CIM ${cimDoc.id}`);

      res.json({
        id: cimDoc.id,
        title: cimDoc.title,
        filesUploaded: savedFiles.length,
        message: `CIM document with ${savedFiles.length} file(s) uploaded successfully`
      });

    } catch (error) {
      console.error("CIM file upload error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Create an external URL CIM (redirects to an external link while tracking views)
  app.post("/api/cim/external-url", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { title, externalUrl, dealId, ndaProtected, ndaTemplateId, ndaApprovalRequired } = req.body;

      if (!title || !externalUrl) {
        return res.status(400).json({ error: "Title and external URL are required" });
      }

      // Validate URL
      try {
        new URL(externalUrl);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Generate share slug
      const shareSlug = generateSecureToken().substring(0, 12);

      const cimDoc = await storage.createCimDocument(req.user!.id, {
        title,
        transcript: '',
        directions: '',
        analysis: { isUploadedFile: false, isExternalUrl: true },
        regenerationCount: 0,
        externalUrl,
        shareEnabled: true,
        shareSlug,
        ndaProtected: ndaProtected || false,
        ndaTemplateId: ndaTemplateId || null,
        ndaApprovalRequired: ndaApprovalRequired || false,
        dealId: dealId || null,
      });

      // Create deal-document link if dealId provided
      if (dealId) {
        const { dealDocuments } = await import("@shared/schema");
        await db.insert(dealDocuments).values({
          dealId,
          cimDocumentId: cimDoc.id,
        });
      }

      res.json({
        id: cimDoc.id,
        title: cimDoc.title,
        shareSlug: cimDoc.shareSlug,
        message: "External URL CIM created successfully"
      });
    } catch (error) {
      console.error("Error creating external URL CIM:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create document" });
    }
  });

  // Serve uploaded CIM files (authenticated)
  app.get("/api/cim/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Check if user owns the document or it's shared
      if (doc.userId !== req.user!.id && !doc.shareEnabled) {
        return res.status(403).json({ error: "You don't have permission to access this document" });
      }
      
      if (doc.isUploadedFile && doc.uploadedFilePath) {
        try {
          let fileBuffer;
          
          // Try object storage first (for migrated files)
          try {
            fileBuffer = await fileStorageManager.downloadFile(doc.uploadedFilePath);
          } catch (objectStorageError) {
            // Fallback to filesystem for legacy files
            try {
              await fs.access(doc.uploadedFilePath);
              fileBuffer = await fs.readFile(doc.uploadedFilePath);
              console.log("Served legacy file from filesystem:", doc.uploadedFilePath);
            } catch (fsError) {
              throw new Error("File not found in object storage or filesystem");
            }
          }
          
          // Set appropriate headers
          res.setHeader('Content-Type', doc.uploadedFileMimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${doc.uploadedFileName}"`);
          
          // Stream the file
          res.send(fileBuffer);
        } catch (fileError) {
          return res.status(404).json({ error: "File not found" });
        }
      } else {
        return res.status(400).json({ error: "This document is not an uploaded file" });
      }
    } catch (error) {
      console.error("File download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Get uploaded files for a shared CIM document (public endpoint)

  // Get financial files for a shared CIM document (public endpoint)

  // Download financial file from shared document (public endpoint)

  // Bulk download all financial files from shared document (public endpoint)

  // Download individual uploaded file from shared document

  // Download all files as ZIP from shared document

  app.get("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const search = req.query.search as string;
    const filters = req.query.filters ? (req.query.filters as string).split(',') : [];
    const dealId = req.query.dealId ? parseInt(req.query.dealId as string) : undefined;

    const result = await storage.getCimDocuments(req.user!.id, { page, limit, search, filters, dealId });
    res.json(result);
  });

  // Fast dashboard endpoint - minimal data for recent documents
  app.get("/api/dashboard/recent", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Get only the last 3 documents with minimal fields
      const results = await withRetry(async () => {
        return storage.getCimDocuments(req.user!.id, { limit: 3 });
      });
      
      // Return just the documents with minimal fields for dashboard
      const minimalDocs = results.documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        isUploadedFile: doc.isUploadedFile,
        uploadedFileName: doc.uploadedFileName
      }));

      res.json({ documents: minimalDocs });
    } catch (error) {
      console.error("Error fetching recent documents:", error);
      
      // Enhanced error response for timeout issues
      if (error instanceof Error && (error.message?.includes('timeout') || error.message?.includes('Connection terminated'))) {
        return res.status(503).json({ 
          message: "Database temporarily unavailable. Please try again.",
          error: "Service temporarily unavailable",
          timestamp: new Date().toISOString(),
          retry: true
        });
      }
      
      res.status(500).json({ error: "Failed to fetch recent documents" });
    }
  });

  // Check user document creation limits
  app.get("/api/user/limits", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const [canCreate, canRegenerate, user] = await Promise.all([
        withRetry(() => storage.checkUserLimit(req.user!.id)),
        withRetry(() => storage.checkRegenerationLimit(req.user!.id)),
        withRetry(() => storage.getUser(req.user!.id))
      ]);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const subscriptionStatus = user.subscriptionStatus || 'free';
      const plan = subscriptionPlans[subscriptionStatus as keyof typeof subscriptionPlans] || subscriptionPlans.free;
      
      res.json({
        canCreateDocument: canCreate,
        canRegenerate: canRegenerate,
        documentsCreated: user.monthlyDocumentsCreated || 0,
        documentLimit: plan.limit,
        regenerationsUsed: user.monthlyRegenerationsUsed || 0,
        regenerationLimit: plan.regenerationLimit,
        subscriptionStatus: subscriptionStatus
      });
    } catch (error) {
      console.error("Error checking user limits:", error);
      res.status(500).json({ error: "Failed to check limits" });
    }
  });

  // Get CIM generation status (for polling during background generation)
  app.get("/api/cim/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Return status information
      res.json({
        id: doc.id,
        title: doc.title,
        generationStatus: doc.generationStatus || 'ready', // Default to 'ready' for old docs
        generationError: doc.generationError || null,
        generationStartedAt: doc.generationStartedAt || null,
        // Include full document data if generation is complete
        ...(doc.generationStatus === 'ready' || !doc.generationStatus ? {
          analysis: doc.analysis,
          logoUrl: doc.logoUrl,
          selectedImages: doc.selectedImages,
        } : {}),
      });
    } catch (error) {
      console.error("Error fetching CIM status:", error);
      res.status(500).json({ error: "Failed to fetch document status" });
    }
  });

  // Cancel CIM generation (delete in-progress document)
  app.delete("/api/cim/:id/generation", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (doc.generationStatus !== 'generating') {
        return res.status(400).json({ error: "Document is not generating" });
      }

      // Delete the placeholder document
      await storage.deleteCimDocument(docId);

      res.json({ success: true, message: "Generation cancelled" });
    } catch (error) {
      console.error("Error cancelling CIM generation:", error);
      res.status(500).json({ error: "Failed to cancel generation" });
    }
  });

  // Get individual CIM document
  app.get("/api/cim/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check if user is owner, admin, or collaborator
      const isOwner = doc.userId === req.user!.id;
      const isAdmin = req.user!.isAdmin;
      const collaboration = await storage.getUserCollaboration(docId, req.user!.id);
      const isCollaborator = !!collaboration;

      if (!isOwner && !isAdmin && !isCollaborator) {
        return res.status(403).json({ error: "You don't have permission to view this document" });
      }
      
      
      // Transform field name for frontend consistency
      const transformedDoc = {
        ...doc,
        ndaApprovalRequired: doc.ndaApprovalRequired
      };
      
      res.json(transformedDoc);
    } catch (error) {
      console.error("Error fetching CIM document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });
  
  // Update CIM document (for financial and other field updates)
  app.patch("/api/cim/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    console.log("=== CIM PATCH REQUEST ===");
    // Security: Don't log user objects that may contain sensitive data
    console.log("Request user ID:", req.user?.id);
    console.log("Request body:", req.body);
    console.log("Request params:", req.params);

    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      // Check if document exists and belongs to user
      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check if user is owner, admin, or collaborator with Edit permission
      const isOwner = doc.userId === req.user!.id;
      const isAdmin = req.user!.isAdmin;
      const collaboration = await storage.getUserCollaboration(docId, req.user!.id);
      const hasEditAccess = collaboration?.permission === "Edit";

      if (!isOwner && !isAdmin && !hasEditAccess) {
        return res.status(403).json({ error: "You don't have permission to update this document" });
      }
      
      console.log("Updating CIM document with data:", req.body);
      const updatedDoc = await storage.updateCimDocument(docId, req.body);
      console.log("Updated CIM document:", updatedDoc);

      // Dispatch cim.updated event
      const cimUpdatedPayload = {
        cim_id: docId,
        title: updatedDoc.title,
        updated_fields: Object.keys(req.body),
        updated_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(doc.userId, 'cim.updated', cimUpdatedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(doc.userId, 'cim.updated', cimUpdatedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      // Transform field name for frontend consistency
      const transformedDoc = {
        ...updatedDoc,
        ndaApprovalRequired: updatedDoc.ndaApprovalRequired
      };

      res.json(transformedDoc);
    } catch (error) {
      console.error("CIM update error:", error);
      res.status(500).json({ error: "Failed to update document", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete a CIM document
  app.delete("/api/cim/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }
      
      // Check if document exists and belongs to user
      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (doc.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: "You don't have permission to delete this document" });
      }
      
      await storage.deleteCimDocument(docId);
      res.json({ success: true });
    } catch (error) {
      console.error("Document deletion error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Duplicate a CIM document
  app.post("/api/cim/:id/duplicate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const docId = parseInt(req.params.id);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }
      
      // Check user limits before creating duplicate
      const canCreate = await storage.checkUserLimit(req.user!.id);
      if (!canCreate) {
        const user = await storage.getUser(req.user!.id);
        const subscriptionStatus = user?.subscriptionStatus || 'free';
        const plan = subscriptionPlans[subscriptionStatus as keyof typeof subscriptionPlans] || subscriptionPlans.free;
        
        return res.status(403).json({ 
          error: `Cannot duplicate document - you've reached your limit of ${plan.limit} documents for your ${subscriptionStatus} subscription.`,
          upgradeRequired: true,
          currentLimit: plan.limit,
          currentCount: user?.monthlyDocumentsCreated || 0
        });
      }
      
      // Check if document exists and user has access
      const originalDoc = await storage.getCimDocument(docId);
      if (!originalDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (originalDoc.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: "You don't have permission to duplicate this document" });
      }
      
      // Create duplicate with modified title and reset sharing/security settings
      const duplicateData = {
        ...originalDoc,
        title: `${originalDoc.title} (Copy)`,
        shareEnabled: false, // Reset sharing settings
        shareSlug: null,
        customSlug: null,
        sharePassword: null,
        shareExpiresAt: null,
        shareViewCount: 0,
        ndaProtected: false, // Reset NDA settings for safety
        ndaTemplateId: null,
        ndaApprovalRequired: false
      };
      
      // Remove fields that shouldn't be duplicated
      delete (duplicateData as any).id;
      delete (duplicateData as any).createdAt;
      delete (duplicateData as any).updatedAt;
      
      const duplicatedDoc = await storage.createCimDocument(req.user!.id, duplicateData);
      
      console.log("Document duplicated successfully:", {
        originalId: docId,
        duplicatedId: duplicatedDoc.id,
        originalTitle: originalDoc.title,
        duplicatedTitle: duplicatedDoc.title
      });
      
      res.json(duplicatedDoc);
    } catch (error) {
      console.error("Document duplication error:", error);
      res.status(500).json({ error: "Failed to duplicate document" });
    }
  });

  // Update CIM document content (for inline editing)
  app.put("/api/cim/:id/content", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const docId = parseInt(req.params.id);
    const { editedContent } = req.body;
    
    const doc = await storage.getCimDocument(docId);
    if (!doc || doc.userId !== req.user!.id) {
      return res.sendStatus(404);
    }

    try {
      const updatedDoc = await storage.updateCimDocumentContent(docId, editedContent);
      // Transform field name for frontend consistency
      const transformedDoc = {
        ...updatedDoc,
        ndaApprovalRequired: updatedDoc.ndaApprovalRequired
      };
      res.json(transformedDoc);
    } catch (error) {
      console.error("Error updating CIM content:", error);
      res.status(500).json({ error: "Failed to update content" });
    }
  });

  // Website images extraction endpoint
  app.get("/api/website-images/:websiteUrl", async (req, res) => {
    try {
      const websiteUrl = decodeURIComponent(req.params.websiteUrl);
      console.log(`Image extraction request for: ${websiteUrl}`);

      // Validate URL before processing to prevent SSRF attacks
      if (!isUrlSafeForFetch(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)) {
        console.error("Blocked unsafe website URL for image extraction:", websiteUrl);
        return res.status(400).json({ error: "Invalid or blocked website URL" });
      }

      const imageUrls = await extractWebsiteImages(websiteUrl);
      
      // Check if no images were extracted and provide helpful message
      if (imageUrls.length === 0) {
        res.json({ 
          images: [], 
          message: "No images could be extracted. This website may be protected by Cloudflare or other security measures that block automated requests." 
        });
      } else {
        res.json({ images: imageUrls });
      }
    } catch (error) {
      console.error("Error extracting website images:", error);
      res.status(500).json({ 
        error: "Failed to extract website images",
        message: "This website may be protected by security measures that prevent automated image extraction." 
      });
    }
  });

  // Download selected images endpoint
  app.post("/api/download-images", async (req, res) => {
    try {
      const { imageUrls, websiteUrl } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls) || !websiteUrl) {
        return res.status(400).json({ error: "imageUrls array and websiteUrl are required" });
      }

      // Validate all image URLs before processing to prevent SSRF attacks
      for (const imageUrl of imageUrls) {
        if (!isUrlSafeForFetch(imageUrl)) {
          console.error("Blocked unsafe image URL:", imageUrl);
          return res.status(400).json({ error: "Invalid or blocked image URL" });
        }
      }

      console.log(`Downloading ${imageUrls.length} images for: ${websiteUrl}`);

      const savedPaths = await downloadSelectedImages(imageUrls, websiteUrl);

      res.json({ savedPaths });
    } catch (error) {
      console.error("Error downloading images:", error);
      res.status(500).json({ error: "Failed to download selected images" });
    }
  });


  // Custom sections routes
  app.get("/api/cim/:id/custom-sections", async (req, res) => {
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);

      if (!cim) {
        return res.sendStatus(404);
      }

      // Check if user owns the document or it's publicly shared
      if (!req.isAuthenticated() || (cim.userId !== req.user.id && !cim.shareEnabled)) {
        return res.sendStatus(403);
      }

      const sections = await storage.getCustomSections(cimId);
      res.json(sections);
    } catch (error) {
      console.error("Error getting custom sections:", error);
      res.status(500).json({ message: "Failed to get custom sections" });
    }
  });

  // Create custom section (updated to support both text and image types)
  app.post("/api/cim/:id/custom-sections", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      const { title, content, type, imageUrls, insertAfterSection } = req.body;
      
      const section = await storage.createCustomSection({
        cimDocumentId: cimId,
        type: type || 'text',
        title: title,
        content: content,
        imageUrls: imageUrls,
        insertAfterSection: insertAfterSection
      });

      res.json(section);
    } catch (error) {
      console.error("Error creating custom section:", error);
      res.status(500).json({ message: "Failed to create custom section" });
    }
  });

  app.post("/api/cim/:id/custom-section/text", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      const { content, afterSection } = req.body;
      
      const section = await storage.createCustomSection({
        cimDocumentId: cimId,
        type: 'text',
        title: 'Custom Text Section',
        content: content || 'Click to edit this text section...',
        insertAfterSection: afterSection || 'end'
      });

      res.json(section);
    } catch (error) {
      console.error("Error creating text section:", error);
      res.status(500).json({ message: "Failed to create text section" });
    }
  });

  app.post("/api/cim/:id/custom-section/image", upload.array('images', 10), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);

      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No image files provided" });
      }

      const { afterSection } = req.body;

      // Process and save all images using object storage for consistency
      const imageUrls: string[] = [];

      for (const file of req.files) {
        try {
          // Use object storage image manager for consistency with other images
          const metadata = await objectStorageImageManager.saveImageFromBuffer(
            file.buffer,
            file.originalname,
            file.mimetype,
            req.user!.id,
            'business-images', // Store custom section images with business images for persistence
            { optimize: true, maxWidth: 800, maxHeight: 600 }
          );

          imageUrls.push(metadata.publicPath);
          console.log('Custom section image saved to object storage:', metadata.publicPath);
        } catch (imageError) {
          console.error('Failed to save custom section image to persistent storage:', imageError);
          // Continue with other images instead of failing completely
        }
      }

      // Only create custom section if at least one image was successfully processed
      if (imageUrls.length === 0) {
        return res.status(400).json({ message: "No images could be processed successfully" });
      }

      const section = await storage.createCustomSection({
        cimDocumentId: cimId,
        type: 'image',
        title: 'Custom Image Section',
        imageUrls,
        insertAfterSection: afterSection || 'end'
      });

      res.json(section);
    } catch (error) {
      console.error("Error creating image section:", error);
      res.status(500).json({ message: "Failed to create image section" });
    }
  });

  app.post("/api/cim/:id/custom-section/html", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);

      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      const { content, customCss, afterSection } = req.body;

      const section = await storage.createCustomSection({
        cimDocumentId: cimId,
        type: 'html',
        title: 'Custom HTML Section',
        content: content || '<!-- Add your HTML here -->',
        customCss: customCss || '',
        insertAfterSection: afterSection || 'end'
      });

      res.json(section);
    } catch (error) {
      console.error("Error creating HTML section:", error);
      res.status(500).json({ message: "Failed to create HTML section" });
    }
  });

  // Create table section
  app.post("/api/cim/:id/custom-section/table", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);

      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      const { title, content, afterSection } = req.body;

      // Validate that content is valid JSON table data
      try {
        const tableData = JSON.parse(content);
        if (!tableData.headers || !tableData.rows || !tableData.settings) {
          return res.status(400).json({ message: "Invalid table data structure" });
        }
      } catch (e) {
        return res.status(400).json({ message: "Invalid JSON table data" });
      }

      const section = await storage.createCustomSection({
        cimDocumentId: cimId,
        type: 'table',
        title: title || 'Table',
        content: content,
        insertAfterSection: afterSection || 'end'
      });

      res.json(section);
    } catch (error) {
      console.error("Error creating table section:", error);
      res.status(500).json({ message: "Failed to create table section" });
    }
  });

  app.put("/api/custom-section/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const sectionId = parseInt(req.params.id);
      const { title, content, customCss } = req.body;

      // Get the section to check its type and associated document
      const section = await storage.getCustomSectionById(sectionId);
      if (!section) {
        return res.status(404).json({ message: "Custom section not found" });
      }

      // Get the CIM document to verify ownership
      const cim = await storage.getCimDocument(section.cimDocumentId);
      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(403);
      }

      // Validate HTML sections against CSP
      if (section.type === 'html' && content) {
        const { validateAgainstCSP, formatViolationsForEmail } = await import('./csp-validator.js');
        const validationResult = validateAgainstCSP(content, customCss || '');

        if (!validationResult.isValid) {
          // Send notification to admin
          const { sendCspViolationEmail } = await import('./email.js');
          const violationsText = formatViolationsForEmail(validationResult.violations);

          await sendCspViolationEmail({
            userEmail: req.user.email,
            userName: req.user.fullName || req.user.email,
            documentId: cim.id,
            documentTitle: cim.title || 'Untitled Document',
            htmlCode: content,
            cssCode: customCss || '',
            violations: violationsText
          });

          // Return error to user with helpful message
          return res.status(400).json({
            error: 'csp_violation',
            message: 'Your HTML code contains external resources that are not currently whitelisted in our security policy.',
            violations: validationResult.violations,
            supportNotified: true
          });
        }
      }

      await storage.updateCustomSection(sectionId, { title, content, customCss });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating custom section:", error);
      res.status(500).json({ message: "Failed to update custom section" });
    }
  });

  app.get("/api/cim/:id/custom-sections", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      const customSections = await storage.getCustomSections(cimId);
      res.json(customSections);
    } catch (error) {
      console.error("Error fetching custom sections:", error);
      res.status(500).json({ message: "Failed to fetch custom sections" });
    }
  });

  app.delete("/api/custom-section/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const sectionId = parseInt(req.params.id);
      await storage.deleteCustomSection(sectionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom section:", error);
      res.status(500).json({ message: "Failed to delete custom section" });
    }
  });

  app.put("/api/cim/:id/custom-sections/reorder", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      const { sections } = req.body;
      await storage.reorderCustomSections(sections);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering custom sections:", error);
      res.status(500).json({ message: "Failed to reorder custom sections" });
    }
  });

  // CIM Share Settings
  // Get share settings endpoint
  app.get("/api/cim/:id/share-settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({
        shareSlug: doc.shareSlug,
        customSlug: doc.customSlug,
        isPublic: doc.shareEnabled,
        requireNda: doc.ndaProtected,
        password: doc.sharePassword,
        expiresAt: doc.shareExpiresAt,
        viewCount: doc.shareViewCount,
        ndaProtected: doc.ndaProtected,
        ndaTemplateId: doc.ndaTemplateId,
        ndaApprovalRequired: doc.ndaApprovalRequired,
        copyMeOnEmails: doc.copyMeOnEmails
      });
    } catch (error) {
      console.error("Error fetching share settings:", error);
      res.status(500).json({ error: "Failed to fetch share settings" });
    }
  });

  // Update share settings endpoint
  app.patch("/api/cim/:id/share-settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const { isPublic, requireNda, password, expiresAt, customSlug, ndaProtected, ndaTemplateId, ndaApprovalRequired, copyMeOnEmails } = req.body;
      
      // Generate share slug if enabling sharing and no slug exists
      let shareSlug = doc.shareSlug;
      if (isPublic && !shareSlug) {
        shareSlug = Math.random().toString(36).substring(2, 15);
      }

      // Validate custom slug if provided
      let validatedCustomSlug = customSlug;
      if (customSlug && customSlug.trim()) {
        // Basic validation for custom slug
        const slugRegex = /^[a-zA-Z0-9-_]+$/;
        if (!slugRegex.test(customSlug.trim())) {
          return res.status(400).json({ error: "Custom URL can only contain letters, numbers, hyphens, and underscores" });
        }
        validatedCustomSlug = customSlug.trim();
      } else {
        validatedCustomSlug = null;
      }

      // Check if custom slug is already taken by another document
      if (validatedCustomSlug) {
        const existingDoc = await storage.getCimByShareSlug(validatedCustomSlug);
        if (existingDoc && existingDoc.id !== docId) {
          return res.status(400).json({ error: "This custom URL is already taken. Please choose a different one." });
        }
      }

      // Hash the password before storing if provided
      let hashedPassword: string | null | undefined = password;
      if (password && password.trim()) {
        hashedPassword = await hashSharePassword(password);
      } else if (password === '' || password === null) {
        hashedPassword = null;
      }

      const updatedDoc = await storage.updateCimShareSettings(docId, {
        shareEnabled: isPublic,
        shareSlug: shareSlug || undefined,
        customSlug: validatedCustomSlug,
        sharePassword: hashedPassword,
        shareExpiresAt: expiresAt,
        ndaProtected: ndaProtected !== undefined ? ndaProtected : requireNda,
        ndaTemplateId: ndaTemplateId !== undefined ? ndaTemplateId : doc.ndaTemplateId,
        ndaApprovalRequired: ndaApprovalRequired !== undefined ? ndaApprovalRequired : doc.ndaApprovalRequired,
        copyMeOnEmails: copyMeOnEmails !== undefined ? copyMeOnEmails : doc.copyMeOnEmails
      });

      // Dispatch cim.published event when document is made public
      if (isPublic && !doc.shareEnabled) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const shareUrl = updatedDoc.customSlug
          ? `${baseUrl}/share/${updatedDoc.customSlug}`
          : `${baseUrl}/share/${updatedDoc.shareSlug}`;

        const cimPublishedPayload = {
          cim_id: docId,
          title: doc.title,
          share_url: shareUrl,
          share_slug: updatedDoc.shareSlug,
          custom_slug: updatedDoc.customSlug,
          nda_protected: updatedDoc.ndaProtected,
          published_at: new Date().toISOString(),
        };
        dispatchIntegrationEvent(req.user!.id, 'cim.published', cimPublishedPayload)
          .catch(err => console.error('Integration dispatch error:', err));
        dispatchWebhookEvent(req.user!.id, 'cim.published', cimPublishedPayload)
          .catch(err => console.error('Webhook dispatch error:', err));
      }

      res.json({
        shareSlug: updatedDoc.shareSlug,
        customSlug: updatedDoc.customSlug,
        isPublic: updatedDoc.shareEnabled,
        requireNda: updatedDoc.ndaProtected,
        password: updatedDoc.sharePassword,
        expiresAt: updatedDoc.shareExpiresAt,
        viewCount: updatedDoc.shareViewCount,
        ndaProtected: updatedDoc.ndaProtected,
        ndaTemplateId: updatedDoc.ndaTemplateId,
        ndaApprovalRequired: updatedDoc.ndaApprovalRequired,
        copyMeOnEmails: updatedDoc.copyMeOnEmails
      });
    } catch (error) {
      console.error("Error updating share settings:", error);
      
      // Handle duplicate key constraint violation
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('cim_documents_custom_slug_key')) {
          return res.status(400).json({ error: "This custom URL is already taken. Please choose a different one." });
        }
        if (error.message.includes('cim_documents_share_slug_key')) {
          return res.status(400).json({ error: "Share slug conflict. Please try again." });
        }
      }
      
      res.status(500).json({ error: "Failed to update share settings" });
    }
  });

  // Regenerate share slug endpoint
  app.post("/api/cim/:id/regenerate-share-slug", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const newSlug = Math.random().toString(36).substring(2, 15);
      
      const updatedDoc = await storage.updateCimShareSettings(docId, {
        shareEnabled: doc.shareEnabled,
        shareSlug: newSlug,
        customSlug: null,
        sharePassword: doc.sharePassword,
        shareExpiresAt: doc.shareExpiresAt,
        ndaProtected: doc.ndaProtected,
        ndaTemplateId: doc.ndaTemplateId
      });

      res.json({
        shareSlug: updatedDoc.shareSlug,
        isPublic: updatedDoc.shareEnabled,
        requireNda: updatedDoc.ndaProtected,
        password: updatedDoc.sharePassword,
        expiresAt: updatedDoc.shareExpiresAt,
        viewCount: updatedDoc.shareViewCount
      });
    } catch (error) {
      console.error("Error regenerating share slug:", error);
      res.status(500).json({ error: "Failed to regenerate share slug" });
    }
  });

  // Share settings endpoint (legacy)
  app.post("/api/cim/:id/share", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Share endpoint: User not authenticated");
      return res.sendStatus(401);
    }

    try {
      const docId = parseInt(req.params.id);
      const { shareEnabled, shareSlug, customSlug, sharePassword, shareExpiresAt, ndaProtected, ndaTemplateId } = req.body;


      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        console.log("Document not found:", docId);
        return res.status(404).json({ error: "Document not found" });
      }

      if (doc.userId !== req.user!.id) {
        console.log("Document access denied:", { docUserId: doc.userId, requestUserId: req.user!.id });
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate custom slug if provided
      let validatedCustomSlug = customSlug;
      if (customSlug && customSlug.trim()) {
        // Basic validation for custom slug - only allow lowercase letters, numbers, and hyphens
        const slugRegex = /^[a-z0-9-]+$/;
        const trimmedSlug = customSlug.trim().toLowerCase();
        if (!slugRegex.test(trimmedSlug)) {
          return res.status(400).json({ error: "Custom URL can only contain lowercase letters, numbers, and hyphens" });
        }
        validatedCustomSlug = trimmedSlug;

        // Check if custom slug is already taken by another document
        const existingDoc = await storage.getCimByShareSlug(validatedCustomSlug);
        if (existingDoc && existingDoc.id !== docId) {
          return res.status(400).json({ error: "This custom URL is already taken. Please choose a different one." });
        }
      } else {
        validatedCustomSlug = null;
      }

      // Hash the password before storing if provided
      let hashedPassword: string | null | undefined = sharePassword;
      if (sharePassword && sharePassword.trim()) {
        hashedPassword = await hashSharePassword(sharePassword);
      } else if (sharePassword === '' || sharePassword === null) {
        hashedPassword = null;
      }

      const updatedDoc = await storage.updateCimShareSettings(docId, {
        shareEnabled,
        shareSlug,
        customSlug: validatedCustomSlug,
        sharePassword: hashedPassword,
        shareExpiresAt,
        ndaProtected,
        ndaTemplateId
      });

      console.log("Share settings updated successfully:", updatedDoc.shareSlug, "customSlug:", updatedDoc.customSlug);

      res.json({
        shareEnabled: updatedDoc.shareEnabled,
        shareSlug: updatedDoc.shareSlug,
        customSlug: updatedDoc.customSlug,
        viewCount: updatedDoc.shareViewCount,
        ndaProtected: updatedDoc.ndaProtected,
        ndaTemplateId: updatedDoc.ndaTemplateId,
        ndaApprovalRequired: updatedDoc.ndaApprovalRequired
      });
    } catch (error: any) {
      console.error("Error updating share settings:", error);

      // Handle duplicate key constraint violation
      if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('cim_documents_custom_slug_key')) {
          return res.status(400).json({ error: "This custom URL is already taken. Please choose a different one." });
        }
      }

      res.status(500).json({ error: `Failed to update share settings: ${error.message}` });
    }
  });

  // CIM Uploaded Files and Financial Files
  // Get uploaded files for a CIM document (authenticated)
  app.get("/api/cim/:id/uploaded-files", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const files = await storage.getUploadedFiles(cimId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
      res.status(500).json({ error: "Failed to fetch uploaded files" });
    }
  });

  // Upload additional files to existing CIM (authenticated)
  app.post("/api/cim/:id/upload-more-files", upload.array('cimFiles', 10), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const savedFiles = [];
      
      for (const file of files) {
        try {
          console.log(`Uploading additional CIM file: ${file.originalname} (${file.size} bytes)`);
          const fileMetadata = await fileStorageManager.saveFileFromBuffer(
            file.buffer,
            file.originalname,
            file.mimetype,
            req.user!.id,
            'uploaded-cims'
          );

          const uploadedFile = await storage.createUploadedFile({
            cimDocumentId: cimId,
            fileName: file.originalname,
            filePath: fileMetadata.filePath, // Store object storage key
            fileSize: file.size,
            mimeType: file.mimetype
          });

          savedFiles.push(uploadedFile);
          console.log(`Additional CIM file uploaded to object storage: ${fileMetadata.publicPath}`);
        } catch (error) {
          console.error(`Failed to upload additional CIM file ${file.originalname}:`, error);
          // Continue with other files even if one fails
        }
      }

      res.json({
        success: true,
        filesUploaded: savedFiles.length,
        files: savedFiles
      });
    } catch (error) {
      console.error('Error uploading additional files:', error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  // Download individual uploaded file (authenticated)
  app.get("/api/cim/:id/download/:fileId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);
      
      const cim = await storage.getCimDocument(cimId);
      if (!cim || cim.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const files = await storage.getUploadedFiles(cimId);
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      try {
        let fileBuffer;
        
        // Try object storage first (for migrated files)
        try {
          fileBuffer = await fileStorageManager.downloadFile(file.filePath);
        } catch (objectStorageError) {
          // Fallback to filesystem for legacy files
          try {
            fileBuffer = await fs.readFile(file.filePath);
            console.log("Served legacy uploaded file from filesystem:", file.filePath);
          } catch (fsError) {
            throw new Error("File not found in object storage or filesystem");
          }
        }
        
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
        res.send(fileBuffer);
      } catch (error) {
        console.error("Error reading file:", error);
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error('Error downloading uploaded file:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Delete uploaded file (authenticated)
  app.delete("/api/cim/:id/uploaded-files/:fileId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);
      
      const cim = await storage.getCimDocument(cimId);
      if (!cim || cim.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const files = await storage.getUploadedFiles(cimId);
      const file = files.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Delete file from object storage (try object storage first, then filesystem for legacy)
      try {
        await fileStorageManager.deleteFile(file.filePath);
      } catch (objectStorageError) {
        // Try filesystem for legacy files
        try {
          await fs.unlink(file.filePath);
          console.log("Deleted legacy file from filesystem:", file.filePath);
        } catch (fsError) {
          console.warn("Could not delete file from object storage or filesystem:", fsError);
        }
      }
      
      // Delete from database
      await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting uploaded file:', error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Get financial files for a CIM document
  app.get("/api/cim/:id/financial-files", async (req, res) => {
    console.log("=== FINANCIAL FILES GET REQUEST ===");
    console.log("Request params:", req.params);
    
    try {
      const cimId = parseInt(req.params.id);
      console.log("Parsed CIM ID:", cimId);
      
      const files = await db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, cimId));
      console.log("Found financial files:", files.length, "files");
      
      res.json(files);
    } catch (error) {
      console.error('Error fetching financial files - Full error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      res.status(500).json({ error: "Failed to fetch financial files", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Upload financial file
  app.post("/api/cim/:id/financial-files", upload.single('file'), async (req, res) => {
    console.log("=== FINANCIAL FILE UPLOAD START ===");
    
    if (!req.user) {
      console.log("Upload failed: Not authenticated");
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cimId = parseInt(req.params.id);
      const file = req.file;
      
      console.log("Upload request - CIM ID:", cimId);
      console.log("File received:", file ? {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        bufferSize: file.buffer?.length
      } : "No file");

      if (!file) {
        console.log("Upload failed: No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check if CIM belongs to user
      const cim = await storage.getCimDocument(cimId);
      if (!cim || cim.userId !== req.user.id) {
        console.log("Upload failed: Not authorized - CIM userId:", cim?.userId, "Request userId:", req.user.id);
        return res.status(403).json({ error: "Not authorized" });
      }

      // Upload file to object storage
      console.log("Uploading file to object storage...");
      const fileMetadata = await fileStorageManager.saveFileFromBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        req.user.id,
        'financial-files'
      );
      
      console.log("File uploaded to object storage:", fileMetadata.publicPath);
      console.log("File storage key:", fileMetadata.filePath);

      // Save file record to database with original filename for display
      const [fileRecord] = await db
        .insert(financialFiles)
        .values({
          cimDocumentId: cimId,
          filename: file.originalname, // Store original filename for display
          filePath: fileMetadata.filePath, // Store object storage key
          fileSize: file.size
        })
        .returning();

      console.log("Database record created:", fileRecord);
      console.log("=== FINANCIAL FILE UPLOAD SUCCESS ===");

      res.json(fileRecord);
    } catch (error) {
      console.error('=== FINANCIAL FILE UPLOAD ERROR ===');
      console.error('Error uploading financial file:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Download financial file
  app.get("/api/cim/:id/financial-files/:fileId/download", async (req, res) => {
    try {
      const cimId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);

      // Get file record
      const [file] = await db.select().from(financialFiles).where(eq(financialFiles.id, fileId));
      
      if (!file || file.cimDocumentId !== cimId) {
        return res.status(404).json({ error: "File not found" });
      }

      // Download file from object storage
      try {
        const fileBuffer = await fileStorageManager.downloadFile(file.filePath);
        
        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Send the file buffer
        res.send(fileBuffer);
      } catch (downloadError) {
        console.error('Error downloading file from object storage:', downloadError);
        return res.status(404).json({ error: "File not found in storage" });
      }
    } catch (error) {
      console.error('Error downloading financial file:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // CORS preflight handler for object storage
  app.options("/api/object-storage/*", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.status(200).end();
  });

  // Serve object storage images endpoint
  app.get("/api/object-storage/*", async (req, res) => {
    try {
      // Extract the storage key from the URL path
      const storageKey = req.params[0]; // Everything after /api/object-storage/
      
      if (!storageKey) {
        return res.status(400).json({ error: "No storage key provided" });
      }
      
      console.log(`Serving object storage file: ${storageKey}`);

      // Download file from object storage
      const fileBuffer = await objectStorage.downloadBuffer(storageKey);
      
      // Determine content type from file extension
      const extension = path.extname(storageKey).toLowerCase();
      const contentTypeMap: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };

      const contentType = contentTypeMap[extension] || 'application/octet-stream';

      // Set headers for file serving
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('ETag', `"${storageKey}"`);

      // Add explicit CORS headers for cross-origin loading
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', '*');

      // For PDFs and documents, set Content-Disposition for better download experience
      if (extension === '.pdf' || extension === '.doc' || extension === '.docx') {
        const filename = path.basename(storageKey);
        // Use inline disposition so it opens in browser, but with filename hint
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      }

      // Send the file buffer
      res.send(fileBuffer);
    } catch (error) {
      console.error(`Error serving object storage file:`, error);
      res.status(404).json({ error: "File not found" });
    }
  });

  // Note: File inclusion status removed since database doesn't support this feature

  // Delete financial file
  app.delete("/api/cim/:id/financial-files/:fileId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cimId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);

      // Check if CIM belongs to user
      const cim = await storage.getCimDocument(cimId);
      if (!cim || cim.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get file record to delete physical file
      const [file] = await db.select().from(financialFiles).where(eq(financialFiles.id, fileId));
      
      if (file) {
        // Delete file from object storage
        try {
          await fileStorageManager.deleteFile(file.filePath);
        } catch (error) {
          console.error('Error deleting file from object storage:', error);
        }

        // Delete database record
        await db.delete(financialFiles).where(eq(financialFiles.id, fileId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting financial file:', error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Bulk download financial files
  app.get("/api/cim/:id/financial-files/bulk-download", async (req, res) => {
    try {
      const cimId = parseInt(req.params.id);
      
      // Get all files (no inclusion filter since column doesn't exist)
      const files = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.cimDocumentId, cimId));

      if (files.length === 0) {
        return res.status(404).json({ error: "No files available for download" });
      }

      // For simplicity, we'll zip the files using a basic approach
      // In production, you might want to use a proper ZIP library
      const zip = new JSZip();

      for (const file of files) {
        try {
          const fileContent = await fileStorageManager.downloadFile(file.filePath);
          zip.file(file.filename, fileContent);
        } catch (error) {
          console.error(`Error downloading file ${file.filename} from object storage:`, error);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="financial-documents-${cimId}.zip"`);
      res.send(zipBuffer);

    } catch (error) {
      console.error('Error creating bulk download:', error);
      res.status(500).json({ error: "Failed to create bulk download" });
    }
  });

  // Cover Image Management API
  app.post("/api/cim/:id/cover-image", upload.single('coverImage'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const { coverImageUrl, coverImagePosition, coverImageAttribution } = req.body;
      
      // Verify document ownership
      const document = await storage.getCimDocument(cimId);
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      let finalCoverImageUrl = coverImageUrl;
      
      // Handle file upload if present - save to persistent storage
      if (req.file) {
        try {
          // Use persistent image storage instead of ephemeral uploads directory
          const coverImageMetadata = await imageManager.saveImageFromBuffer(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.user!.id,
            'business-images' // Store cover images with business images for persistence
          );
          finalCoverImageUrl = coverImageMetadata.publicPath;
          console.log('Cover image saved to persistent storage:', coverImageMetadata.publicPath);
        } catch (saveError) {
          console.error('Failed to save cover image to persistent storage:', saveError);
          return res.status(500).json({ error: "Failed to save cover image" });
        }
      }
      
      // Handle external image URLs (e.g., Unsplash) by downloading and storing in object storage
      if (finalCoverImageUrl && coverImageService.isExternalImageUrl(finalCoverImageUrl)) {
        console.log("Processing external cover image URL for local storage...");
        try {
          const downloadResult = await coverImageService.downloadAndStoreImage(finalCoverImageUrl, req.user!.id);
          finalCoverImageUrl = downloadResult.publicUrl;
          console.log('External cover image downloaded and stored:', downloadResult.publicUrl);
        } catch (downloadError) {
          console.error('Failed to download external cover image:', downloadError);
          // Keep original URL as fallback - the image will still work but won't be locally stored
        }
      }
      
      // Update the CIM document with cover image data
      const updatedDoc = await storage.updateCimDocument(cimId, {
        coverImageUrl: finalCoverImageUrl,
        coverImagePosition: coverImagePosition || null,
        coverImageAttribution: coverImageAttribution || null
      });
      
      res.json(updatedDoc);
    } catch (error) {
      console.error('Error updating cover image:', error);
      res.status(500).json({ error: "Failed to update cover image" });
    }
  });

  app.delete("/api/cim/:id/cover-image", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      
      // Verify document ownership
      const document = await storage.getCimDocument(cimId);
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Remove cover image data
      const updatedDoc = await storage.updateCimDocument(cimId, {
        coverImageUrl: null,
        coverImagePosition: null,
        coverImageAttribution: null
      });
      
      res.json(updatedDoc);
    } catch (error) {
      console.error('Error removing cover image:', error);
      res.status(500).json({ error: "Failed to remove cover image" });
    }
  });

  // Register message center routes
  app.use('/api/messages', messageRoutes);
  app.use('/api/messages', messageAttachmentRoutes);
  
  // Register webhook routes
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/incoming-webhooks', incomingWebhookRoutes);

  // Register integration routes
  console.log('📦 Registering integration routes at /api/integrations');
  app.use('/api/integrations', integrationRoutes);
  console.log('✅ Integration routes registered');

  // Register teaser routes
  app.use('/api/teasers', teaserRoutes);

  // Register listings routes
  app.use('/api/listings', listingsRoutes);

  // Register CRM routes
  console.log('📦 Registering CRM routes at /api/crm');
  app.use('/api/crm', crmRoutes);
  console.log('✅ CRM routes registered');

  // Register Dashboard routes (AI briefing, stats)
  app.use('/api/dashboard', dashboardRoutes);

  // Register AI Assistant routes
  app.use('/api/ai-assistant', aiAssistantRoutes);

  // Register Extension routes (Chrome extension authentication and CIM generation)
  app.use('/api/extension', extensionAuthRoutes);
  app.use('/api/extension', extensionRoutes);
  console.log('✅ Extension routes registered');

  // Background job: Clean up stale document locks (15+ minutes old)
  async function cleanupStaleLocks() {
    try {
      const staleLocks = await storage.cleanupStaleLocks(15);
      if (staleLocks > 0) {
        console.log(`Cleaned up ${staleLocks} stale document locks`);
      }
    } catch (error) {
      console.error('Error cleaning up stale locks:', error);
    }
  }

  // Run cleanup every 5 minutes
  setInterval(cleanupStaleLocks, 5 * 60 * 1000);
  // Run once at startup
  cleanupStaleLocks();

  const httpServer = createServer(app);
  return httpServer;
}
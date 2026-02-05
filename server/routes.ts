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
import { sendNdaSignedEmail, sendEmail, sendApprovalEmail, sendOwnerApprovalNotification, sendRejectionEmail, sendCollaborationInvitationEmail, sendCollaboratorRemovedEmail, sendEditLockTakenOverEmail } from "./email";
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

// Constants for bcrypt password hashing
const BCRYPT_ROUNDS = 10;

// Helper function to hash a share password
async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Helper function to verify a share password
// Handles both bcrypt hashed passwords and legacy plaintext passwords
async function verifySharePassword(providedPassword: string, storedPassword: string): Promise<boolean> {
  // Check if the stored password is a bcrypt hash (starts with $2a$ or $2b$)
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compare(providedPassword, storedPassword);
  }
  // Legacy plaintext password - use timing-safe comparison
  const providedBuffer = Buffer.from(providedPassword);
  const storedBuffer = Buffer.from(storedPassword);
  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
}

// Helper function to check if user is an authorized admin using database field
function isAuthorizedAdmin(user: any): boolean {
  if (!user) return false;
  return user.isAdmin === true;
}

// Helper function to check if user has premium access
function hasPremiumAccess(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  
  // Free users don't have premium access
  if (user.subscriptionStatus === 'free') return false;
  
  // For canceled subscriptions, check if they still have time remaining
  if (user.subscriptionStatus === 'canceled') {
    return user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date();
  }
  
  // All other subscription statuses (standard, premium, enterprise) have access
  return true;
}

// Function to add rounded corners to images using Sharp with memory optimization
async function addRoundedCorners(imageBuffer: Buffer, radius: number = 30): Promise<Buffer> {
  let sharpInstance: sharp.Sharp | null = null;
  
  try {
    // Create Sharp instance with memory optimization
    sharpInstance = sharp(imageBuffer, {
      limitInputPixels: 268402689, // ~16k x 16k limit
      sequentialRead: true,
      density: 72 // Lower DPI for web use
    });
    
    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    // Limit maximum dimensions to prevent memory issues
    const maxDimension = 2048;
    let { width, height } = metadata;
    
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    // Create rounded rectangle mask with optimized dimensions
    const roundedCorners = Buffer.from(
      `<svg width="${width}" height="${height}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
      </svg>`
    );

    // Apply the mask with memory-optimized processing and preserve transparency
    const processedImage = await sharpInstance
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .png({
        quality: 85,
        compressionLevel: 6,
        progressive: false,
        force: true // Force PNG to preserve transparency
      })
      .composite([
        {
          input: roundedCorners,
          blend: 'dest-in'
        }
      ])
      .toBuffer();

    return processedImage;
  } catch (error) {
    console.error('Error adding rounded corners:', error);
    // Return original buffer if processing fails
    return imageBuffer;
  } finally {
    // Clean up Sharp instance to free memory
    if (sharpInstance) {
      sharpInstance.destroy();
    }
  }
}

// Configure temporary uploads directory for disk storage
const tmpUploadsDir = path.join(os.tmpdir(), 'brokervault-uploads');
if (!fsSync.existsSync(tmpUploadsDir)) {
  fsSync.mkdirSync(tmpUploadsDir, { recursive: true });
}

// Configure multer to use disk storage for large files (prevents OOM on concurrent uploads)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpUploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `upload-${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  }
});

// Main upload handler - uses disk storage to prevent memory issues
const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB limit for field data
    fields: 30,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Log large file uploads for monitoring
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📁 File upload: ${file.originalname}`);
    }
    cb(null, true);
  }
});

// Helper to clean up temporary files after request processing
export async function cleanupTempFile(filePath: string | undefined): Promise<void> {
  if (filePath && filePath.startsWith(tmpUploadsDir)) {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File may already be deleted or moved, ignore
    }
  }
}

// Clean up old temp files on startup and periodically
async function cleanupOldTempFiles() {
  try {
    const files = await fs.readdir(tmpUploadsDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const file of files) {
      const filePath = path.join(tmpUploadsDir, file);
      const stats = await fs.stat(filePath);
      if (stats.mtimeMs < oneHourAgo) {
        await fs.unlink(filePath);
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}
// Run cleanup on startup and every hour
cleanupOldTempFiles();
setInterval(cleanupOldTempFiles, 60 * 60 * 1000);

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
  app.post('/api/webhooks/incoming/:token', express.json({ limit: '1mb' }), async (req, res) => {
    const { token } = req.params;
    const startTime = Date.now();

    try {
      // Import dependencies
      const { incomingWebhooks } = await import('@shared/schema');
      const { processIncomingWebhook, generateRequestId, verifySignature } = await import('./services/incoming-webhook-processor');

      // Find webhook by token
      const [webhook] = await db
        .select()
        .from(incomingWebhooks)
        .where(eq(incomingWebhooks.token, token));

      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      if (!webhook.isActive) {
        return res.status(403).json({ error: 'Webhook is disabled' });
      }

      // Verify signature if secret is configured
      if (webhook.secret) {
        const signature = req.get('X-Webhook-Signature') || req.get('X-Hub-Signature-256');
        const rawBody = JSON.stringify(req.body);

        if (!verifySignature(rawBody, signature, webhook.secret)) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Generate request ID
      const requestId = generateRequestId();

      // Return 200 immediately for reliability
      res.status(200).json({
        success: true,
        requestId,
        message: 'Webhook received and queued for processing'
      });

      // Process asynchronously
      const sourceIp = req.ip || req.get('x-forwarded-for') || 'unknown';
      processIncomingWebhook(webhook, req.body, requestId, sourceIp)
        .then(result => {
          if (result.success) {
            console.log(`[Incoming Webhook] Processed ${requestId}: Created ${result.entityType} #${result.entityId}`);
          } else {
            console.error(`[Incoming Webhook] Failed ${requestId}: ${result.error}`);
          }
        })
        .catch(err => {
          console.error(`[Incoming Webhook] Error processing ${requestId}:`, err);
        });

    } catch (error: any) {
      console.error('[Incoming Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Register text extraction routes
  app.use('/api/text-extraction', textExtractionRouter);

  // Register SDE Analyzer routes
  registerSDEAnalyzerRoutes(app);

  // Start SDE background processor
  sdeProcessor.start();
  console.log('✅ SDE Analyzer processor started');

  // Public health check endpoint for debugging shared document access
  app.get("/api/public-health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Public endpoint accessible without authentication",
      headers: {
        host: req.get('host'),
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
        referer: req.get('referer')
      }
    });
  });

  // Client error reporting endpoint
  app.post("/api/error-report", express.json(), async (req, res) => {
    try {
      const { error, stack, page, componentStack, additionalInfo } = req.body;

      if (!error || !page) {
        return res.status(400).json({ error: 'Missing required fields: error and page' });
      }

      // Get user info if authenticated
      let userEmail: string | undefined;
      let userId: number | undefined;
      if (req.isAuthenticated() && req.user) {
        userId = req.user.id;
        const user = await storage.getUser(req.user.id);
        userEmail = user?.email;
      }

      await sendErrorReport({
        error: String(error).substring(0, 2000), // Limit error length
        stack: stack ? String(stack).substring(0, 5000) : undefined,
        page: String(page).substring(0, 500),
        userEmail,
        userId,
        timestamp: new Date().toISOString(),
        userAgent: req.get('user-agent'),
        componentStack: componentStack ? String(componentStack).substring(0, 3000) : undefined,
        additionalInfo,
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('Error handling error report:', err);
      res.status(500).json({ error: 'Failed to process error report' });
    }
  });

  // Emergency session clear endpoint for corrupted sessions
  app.post("/api/clear-session", (req, res) => {
    console.log('🧹 Clearing corrupted session');
    req.session.destroy((err: any) => {
      if (err) {
        console.error('❌ Failed to destroy session:', err);
        return res.status(500).json({ error: 'Failed to clear session' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Session cleared successfully' });
    });
  });

  // Support ticket submission endpoint
  app.post("/api/support/ticket", express.json(), async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { type, subject, description, attachments, browserInfo, pageUrl } = req.body;

      if (!subject || !description) {
        return res.status(400).json({ error: 'Subject and description are required' });
      }

      // Get user's organization if they have one
      let organizationId: number | null = null;
      try {
        const { organizationMembers } = await import("@shared/schema");
        const { db } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, req.user.id));
        organizationId = membership?.organizationId || null;
      } catch (e) {
        // Organization lookup failed, continue without it
      }

      const ticket = await storage.createSupportTicket({
        userId: req.user.id,
        organizationId,
        type: type || 'bug',
        subject,
        description,
        attachments: attachments || [],
        browserInfo,
        pageUrl,
      });

      res.json({ success: true, ticketId: ticket.id });
    } catch (err) {
      logger.error('Error creating support ticket:', err);
      res.status(500).json({ error: 'Failed to submit support ticket' });
    }
  });

  // Image serving endpoints - serve user images and logos statically
  app.use('/user-images', express.static(path.join(process.cwd(), 'public', 'user-images')));
  app.use('/logos', express.static(path.join(process.cwd(), 'public', 'logos')));

  // Migration endpoint - disabled for deployment stability
  app.post("/api/admin/migrate-images", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Migration functionality disabled to resolve build issues
    res.json({ 
      success: true, 
      message: "Migration has been completed in previous deployments",
      stats: { totalProcessed: 0, successfulMigrations: 0, failedMigrations: 0, skipped: 0 }
    });
  });

  // Database backup endpoints
  app.post("/api/admin/backup/create", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { backupManager } = await import('./database-backup');
      const { label = 'manual' } = req.body;
      const backupPath = await backupManager.createFullBackup(label);
      
      res.json({ 
        success: true, 
        message: "Backup created successfully",
        backupPath 
      });
    } catch (error) {
      console.error('Backup creation failed:', error);
      res.status(500).json({ 
        error: "Failed to create backup",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/admin/backup/list", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { backupManager } = await import('./database-backup');
      const backups = backupManager.listBackups();
      
      res.json({ 
        success: true, 
        backups 
      });
    } catch (error) {
      console.error('Failed to list backups:', error);
      res.status(500).json({ 
        error: "Failed to list backups",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/admin/backup/clean", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { backupManager } = await import('./database-backup');
      backupManager.cleanOldBackups();
      
      res.json({ 
        success: true, 
        message: "Old backups cleaned successfully" 
      });
    } catch (error) {
      console.error('Failed to clean backups:', error);
      res.status(500).json({ 
        error: "Failed to clean backups",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rate limiter for share endpoints to prevent brute-force slug discovery
  const shareLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    message: { error: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Serve uploaded file content for sharing
  app.get("/api/share/:shareSlug/file", shareLimiter, async (req, res) => {
    try {
      const { shareSlug } = req.params;
      console.log("Serving uploaded file for slug:", shareSlug);
      
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      // Only serve uploaded files
      if (!cimDoc.isUploadedFile) {
        return res.status(404).json({ error: "No uploaded file found" });
      }

      // Increment view count
      await storage.incrementShareViewCount(cimDoc.id);

      // Check for files in the new uploadedFiles table first
      const uploadedFiles = await storage.getUploadedFiles(cimDoc.id);
      
      if (uploadedFiles.length > 0) {
        // Serve the first uploaded file (for single file uploads)
        const firstFile = uploadedFiles[0];
        
        try {
          const fileBuffer = await fileStorageManager.downloadFile(firstFile.filePath);
          
          // Set appropriate content type
          res.setHeader('Content-Type', firstFile.mimeType);
          
          // For PDF, set inline disposition for browser viewing and allow iframe embedding
          if (firstFile.mimeType === 'application/pdf') {
            res.setHeader('Content-Disposition', `inline; filename="${firstFile.fileName}"`);
            // Allow iframe embedding for PDFs
            res.removeHeader('X-Frame-Options');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          } else {
            // For other files, set attachment disposition for download
            res.setHeader('Content-Disposition', `attachment; filename="${firstFile.fileName}"`);
          }
          
          res.send(fileBuffer);
          return;
          
        } catch (fileError) {
          console.error("Error reading uploaded file from object storage:", fileError);
        }
      }

      // Fallback to old uploadedFilePath system (try object storage first, then filesystem)
      if (cimDoc.uploadedFilePath) {
        try {
          let fileBuffer;
          
          // Try object storage first (for migrated files)
          try {
            fileBuffer = await fileStorageManager.downloadFile(cimDoc.uploadedFilePath);
          } catch (objectStorageError) {
            // Fallback to filesystem for legacy files
            try {
              fileBuffer = await fs.readFile(cimDoc.uploadedFilePath);
              console.log("Served legacy file from filesystem:", cimDoc.uploadedFilePath);
            } catch (fsError) {
              throw new Error("File not found in object storage or filesystem");
            }
          }
          
          // Set appropriate content type based on file type
          let contentType = 'application/octet-stream';
          if (cimDoc.uploadedFileMimeType === 'application/pdf') {
            contentType = 'application/pdf';
          } else if (cimDoc.uploadedFileMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (cimDoc.uploadedFileMimeType === 'text/plain') {
            contentType = 'text/plain';
          }
          
          res.setHeader('Content-Type', contentType);
          
          // For PDF, set inline disposition for browser viewing and allow iframe embedding
          if (cimDoc.uploadedFileMimeType === 'application/pdf') {
            res.setHeader('Content-Disposition', `inline; filename="${cimDoc.uploadedFileName}"`);
            // Allow iframe embedding for PDFs
            res.removeHeader('X-Frame-Options');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          } else {
            // For other files, set attachment disposition for download
            res.setHeader('Content-Disposition', `attachment; filename="${cimDoc.uploadedFileName}"`);
          }
          
          res.send(fileBuffer);
          
        } catch (fileError) {
          console.error("Error reading uploaded file:", fileError);
          res.status(404).json({ error: "File not found" });
        }
      } else {
        res.status(404).json({ error: "No file path found" });
      }
      
    } catch (error) {
      console.error("Error serving uploaded file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Lightweight NDA check endpoint - optimized with caching
  app.get('/api/share/:shareSlug/nda-check', async (req, res) => {
    const { shareSlug } = req.params;
    const startTime = Date.now();
    
    
    try {
      // Direct database lookup without cache complications

      // Use standard lookup to avoid optimization issues
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc) {
        console.log("Document not found for slug:", shareSlug);
        return res.status(404).json({ error: "Document not found" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      // Check if the current user is the document owner or collaborator
      const isOwner = req.isAuthenticated() && req.user && req.user.id === cimDoc.userId;
      let isCollaborator = false;
      if (req.isAuthenticated() && req.user && !isOwner) {
        const collaboration = await storage.getUserCollaboration(cimDoc.id, req.user.id);
        isCollaborator = !!collaboration;
      }

      // Fetch owner's business logo for branding on password/NDA screens
      let ownerBusinessLogo = null;
      try {
        const ownerProfile = await storage.getUserProfile(cimDoc.userId);
        if (ownerProfile?.businessLogo) {
          ownerBusinessLogo = ownerProfile.businessLogo;
        }
      } catch (e) {
        // Ignore errors fetching owner profile
      }

      const result = {
        requiresNda: Boolean(cimDoc.ndaProtected) && !isOwner && !isCollaborator, // Bypass NDA for owner and collaborators
        requiresApproval: Boolean(cimDoc.ndaApprovalRequired),
        title: cimDoc.title || 'Untitled Document',
        documentId: cimDoc.id,
        isOwner: isOwner,
        isCollaborator: isCollaborator,
        bypassedNda: (isOwner || isCollaborator) && Boolean(cimDoc.ndaProtected), // Let frontend know NDA was bypassed
        currentUserId: req.user?.id || null,
        ownerBusinessLogo: ownerBusinessLogo
      };

      // Skip caching to avoid import issues

      res.json(result);

    } catch (error) {
      console.error('NDA check error:', error);
      res.status(500).json({ error: "Failed to check NDA status" });
    }
  });

  // Public share endpoints (comprehensively optimized for performance)
  app.get("/api/share/:shareSlug", shareLimiter, async (req, res) => {
    const startTime = Date.now();
    try {
      const { shareSlug } = req.params;
      const { token } = req.query;
      
      console.log("=== OPTIMIZED SHARE LINK ACCESS ===");
      console.log("Processing share request for slug:", shareSlug.substring(0, 8) + "...");
      
      // PERFORMANCE OPTIMIZATION 6: Cache integration with timeout protection
      let shareCache, CACHE_TTL, cacheKey, cachedData;
      try {
        const cacheModule = await import('./cache');
        shareCache = cacheModule.shareCache;
        CACHE_TTL = cacheModule.CACHE_TTL;
        cacheKey = shareCache.keys.shareDocument(shareSlug);
        cachedData = shareCache.get(cacheKey);
        
        if (cachedData && !token) {
          console.log("Cache hit - returning cached data, time:", Date.now() - startTime + "ms");
          return res.json(cachedData);
        }
      } catch (cacheError) {
        console.log("Cache unavailable, proceeding without cache:", cacheError.message);
      }
      
      // Immediate validation
      if (!shareSlug || shareSlug.length < 3) {
        return res.status(400).json({ error: "Invalid share slug" });
      }
      
      // PERFORMANCE OPTIMIZATION 1: Use reliable database query with timeout protection
      let cimDoc;
      try {
        cimDoc = await Promise.race([
          storage.getCimByShareSlugOptimized(shareSlug),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 6000)
          )
        ]);
      } catch (error) {
        cimDoc = await storage.getCimByShareSlug(shareSlug);
      }
      
      console.log("Document lookup time:", Date.now() - startTime + "ms");
      
      if (!cimDoc) {
        console.log("Document not found for share slug");
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!cimDoc.shareEnabled) {
        console.log("ERROR: Sharing disabled for document:", cimDoc.id);
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }

      // Check expiration with detailed logging
      if (cimDoc.shareExpiresAt) {
        const now = new Date();
        const expirationDate = new Date(cimDoc.shareExpiresAt);
        console.log("Expiration check:", {
          now: now.toISOString(),
          expiresAt: expirationDate.toISOString(),
          isExpired: now > expirationDate
        });
        
        if (now > expirationDate) {
          console.log("ERROR: Document has expired");
          return res.status(410).json({ error: "This shared link has expired" });
        }
      } else {
        console.log("No expiration date set - link never expires");
      }

      // Check password protection
      if (cimDoc.sharePassword) {
        const { password } = req.query;
        const passwordsMatch = password ? await verifySharePassword(password as string, cimDoc.sharePassword) : false;
        console.log("Password protection check:", {
          hasPassword: !!cimDoc.sharePassword,
          providedPassword: !!password,
          passwordsMatch
        });

        if (!password || !passwordsMatch) {
          console.log("ERROR: Invalid or missing password for protected document");
          return res.status(401).json({
            error: "Password required",
            requiresPassword: true
          });
        }
        console.log("Password authentication successful");
      }

      // Check if the current user is the document owner (before view tracking and NDA checks)
      const isOwner = req.isAuthenticated() && req.user && req.user.id === cimDoc.userId;

      // PERFORMANCE OPTIMIZATION 2: Async view tracking (non-blocking)
      console.log("Starting async view tracking for document:", cimDoc.id);

      // Generate a unique session ID for time tracking
      const viewSessionId = `view_${cimDoc.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let viewerEmail: string | null = null;

      const viewTrackingPromise = (async () => {
        try {
          const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
          const userAgent = req.get('User-Agent') || 'unknown';

          if (isOwner) {
            // Track owner view but don't increment general view count to avoid inflating analytics
            console.log("Tracking document owner view (skipping to avoid inflating analytics)");
            // Don't track owner views in documentViews table to keep analytics clean
          } else if (cimDoc.ndaProtected && token) {
            // Track NDA signer view when accessing CIM content with token
            const accessToken = await storage.getNdaAccessToken(token as string);
            if (accessToken && accessToken.isActive) {
              viewerEmail = accessToken.signerEmail;
              await Promise.all([
                storage.trackDocumentView(cimDoc.id, 'nda_signer', {
                  viewerIdentifier: accessToken.signerEmail,
                  ipAddress: clientIp,
                  userAgent: userAgent,
                  sessionId: viewSessionId
                }),
                storage.incrementShareViewCount(cimDoc.id)
              ]);

              // Dispatch cim.viewed event for NDA signer views
              const cimViewedPayload = {
                cim_id: cimDoc.id,
                title: cimDoc.title,
                viewer_email: accessToken.signerEmail,
                viewer_name: accessToken.signerName,
                viewer_type: 'nda_signer',
                viewed_at: new Date().toISOString(),
              };
              dispatchIntegrationEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
                .catch(err => console.error('Integration dispatch error:', err));
              dispatchWebhookEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
                .catch(err => console.error('Webhook dispatch error:', err));
            }
          } else if (!cimDoc.ndaProtected) {
            // Track anonymous view for non-NDA protected documents
            await Promise.all([
              storage.trackDocumentView(cimDoc.id, 'anonymous', {
                ipAddress: clientIp,
                userAgent: userAgent,
                sessionId: viewSessionId
              }),
              storage.incrementShareViewCount(cimDoc.id)
            ]);

            // Dispatch cim.viewed event for anonymous views
            const cimViewedPayload = {
              cim_id: cimDoc.id,
              title: cimDoc.title,
              viewer_type: 'anonymous',
              viewed_at: new Date().toISOString(),
            };
            dispatchIntegrationEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
              .catch(err => console.error('Integration dispatch error:', err));
            dispatchWebhookEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
              .catch(err => console.error('Webhook dispatch error:', err));
          }
        } catch (error) {
          console.error('Async view tracking error:', error);
        }
      })();

      // PERFORMANCE OPTIMIZATION 3: Parallel data fetching with timeout protection
      const dataFetchStart = Date.now();
      let userProfile, customSections, ndaApprovalStatus;

      try {
        [userProfile, customSections, ndaApprovalStatus] = await Promise.all([
          storage.getUser(cimDoc.userId),
          storage.getCustomSections(cimDoc.id),
        // NDA approval check as async operation
        (async () => {
          // Skip NDA approval requirement for document owners
          if (isOwner) {
            return null;
          }

          if (!cimDoc.ndaProtected || !cimDoc.ndaApprovalRequired) return null;

          if (token) {
            try {
              const accessToken = await storage.getNdaAccessToken(token as string);
              if (accessToken && accessToken.isActive) {
                const signature = await storage.getNdaSignatureById(accessToken.ndaSignatureId);
                if (signature && !signature.approved) {
                  return {
                    requiresApproval: true,
                    isApproved: false,
                    message: "Thank you for signing the NDA. Your signature has been received and someone will follow up as soon as possible to share the document once it is approved."
                  };
                } else if (signature && signature.approved) {
                  return { requiresApproval: true, isApproved: true };
                }
              }
            } catch (error) {
              console.error('NDA approval check error:', error);
            }
          }

          return {
            requiresApproval: true,
            isApproved: false,
            message: "This document requires NDA approval before viewing."
          };
        })()
        ]);
      } catch (error) {
        console.log("Parallel query failed, using fallback:", error.message);
        // Fallback to sequential standard queries
        userProfile = await storage.getUser(cimDoc.userId);
        customSections = await storage.getCustomSections(cimDoc.id);
        ndaApprovalStatus = null;
      }
      
      console.log("Parallel data fetch time:", Date.now() - dataFetchStart + "ms");
      
      if (!userProfile) {
        console.log("ERROR: User profile not found for document owner:", cimDoc.userId);
        return res.status(404).json({ error: "Document owner not found" });
      }

      // PERFORMANCE OPTIMIZATION 4: Pre-compute URLs with simplified processing
      const urlProcessingStart = Date.now();
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      
      // Use production domain for image URLs - force cimshare.com for any production request
      let baseUrl;
      if (host?.includes('cimshare.com') || req.headers['x-forwarded-host']?.includes('cimshare.com') || req.headers.host?.includes('cimshare.com')) {
        baseUrl = 'https://cimshare.com';
      } else {
        baseUrl = `${protocol}://${host}`;
      }

      // Enhanced URL processing function for all image types
      const processImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        
        // Handle object storage URLs - these should be served as-is since they're internal API paths
        if (url.startsWith('/api/object-storage/')) {
          return `${baseUrl}${url}`;
        }
        
        // For custom section images and other user-specific images, ensure proper serving
        if (url.startsWith('/user-images/')) {
          return `${baseUrl}${url}`;
        }
        
        // For legacy logos/images without object storage prefix
        if (url.startsWith('/logos/') || url.startsWith('/business-images/') || url.startsWith('/profile-photos/')) {
          return `${baseUrl}${url}`;
        }
        
        return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      };

      // Process images and URLs in parallel
      const [absoluteSelectedImages, absoluteLogoUrl, ndaUrl] = [
        (cimDoc.selectedImages || []).map(processImageUrl).filter(Boolean),
        processImageUrl(cimDoc.logoUrl),
        cimDoc.ndaProtected ? `${baseUrl}/nda/${shareSlug}` : null
      ];
      
      console.log("=== SHARE ROUTE IMAGE DEBUG ===");
      console.log("Original logo URL:", cimDoc.logoUrl);
      console.log("Processed logo URL:", absoluteLogoUrl);
      console.log("Original selected images:", cimDoc.selectedImages);
      console.log("Processed selected images:", absoluteSelectedImages);

      console.log("URL processing time:", Date.now() - urlProcessingStart + "ms");

      // PERFORMANCE OPTIMIZATION 5: Streamlined profile sanitization with URL processing
      const sanitizedUserProfile = {
        name: userProfile.name,
        title: userProfile.title,
        email: userProfile.email,
        phoneNumber: userProfile.phoneNumber, // Use correct field name
        businessName: userProfile.businessName,
        businessLogo: processImageUrl(userProfile.businessLogo), // Process business logo URL
        profilePhoto: processImageUrl(userProfile.profilePhoto), // Process profile photo URL
        brandColors: userProfile.brandColors // Include brand colors for theme support
      };
      
      console.log("=== USER PROFILE IMAGE DEBUG ===");
      console.log("Original business logo:", userProfile.businessLogo);
      console.log("Processed business logo:", sanitizedUserProfile.businessLogo);
      console.log("Original profile photo:", userProfile.profilePhoto);
      console.log("Processed profile photo:", sanitizedUserProfile.profilePhoto);
      
      console.log("=== USER PROFILE PHONE DEBUG ===");
      console.log("userProfile.phoneNumber:", userProfile.phoneNumber);
      console.log("Final phoneNumber:", sanitizedUserProfile.phoneNumber);

      // Ensure view tracking completes (but don't wait for it)
      viewTrackingPromise.catch(error => 
        console.error('View tracking failed (non-blocking):', error)
      );

      console.log("Total optimized response time:", Date.now() - startTime + "ms");

      // Check if the current user is a collaborator (isOwner already computed earlier)
      let isCollaborator = false;
      if (req.isAuthenticated() && req.user && !isOwner) {
        const collaboration = await storage.getUserCollaboration(cimDoc.id, req.user.id);
        isCollaborator = !!collaboration;
      }

      const responseData = {
        cim: {
          id: cimDoc.id,
          title: cimDoc.title,
          analysis: cimDoc.analysis,
          logoUrl: absoluteLogoUrl,
          selectedImages: absoluteSelectedImages,
          financialsEnabled: cimDoc.financialsEnabled,
          askingPrice: cimDoc.askingPrice,
          askingPriceIncluded: cimDoc.askingPriceIncluded,
          revenue: cimDoc.revenue,
          revenueIncluded: cimDoc.revenueIncluded,
          ebitda: cimDoc.ebitda,
          ebitdaIncluded: cimDoc.ebitdaIncluded,
          coverImageUrl: cimDoc.coverImageUrl,
          coverImagePosition: cimDoc.coverImagePosition,
          coverImageAttribution: cimDoc.coverImageAttribution,
          createdAt: cimDoc.createdAt ? cimDoc.createdAt.toISOString() : null,
          userProfile: sanitizedUserProfile,
          userId: cimDoc.userId,
          shareSlug: cimDoc.shareSlug,
          displaySettings: cimDoc.displaySettings
        },
        websiteUrl: cimDoc.websiteUrl || '',
        selectedImages: absoluteSelectedImages,
        logoUrl: absoluteLogoUrl,
        userProfileData: sanitizedUserProfile,
        requiresNda: (cimDoc.ndaProtected || false) && !isOwner && !isCollaborator, // Bypass NDA for owner and collaborators
        ndaUrl,
        customSections: customSections ? customSections.map(section => ({
          ...section,
          imageUrls: section.imageUrls ? section.imageUrls.map(processImageUrl).filter(Boolean) : [],
          imageUrl: section.imageUrl ? processImageUrl(section.imageUrl) : null
        })) : [],
        ndaApprovalStatus,
        isOwner: isOwner,
        isCollaborator: isCollaborator,
        bypassedNda: (isOwner || isCollaborator) && Boolean(cimDoc.ndaProtected), // Let frontend know NDA was bypassed
        currentUserId: req.user?.id || null,
        // Analytics tracking info for frontend heartbeats
        viewSessionId: isOwner ? null : viewSessionId,
        viewerEmail: viewerEmail
      };

      // PERFORMANCE OPTIMIZATION 7: Cache successful responses (except when using tokens)
      if (shareCache && !token && !cimDoc.ndaProtected) {
        try {
          shareCache.set(cacheKey, responseData, CACHE_TTL.SHARE_DOCUMENT);
          console.log("Response cached for future requests");
        } catch (cacheError) {
          console.log("Cache write failed:", cacheError.message);
        }
      }

      res.json(responseData);
    } catch (error) {
      console.error("Share endpoint error:", error);
      res.status(500).json({ 
        error: "Failed to load shared document"
      });
    }
  });

  // Shared document export endpoints - PDF (OPTIMIZED)
  app.post("/api/share/:shareSlug/export/pdf", async (req, res) => {
    const startTime = Date.now();
    console.log("🔴🔴🔴 SHARE PDF EXPORT ENDPOINT HIT 🔴🔴🔴");
    const fsDebug = await import('fs');
    fsDebug.appendFileSync('/tmp/pdf-debug.log', `\n\n=== PDF EXPORT ${new Date().toISOString()} ===\n`);
    try {
      const { shareSlug } = req.params;
      console.log("Shared PDF export request for slug:", shareSlug);
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `shareSlug: ${shareSlug}\n`);
      
      // PERFORMANCE OPTIMIZATION: Direct database query for shared PDF export
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      console.log("Document lookup time:", Date.now() - startTime + "ms");
      
      if (!cimDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      // Check password protection for PDF export
      if (cimDoc.sharePassword) {
        const { password } = req.body;
        const passwordsMatch = password ? await verifySharePassword(password as string, cimDoc.sharePassword) : false;
        console.log("PDF export password protection check:", {
          hasPassword: !!cimDoc.sharePassword,
          providedPassword: !!password,
          passwordsMatch
        });

        if (!password || !passwordsMatch) {
          console.log("ERROR: Invalid or missing password for protected document PDF export");
          return res.status(401).json({
            error: "Password required for PDF export",
            requiresPassword: true
          });
        }
        console.log("PDF export password authentication successful");
      }

      // PERFORMANCE OPTIMIZATION: Parallel data fetching for shared PDF export
      const dataFetchStart = Date.now();
      const [userProfile, documentFinancialFiles, customSections] = await Promise.all([
        storage.getUser(cimDoc.userId),
        db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, cimDoc.id)),
        storage.getCustomSections(cimDoc.id)
      ]);

      console.log("Data fetch time:", Date.now() - dataFetchStart + "ms");
      console.log("Financial files for PDF export:", documentFinancialFiles?.length || 0, "files");
      if (documentFinancialFiles?.length > 0) {
        console.log("Sample financial file:", JSON.stringify(documentFinancialFiles[0], null, 2));
        console.log("ALL financial files for debugging:");
        documentFinancialFiles.forEach((file, index) => {
          console.log(`File ${index}:`, {
            id: file.id,
            filename: file.filename,
            cimDocumentId: file.cimDocumentId,
            filePath: file.filePath,
            fileSize: file.fileSize
          });
        });
      } else {
        console.log("ERROR: No financial files found for CIM document ID:", cimDoc.id);
      }

      if (!userProfile) {
        return res.status(404).json({ error: "Document owner not found" });
      }

      // Get document owner's PDF template preference  
      const pdfTemplate = userProfile.pdfBackgroundTemplate || 'classic';
      
      // Prepare financial data from cached document properties
      const financialData = {
        enabled: cimDoc.financialsEnabled || false,
        askingPrice: cimDoc.askingPrice,
        askingPriceIncluded: cimDoc.askingPriceIncluded || false,
        revenue: cimDoc.revenue,
        revenueIncluded: cimDoc.revenueIncluded || false,
        ebitda: cimDoc.ebitda,
        ebitdaIncluded: cimDoc.ebitdaIncluded || false
      };

      console.log("Using cached analysis data - no reprocessing needed for shared PDF export");

      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || 'cimshare.com';
      // Use production domain for image URLs in production environment
      let baseUrl;
      if (process.env.NODE_ENV === 'production' || host?.includes('cimshare.com')) {
        baseUrl = 'https://cimshare.com';
      } else {
        baseUrl = `${protocol}://${host}`;
      }

      // Process user profile images for PDF generation using same logic as share route
      const processImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        
        // Handle object storage URLs
        if (url.startsWith('/api/object-storage/')) {
          return `${baseUrl}${url}`;
        }
        
        // For user-specific images
        if (url.startsWith('/user-images/')) {
          return `${baseUrl}${url}`;
        }
        
        // For legacy logos/images
        if (url.startsWith('/logos/') || url.startsWith('/business-images/') || url.startsWith('/profile-photos/')) {
          return `${baseUrl}${url}`;
        }
        
        return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      };

      // Create processed user profile for PDF generation with proper image URLs
      const processedUserProfile = {
        ...userProfile,
        businessLogo: processImageUrl(userProfile.businessLogo),
        profilePhoto: processImageUrl(userProfile.profilePhoto)
      };

      console.log("=== PDF EXPORT USER PROFILE IMAGE DEBUG ===");
      console.log("Original business logo:", userProfile.businessLogo);
      console.log("Processed business logo:", processedUserProfile.businessLogo);
      console.log("Original profile photo:", userProfile.profilePhoto);
      console.log("Processed profile photo:", processedUserProfile.profilePhoto);
      console.log("===========================================");

      // Process logo URL and selected images with proper URL conversion for PDF export
      const processedLogoUrl = processImageUrl(cimDoc.logoUrl);
      const processedSelectedImages = (cimDoc.selectedImages || []).map(processImageUrl).filter(Boolean);
      const processedCoverImageUrl = processImageUrl(cimDoc.coverImageUrl);

      // Process custom section images for PDF export (similar to share route processing)
      const processedCustomSections = customSections ? customSections.map(section => ({
        ...section,
        imageUrls: section.imageUrls ? section.imageUrls.map(processImageUrl).filter(Boolean) : [],
        imageUrl: section.imageUrl ? processImageUrl(section.imageUrl) : null
      })) : [];

      console.log("=== PDF EXPORT IMAGE URL PROCESSING ===");
      console.log("Original logo URL:", cimDoc.logoUrl);
      console.log("Processed logo URL:", processedLogoUrl);
      console.log("Original selected images:", cimDoc.selectedImages);
      console.log("Processed selected images:", processedSelectedImages);
      console.log("Original cover image URL:", cimDoc.coverImageUrl);
      console.log("Processed cover image URL:", processedCoverImageUrl);
      console.log("Custom sections count:", customSections?.length || 0);
      if (customSections && customSections.length > 0) {
        console.log("Custom sections image processing:");
        customSections.forEach((section, index) => {
          console.log(`Section ${index}:`, {
            type: section.type,
            originalImageUrls: section.imageUrls,
            processedImageUrls: processedCustomSections[index]?.imageUrls
          });
        });
      }
      console.log("==========================================");

      // Debug financial files before PDF generation
      console.log("=== PDF EXPORT FINANCIAL FILES DEBUG ===");
      console.log("documentFinancialFiles count:", documentFinancialFiles?.length || 0);
      if (documentFinancialFiles && documentFinancialFiles.length > 0) {
        console.log("Financial files data structure:");
        documentFinancialFiles.forEach((file, index) => {
          console.log(`File ${index}:`, {
            id: file.id,
            filename: file.filename,
            file_size: file.file_size,
            fileSize: file.fileSize,
            cim_document_id: file.cim_document_id,
            cimDocumentId: file.cimDocumentId,
            filePath: file.filePath,
            file_path: file.file_path
          });
        });
      } else {
        console.log("No financial files found for PDF generation");
      }
      console.log("shareSlug being passed:", shareSlug);
      console.log("==========================================");

      // PERFORMANCE OPTIMIZATION: Direct PDF generation with cached data
      const pdfGenStart = Date.now();

      // Get branded PDF template settings from user profile
      const brandedPdfTemplate = userProfile.brandedPdfTemplate || 'none';

      // Build effective brand colors: use user-selected colors if set, otherwise fall back to extracted colors
      const extractedColors = userProfile.brandColors || [];
      const effectivePrimaryColor = userProfile.pdfPrimaryColor || (extractedColors[0] as string) || '#3b82f6';
      const effectiveSecondaryColor = userProfile.pdfSecondaryColor || (extractedColors[1] as string) || '#e5e7eb';
      const brandColors = [effectivePrimaryColor, effectiveSecondaryColor];

      console.log("=== BRANDED PDF TEMPLATE DEBUG ===");
      console.log("brandedPdfTemplate:", brandedPdfTemplate);
      console.log("extractedColors:", extractedColors);
      console.log("effectivePrimaryColor:", effectivePrimaryColor);
      console.log("effectiveSecondaryColor:", effectiveSecondaryColor);
      console.log("brandColors (final):", brandColors);
      console.log("businessLogo (processed):", processedUserProfile.businessLogo);
      console.log("==================================");

      // Write to debug file
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `brandedPdfTemplate: ${brandedPdfTemplate}\n`);
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `brandColors: ${JSON.stringify(brandColors)}\n`);
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `businessLogo: ${processedUserProfile.businessLogo}\n`);

      // PERF-016: TODO - Move PDF generation to worker thread for better scalability
      // PDF generation is CPU-intensive and blocks the main event loop, causing latency
      // for other concurrent requests. To fix this:
      //
      // 1. Create server/workers/pdf-worker.ts:
      //    import { parentPort, workerData } from 'worker_threads';
      //    import { generatePDF } from '../document-export';
      //    async function run() {
      //      try {
      //        const pdfBuffer = await generatePDF(...workerData.params);
      //        parentPort?.postMessage({ success: true, buffer: pdfBuffer });
      //      } catch (error) {
      //        parentPort?.postMessage({ success: false, error: error.message });
      //      }
      //    }
      //    run();
      //
      // 2. Create helper function in routes.ts:
      //    import { Worker } from 'worker_threads';
      //    function generatePDFInWorker(params: any[]): Promise<Buffer> {
      //      return new Promise((resolve, reject) => {
      //        const worker = new Worker('./workers/pdf-worker.js', { workerData: { params } });
      //        worker.on('message', (result) => {
      //          if (result.success) resolve(Buffer.from(result.buffer));
      //          else reject(new Error(result.error));
      //        });
      //        worker.on('error', reject);
      //      });
      //    }
      //
      // 3. Replace this generatePDF call with generatePDFInWorker(params)
      //
      // Alternative: Use setImmediate() to yield to event loop during PDF generation,
      // or implement a job queue (e.g., BullMQ) for background PDF processing.
      const pdfBuffer = await generatePDF(
        cimDoc.analysis, // Use cached analysis - no regeneration
        processedLogoUrl, // Use processed logo URL with proper base URL
        cimDoc.websiteUrl || undefined,
        processedSelectedImages, // Use processed images with proper base URLs
        processedUserProfile, // Use processed user profile with correct image URLs
        financialData,
        documentFinancialFiles,
        baseUrl,
        cimDoc.title,
        processedCustomSections, // Use processed custom sections with proper image URLs
        processedCoverImageUrl, // Use processed cover image URL
        cimDoc.coverImagePosition,
        cimDoc.id,
        pdfTemplate, // Pass user's template preference
        shareSlug, // Pass shareSlug to PDF generator for shared links
        brandedPdfTemplate, // Pass branded template preference (accent-bar, etc.)
        brandColors, // Pass user's brand colors
        processedUserProfile.businessLogo // Pass processed business logo URL
      );
      
      console.log("PDF generation time:", Date.now() - pdfGenStart + "ms");
      console.log("Total shared PDF export time:", Date.now() - startTime + "ms");
      console.log("PDF generation completed, buffer length:", pdfBuffer.length);

      // Dispatch cim.downloaded event
      const viewerEmail = req.body.viewerEmail || 'anonymous';
      const cimDownloadedPayload = {
        cim_id: cimDoc.id,
        title: cimDoc.title,
        viewer_email: viewerEmail,
        download_type: 'pdf',
        downloaded_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(cimDoc.userId, 'cim.downloaded', cimDownloadedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(cimDoc.userId, 'cim.downloaded', cimDownloadedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cim-${cimDoc.id}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Shared PDF export error:", error);
      res.status(500).json({ error: "Failed to generate PDF document" });
    }
  });

  // Shared document export endpoints - Word
  app.post("/api/share/:shareSlug/export/word", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      console.log("Shared Word export request for slug:", shareSlug);
      
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      // Check password protection for Word export
      if (cimDoc.sharePassword) {
        const { password } = req.body;
        const passwordsMatch = password ? await verifySharePassword(password as string, cimDoc.sharePassword) : false;
        console.log("Word export password protection check:", {
          hasPassword: !!cimDoc.sharePassword,
          providedPassword: !!password,
          passwordsMatch
        });

        if (!password || !passwordsMatch) {
          console.log("ERROR: Invalid or missing password for protected document Word export");
          return res.status(401).json({
            error: "Password required for Word export",
            requiresPassword: true
          });
        }
        console.log("Word export password authentication successful");
      }

      // Get user profile for contact information
      const userProfile = await storage.getUser(cimDoc.userId);
      
      // Get financial data if available
      const financialData = {
        enabled: cimDoc.financialsEnabled || false,
        askingPrice: cimDoc.askingPrice,
        askingPriceIncluded: cimDoc.askingPriceIncluded || false,
        revenue: cimDoc.revenue,
        revenueIncluded: cimDoc.revenueIncluded || false,
        ebitda: cimDoc.ebitda,
        ebitdaIncluded: cimDoc.ebitdaIncluded || false
      };

      console.log("Generating Word document with full context:", {
        logoUrl: cimDoc.logoUrl,
        selectedImages: cimDoc.selectedImages?.length || 0,
        websiteUrl: cimDoc.websiteUrl,
        hasUserProfile: !!userProfile,
        financialData: financialData.enabled
      });

      const wordBuffer = await generateWordDocument(
        cimDoc.analysis,
        cimDoc.logoUrl || undefined,
        cimDoc.websiteUrl || undefined,
        cimDoc.selectedImages ? cimDoc.selectedImages : undefined,
        userProfile,
        financialData,
        cimDoc.id
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="cim-${cimDoc.id}.docx"`);
      res.send(wordBuffer);
      
    } catch (error) {
      console.error("Shared Word export error:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  // Download individual NDA signature
  app.get("/api/cim/:docId/nda-signatures/:signatureId/download", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { docId, signatureId } = req.params;
      
      // Verify ownership
      const doc = await storage.getCimDocument(parseInt(docId));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get the signature
      const signatures = await storage.getNdaSignatures(parseInt(docId));
      const signature = signatures.find(s => s.id === parseInt(signatureId));
      
      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Convert base64 to buffer and send as PDF
      const pdfBuffer = Buffer.from(signature.signedNdaContent, 'base64');
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nda-${signature.signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf"`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error("Error downloading NDA signature:", error);
      res.status(500).json({ error: "Failed to download NDA signature" });
    }
  });

  // Bulk download all NDA signatures as ZIP
  app.get("/api/cim/:docId/nda-signatures/bulk-download", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
      const { docId } = req.params;
      
      // Verify ownership
      const doc = await storage.getCimDocument(parseInt(docId));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get all signatures for this document
      const signatures = await storage.getNdaSignatures(parseInt(docId));
      
      if (signatures.length === 0) {
        return res.status(404).json({ error: "No signatures found" });
      }

      // Create ZIP file
      const zip = new JSZip();

      signatures.forEach((signature, index) => {
        const pdfBuffer = Buffer.from(signature.signedNdaContent, 'base64');
        const fileName = `${index + 1}-nda-${signature.signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
        zip.file(fileName, pdfBuffer);
      });

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="nda-signatures-${docId}.zip"`);
      res.send(zipBuffer);
      
    } catch (error) {
      console.error("Error creating ZIP file:", error);
      res.status(500).json({ error: "Failed to create ZIP file" });
    }
  });

  // Application configuration endpoint for frontend
  app.get("/api/config", (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey || publishableKey.includes('YOUR_') || publishableKey === 'pk_test_YOUR_PUBLISHABLE_KEY_HERE') {
      console.error('❌ Stripe publishable key not properly configured');
      return res.status(500).json({ 
        error: "Stripe configuration incomplete",
        message: "Payment processing is temporarily unavailable"
      });
    }
    
    const supportEmail = process.env.SUPPORT_EMAIL || 'contact@cimshare.com';
    const companyName = process.env.COMPANY_NAME || 'Broker Vault';
    
    res.json({
      stripe: {
        publishableKey: publishableKey
      },
      company: {
        supportEmail,
        name: companyName
      }
    });
  });

  // Legacy endpoint for backward compatibility
  app.get("/api/stripe-config", (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey || publishableKey.includes('YOUR_') || publishableKey === 'pk_test_YOUR_PUBLISHABLE_KEY_HERE') {
      return res.status(500).json({ 
        error: "Stripe configuration incomplete",
        message: "Payment processing is temporarily unavailable"
      });
    }
    
    res.json({
      publishableKey: publishableKey
    });
  });

  // Pricing endpoint for Free Trial/Standard/Enterprise model
  app.get("/api/pricing", async (req, res) => {
    res.json({
      free: {
        amount: 0,
        currency: 'usd',
        limit: 1,
        regenerationLimit: 2
      },
      standard: {
        amount: 99,
        currency: 'usd',
        limit: 3,
        regenerationLimit: 20
      },
      enterprise: {
        amount: 'Contact Us',
        currency: 'usd',
        limit: 'Unlimited',
        regenerationLimit: 'Unlimited'
      }
    });
  });






  // PERF-019: Rate limiter for expensive AI generation endpoints
  // Prevents abuse of AI resources with per-user rate limiting
  const aiGenerationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 10, // 10 requests per hour per user
    keyGenerator: (req) => {
      // Use user ID for authenticated requests, fall back to IP
      return req.user?.id?.toString() || req.ip || 'unknown';
    },
    message: { error: 'Too many AI generation requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for users with unlimited plans (enterprise)
    skip: async (req) => {
      if (!req.user) return false;
      try {
        const user = await storage.getUser(req.user.id);
        return user?.subscriptionTier === 'enterprise';
      } catch {
        return false;
      }
    }
  });

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
          share_url: doc.shareSlug ? `${process.env.BASE_URL || 'https://cimshare.com'}/share/${doc.shareSlug}` : null,
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

  // PERF-006: Create specialized upload configuration for large financial files using disk storage
  // This prevents large files (up to 200MB) from being stored entirely in memory, reducing memory pressure
  const largeFileUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, os.tmpdir());
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB limit for financial files
      fieldSize: 200 * 1024 * 1024, // 200MB limit for field data
      fields: 100, // Increase field count limit
      files: 50 // Increase file count limit
    }
  });

  // Helper function to read file from disk and return buffer (for disk-based uploads)
  async function readFileFromDisk(file: Express.Multer.File): Promise<Buffer> {
    if (file.buffer) {
      // File is already in memory (for backwards compatibility)
      return file.buffer;
    }
    // Read from disk path
    return await fs.readFile(file.path);
  }

  // Helper function to clean up temp files after processing
  async function cleanupTempFile(file: Express.Multer.File): Promise<void> {
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (err) {
        console.warn(`Failed to cleanup temp file ${file.path}:`, err);
      }
    }
  }

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
  app.get("/api/share/:shareSlug/files", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      const files = await storage.getUploadedFiles(cimDoc.id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching shared document files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // Get financial files for a shared CIM document (public endpoint)
  app.get("/api/share/:shareSlug/financial-files", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      const files = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.cimDocumentId, cimDoc.id))
        .orderBy(desc(financialFiles.uploadedAt));

      res.json(files);
    } catch (error) {
      console.error("Error fetching shared document financial files:", error);
      res.status(500).json({ error: "Failed to fetch financial files" });
    }
  });

  // Download financial file from shared document (public endpoint)
  app.get("/api/share/:shareSlug/financial-files/:fileId/download", async (req, res) => {
    try {
      const { shareSlug, fileId } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      const file = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.id, parseInt(fileId)))
        .then(files => files[0]);

      if (!file || file.cimDocumentId !== cimDoc.id) {
        return res.status(404).json({ error: "Financial file not found" });
      }

      // All files are available since there's no included field in current schema

      // Download file from object storage
      try {
        const fileBuffer = await fileStorageManager.downloadFile(file.filePath);
        
        // Get MIME type from file extension
        const ext = path.extname(file.filename).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png'
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Content-Type', mimeType);

        // Send the file buffer
        res.send(fileBuffer);
      } catch (downloadError) {
        console.error('Error downloading file from object storage:', downloadError);
        return res.status(404).json({ error: "File not found in storage" });
      }
    } catch (error) {
      console.error('Error downloading shared financial file:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Bulk download all financial files from shared document (public endpoint)
  app.get("/api/share/:shareSlug/financial-files/bulk-download", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      const files = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.cimDocumentId, cimDoc.id))
        .orderBy(desc(financialFiles.uploadedAt));

      // All files are included since there's no included field in current schema
      const includedFiles = files;

      if (includedFiles.length === 0) {
        return res.status(404).json({ error: "No financial files available" });
      }

      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="financial-documents-${cimDoc.title || 'document'}.zip"`);
      
      archive.pipe(res);

      for (const file of includedFiles) {
        try {
          const fileBuffer = await fileStorageManager.downloadFile(file.filePath);
          archive.append(fileBuffer, { name: file.filename });
        } catch (fileError) {
          console.error(`Error adding file ${file.filename} to archive:`, fileError);
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error creating bulk download:', error);
      res.status(500).json({ error: "Failed to create download archive" });
    }
  });

  // Download individual uploaded file from shared document
  app.get("/api/share/:shareSlug/download/:fileId", async (req, res) => {
    try {
      const { shareSlug, fileId } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      const files = await storage.getUploadedFiles(cimDoc.id);
      const file = files.find(f => f.id === parseInt(fileId));
      
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
            await fs.access(file.filePath);
            fileBuffer = await fs.readFile(file.filePath);
            console.log("Served legacy shared file from filesystem:", file.filePath);
          } catch (fsError) {
            throw new Error("File not found in object storage or filesystem");
          }
        }
        
        // Set appropriate headers
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
        
        // Stream the file
        res.send(fileBuffer);
      } catch (fileError) {
        return res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("Shared file download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Download all files as ZIP from shared document
  app.get("/api/share/:shareSlug/download-all", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      const files = await storage.getUploadedFiles(cimDoc.id);
      
      if (files.length === 0) {
        return res.status(404).json({ error: "No files found" });
      }

      const zip = new JSZip();

      // Add each file to the ZIP
      for (const file of files) {
        try {
          let fileBuffer;
          
          // Try object storage first (for migrated files)
          try {
            fileBuffer = await fileStorageManager.downloadFile(file.filePath);
          } catch (objectStorageError) {
            // Fallback to filesystem for legacy files
            try {
              fileBuffer = await fs.readFile(file.filePath);
              console.log("Added legacy file from filesystem to ZIP:", file.filePath);
            } catch (fsError) {
              console.warn(`Could not add file ${file.fileName} to ZIP - not found in object storage or filesystem:`, fsError);
              continue;
            }
          }
          
          zip.file(file.fileName, fileBuffer);
        } catch (fileError) {
          console.warn(`Could not add file ${file.fileName} to ZIP:`, fileError);
        }
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${cimDoc.title}_files.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Bulk download error:", error);
      res.status(500).json({ error: "Failed to create ZIP file" });
    }
  });

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

  // Enhanced View Analytics endpoint with NDA-aware tracking
  app.get("/api/cim/:id/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const docId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(docId);
      
      if (!cim || cim.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      // Get comprehensive view statistics using new tracking system
      const viewStats = await storage.getDocumentViewStats(docId);
      
      // DEBUG: Log analytics calculation
      console.log("🔍 ANALYTICS DEBUG:", {
        docId,
        rawViewStats: viewStats,
        totalViewsType: typeof viewStats.totalViews,
        totalViewsValue: viewStats.totalViews
      });
      
      // Return enhanced analytics with NDA-aware view tracking
      const analytics = {
        totalViews: viewStats.totalViews,
        anonymousViews: viewStats.anonymousViews,
        ndaSignerViews: viewStats.ndaSignerViews,
        uniqueNdaSigners: viewStats.uniqueNdaSigners,
        legacyShareViewCount: cim.shareViewCount || 0,
        ndaProtected: cim.ndaProtected,
        documentType: cim.ndaProtected ? 'nda_protected' : 'public',
        recentViews: viewStats.recentViews,
        dailyViews: viewStats.dailyViews
      };
      
      res.json(analytics);
    } catch (error) {
      console.error('Enhanced analytics error:', error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // NDA Signer View History endpoint
  app.get("/api/cim/:docId/nda-signer-views/:signerEmail", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const signerEmail = decodeURIComponent(req.params.signerEmail);
      
      const doc = await storage.getCimDocument(docId);
      
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!doc.ndaProtected) {
        return res.status(400).json({ error: "Document is not NDA protected" });
      }

      const maxLimit = 100;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, maxLimit);
      const offset = parseInt(req.query.offset as string) || 0;

      const viewHistory = await storage.getNdaSignerViewHistory(docId, signerEmail, { limit, offset });
      res.json(viewHistory);
    } catch (error) {
      console.error("NDA signer view history error:", error);
      res.status(500).json({ error: "Failed to get signer view history" });
    }
  });


  // Public endpoint for verifying checkout sessions (doesn't require auth)
  app.get("/api/subscription/verify-checkout", async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "No session ID provided" });

    try {
      console.log("=== PUBLIC CHECKOUT VERIFICATION ===");
      console.log("Session ID:", session_id);
      
      const result = await verifyCheckoutSession(session_id as string);
      console.log("Verification result:", result);
      
      if (result) {
        const { userId, status, endsAt, subscriptionId, stripeCustomerId } = result;
        console.log("Updating subscription for user:", userId);
        
        // Update subscription in database
        await storage.updateSubscription(userId, status, endsAt, subscriptionId);
        
        // Update Stripe customer ID
        if (stripeCustomerId) {
          await db.update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, userId));
        }
        
        // Invalidate user cache
        invalidateUserCache(userId);
        
        res.json({ 
          success: true, 
          status,
          message: "Subscription verified and activated successfully" 
        });
      } else {
        res.status(404).json({ 
          success: false, 
          error: "Session not found or already processed" 
        });
      }
    } catch (error) {
      console.error("Error verifying checkout session:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to verify session" 
      });
    }
  });

  // Subscription Routes (authenticated version for account page)
  app.get("/api/subscription/verify-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "No session ID provided" });

    try {
      console.log("=== SESSION VERIFICATION DEBUG START ===");
      console.log("Session ID:", session_id);
      console.log("Current user:", { id: req.user?.id, email: req.user?.email, subscriptionStatus: req.user?.subscriptionStatus });
      
      const result = await verifyCheckoutSession(session_id as string);
      console.log("Verification result:", result);
      
      if (result) {
        const { userId, status, endsAt, subscriptionId, stripeCustomerId } = result;
        console.log("About to update subscription:", { userId, status, endsAt, subscriptionId, stripeCustomerId });
        
        // Update subscription in database with full Stripe data
        await storage.updateSubscription(userId, status, endsAt, subscriptionId);
        
        // Also update the Stripe customer ID if we have it
        if (stripeCustomerId) {
          await db.update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, userId));
          console.log("✅ Stripe customer ID updated");
        }
        
        console.log("✅ Database subscription updated");
        
        // Invalidate user cache to force fresh data on next request
        invalidateUserCache(userId);
        console.log("✅ User cache invalidated");
        
        // Refresh user data from database
        const updatedUser = await storage.getUser(userId);
        console.log("Updated user from database:", {
          id: updatedUser?.id,
          email: updatedUser?.email,
          subscriptionStatus: updatedUser?.subscriptionStatus,
          subscriptionEndsAt: updatedUser?.subscriptionEndsAt
        });
        
        // Update session user if this is the same user
        if (req.user?.id === userId) {
          req.user = updatedUser;
          console.log('✅ Session user updated');
        }

        console.log("=== SESSION VERIFICATION DEBUG END ===");
        res.json({ success: true, status, userId, updatedUser: updatedUser });
      } else {
        console.log("❌ Session verification returned null");
        console.log("=== SESSION VERIFICATION DEBUG END ===");
        res.status(400).json({ error: "Invalid or expired session" });
      }
    } catch (error) {
      console.error('Session verification error:', error);
      res.status(500).json({ error: "Failed to verify session" });
    }
  });

  app.post("/api/subscription/create-checkout", async (req, res) => {
    console.log("=== CHECKOUT REQUEST RECEIVED ===");
    console.log("Request body:", req.body);
    console.log("User authenticated:", req.isAuthenticated());
    console.log("Processing subscription for user:", req.user?.id);
    
    const { plan, email } = req.body;
    console.log("Plan requested:", plan);
    
    if (!subscriptionPlans[plan as keyof typeof subscriptionPlans]) {
      console.log("Invalid plan:", plan);
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // For non-authenticated users, they need to provide an email
    if (!req.isAuthenticated() && !email) {
      return res.status(400).json({ error: "Email required for subscription" });
    }

    try {
      // Check if Stripe is properly initialized before proceeding
      if (!stripe) {
        console.error("❌ Stripe subscription creation: Stripe not initialized");
        return res.status(503).json({ 
          error: "Payment processing temporarily unavailable", 
          code: "STRIPE_UNAVAILABLE" 
        });
      }

      // For authenticated users, use their ID and email
      // For non-authenticated users, create a temp session
      let userId = req.user?.id;
      let userEmail = req.user?.email || email;

      const hostHeader = req.get('host');
      console.log("=== STRIPE SESSION CREATION DEBUG ===");
      console.log("Creating Stripe session with host:", hostHeader);
      console.log("Plan:", plan);
      console.log("User email:", userEmail);
      console.log("User ID:", userId);
      console.log("REPLIT_DOMAINS env:", process.env.REPLIT_DOMAINS);
      
      // Get price ID based on plan selection
      const { getPriceIdForPlan } = await import('./stripe');
      const priceId = getPriceIdForPlan(plan);
      console.log(`Using price ID for plan '${plan}':`, priceId);
      
      if (!userId) {
        // For non-authenticated users, we'll create a checkout session without a user ID
        // The webhook will handle user creation upon successful payment
        console.log("Creating checkout for non-authenticated user with email:", userEmail);
      }

      const session = await createSubscriptionSessionDirect(
        plan as keyof typeof subscriptionPlans,
        priceId,
        userEmail,
        userId,
        hostHeader
      );
      res.json({ url: session.url });
    } catch (error) {
      console.error('=== STRIPE SESSION CREATION ERROR ===');
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Full error:', error);
      console.error('Plan requested:', plan);
      console.error('User ID:', req.user?.id);
      console.error('Price IDs available:', {
        starter: process.env.STRIPE_PRICE_ID_STARTER,
        standard: process.env.STRIPE_PRICE_ID_STANDARD
      });
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(400).json({ error: `Failed to create checkout session: ${errorMessage}` });
    }
  });

  // Note: Webhook endpoints are now registered at the top before authentication middleware

  // New route for creating Stripe Customer Portal session with enhanced error handling
  app.post("/api/subscription/create-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Check if Stripe is properly initialized
    if (!stripe) {
      console.error("❌ Customer portal: Stripe not initialized");
      return res.status(503).json({
        error: "Payment processing temporarily unavailable",
        code: "STRIPE_UNAVAILABLE"
      });
    }

    try {
      const session = await createCustomerPortalSession(req.user!.id);
      res.json({ url: session.url });
    } catch (error) {
      console.error('❌ Error creating customer portal session:', error);

      const message = error instanceof Error ? error.message : "Failed to create portal session";

      // Handle specific error cases
      if (message === "No Stripe customer ID found") {
        res.status(400).json({
          error: "Please subscribe to a plan first before managing your subscription",
          code: "NO_CUSTOMER_ID"
        });
      } else if (message.includes("Invalid customer")) {
        res.status(400).json({
          error: "Customer account not found in payment system",
          code: "INVALID_CUSTOMER"
        });
      } else {
        res.status(500).json({
          error: "Failed to access subscription management",
          code: "PORTAL_ERROR",
          details: process.env.NODE_ENV === 'development' ? message : undefined
        });
      }
    }
  });

  // Add additional licenses to existing subscription
  app.post("/api/subscription/add-licenses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Check if Stripe is properly initialized
    if (!stripe) {
      console.error("❌ Add licenses: Stripe not initialized");
      return res.status(503).json({
        error: "Payment processing temporarily unavailable",
        code: "STRIPE_UNAVAILABLE"
      });
    }

    try {
      const { additionalSeats } = req.body;

      if (!additionalSeats || typeof additionalSeats !== 'number' || additionalSeats < 1) {
        return res.status(400).json({
          error: "Invalid number of additional seats",
          code: "INVALID_SEATS"
        });
      }

      const userId = req.user!.id;

      // Add seats to Stripe subscription
      const result = await addSubscriptionSeats(userId, additionalSeats);

      if (result.success) {
        // Update organization seatCount in database
        // First, get the user's organization
        const { organizations, organizationMembers } = await import("@shared/schema");
        const orgMembership = await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId),
              eq(organizationMembers.status, 'active')
            )
          )
          .limit(1);

        if (orgMembership.length > 0) {
          // Update the organization's seat count
          await db
            .update(organizations)
            .set({ seatCount: result.newQuantity })
            .where(eq(organizations.id, orgMembership[0].organizationId));

          console.log(`✅ Updated organization ${orgMembership[0].organizationId} seatCount to ${result.newQuantity}`);
        }

        // Invalidate user cache
        invalidateUserCache(userId);

        res.json({
          success: true,
          newQuantity: result.newQuantity,
          message: `Successfully added ${additionalSeats} license(s). You now have ${result.newQuantity} total licenses.`
        });
      } else {
        res.status(400).json({
          error: result.error || "Failed to add licenses",
          code: "ADD_LICENSES_FAILED"
        });
      }
    } catch (error) {
      console.error('❌ Error adding licenses:', error);

      const message = error instanceof Error ? error.message : "Failed to add licenses";

      if (message.includes("No active subscription")) {
        res.status(400).json({
          error: "Please subscribe to a plan first before adding licenses",
          code: "NO_SUBSCRIPTION"
        });
      } else {
        res.status(500).json({
          error: message,
          code: "ADD_LICENSES_ERROR"
        });
      }
    }
  });


  // Collaboration routes
  // Start editing a document (acquire lock)
  app.post("/api/cim/:id/start-editing", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;
      const userName = req.user!.name || req.user!.email;

      // Collaboration features are now available to all users
      const user = await storage.getUser(userId);

      // Check document access
      const doc = await storage.getCimDocument(docId);
      if (!doc) return res.sendStatus(404);

      // Check if user owns the document or is a collaborator
      let hasAccess = doc.userId === userId;
      if (!hasAccess) {
        const collaboratorAccess = await storage.getCollaboratorAccess(docId, userId);
        hasAccess = collaboratorAccess?.permission === 'edit';
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "No edit access to this document" });
      }

      const success = await storage.startEditing(docId, userId, userName);
      
      if (!success) {
        const updatedDoc = await storage.getCimDocument(docId);
        return res.status(409).json({ 
          error: "Document is currently being edited",
          currentEditor: updatedDoc?.currentEditorName,
          editStartedAt: updatedDoc?.editStartedAt
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Start editing error:", error);
      res.status(500).json({ error: "Failed to start editing" });
    }
  });

  // Stop editing a document (release lock)
  app.post("/api/cim/:id/stop-editing", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      await storage.stopEditing(docId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Stop editing error:", error);
      res.status(500).json({ error: "Failed to stop editing" });
    }
  });

  // Heartbeat to maintain editing session
  app.post("/api/cim/:id/heartbeat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      await storage.heartbeat(docId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Heartbeat error:", error);
      res.status(500).json({ error: "Failed to send heartbeat" });
    }
  });

  // Check editing status
  app.get("/api/cim/:id/editing-status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc) return res.sendStatus(404);

      // Check if current editing session is active (within 5 minutes)
      let isBeingEdited = false;
      let currentEditor = null;
      
      if (doc.currentEditorId && doc.lastActivityAt) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (doc.lastActivityAt > fiveMinutesAgo) {
          isBeingEdited = true;
          currentEditor = {
            id: doc.currentEditorId,
            name: doc.currentEditorName,
            editStartedAt: doc.editStartedAt
          };
        }
      }

      res.json({
        isBeingEdited,
        currentEditor,
        canEdit: !isBeingEdited || doc.currentEditorId === req.user!.id
      });
    } catch (error) {
      console.error("Check editing status error:", error);
      res.status(500).json({ error: "Failed to check editing status" });
    }
  });

  // Invite collaborator
  app.post("/api/cim/:id/invite", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Collaboration features are now available to all users
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Validate request body
      const validation = insertCollaboratorSchema.safeParse({
        ...req.body,
        cimDocumentId: docId,
        invitedBy: userId
      });

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors });
      }

      // Check document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== userId) {
        return res.status(403).json({ error: "Only document owner can invite collaborators" });
      }

      // Check subscription limits
      const currentCollaboratorCount = await storage.getCollaboratorCount(docId);
      const subscriptionPlan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans] || subscriptionPlans.free;

      let collaboratorLimit = 0;
      switch (user.subscriptionStatus) {
        case 'starter':
          collaboratorLimit = 1;
          break;
        case 'standard':
          collaboratorLimit = 3;
          break;
        case 'enterprise':
        case 'admin':
          collaboratorLimit = 999; // Unlimited
          break;
        default:
          collaboratorLimit = 0; // Free users can't add collaborators
          break;
      }

      if (currentCollaboratorCount >= collaboratorLimit) {
        return res.status(403).json({
          error: "Collaborator limit reached for your subscription plan",
          limit: collaboratorLimit,
          current: currentCollaboratorCount
        });
      }

      const collaborator = await storage.inviteCollaborator(validation.data);

      // Send invitation email
      try {
        const inviteeName = validation.data.email.split('@')[0]; // Use email prefix if no name provided
        const inviterProfile = await storage.getUserProfile(userId);
        const inviterName = inviterProfile?.firstName
          ? `${inviterProfile.firstName}${inviterProfile.lastName ? ' ' + inviterProfile.lastName : ''}`
          : (inviterProfile?.name || inviterProfile?.email || 'Someone');

        await sendCollaborationInvitationEmail(
          validation.data.email,
          inviteeName,
          doc.title,
          inviterName,
          validation.data.permission,
          collaborator.inviteToken
        );
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Continue even if email fails - collaborator is already added
      }

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_invited", {
        collaboratorEmail: validation.data.email,
        permission: validation.data.permission
      });

      res.json(collaborator);
    } catch (error) {
      console.error("Invite collaborator error:", error);
      res.status(500).json({ error: "Failed to invite collaborator", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Helper function for access control
  async function getUserDocumentPermission(
    documentId: number,
    userId: number
  ): Promise<"owner" | "edit" | "assist" | null> {
    const document = await storage.getCimDocument(documentId);
    if (!document) return null;
    if (document.userId === userId) return "owner";

    const collaboration = await storage.getCollaboratorAccess(documentId, userId);
    if (collaboration?.permission === "Edit") return "edit";
    if (collaboration?.permission === "Assist") return "assist";

    return null;
  }

  // Get collaborators for a document
  app.get("/api/cim/:id/collaborators", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check document access
      const doc = await storage.getCimDocument(docId);
      if (!doc) return res.sendStatus(404);

      // Only owner or collaborators can see the collaborator list
      let hasAccess = doc.userId === userId;
      if (!hasAccess) {
        const collaboratorAccess = await storage.getCollaboratorAccess(docId, userId);
        hasAccess = !!collaboratorAccess;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "No access to this document" });
      }

      const collaborators = await storage.getCollaborators(docId);
      res.json(collaborators);
    } catch (error) {
      console.error("Get collaborators error:", error);
      res.status(500).json({ error: "Failed to get collaborators" });
    }
  });

  // Update collaborator permission
  app.patch("/api/cim/:docId/collaborators/:collaboratorId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const collaboratorId = parseInt(req.params.collaboratorId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner") {
        return res.status(403).json({ error: "Only document owner can update collaborator permissions" });
      }

      const { permission: newPermission } = req.body;
      if (!newPermission || !["Edit", "Assist"].includes(newPermission)) {
        return res.status(400).json({ error: "Invalid permission. Must be 'Edit' or 'Assist'" });
      }

      await storage.updateCollaborator(collaboratorId, { permission: newPermission });
      
      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_permission_changed", {
        collaboratorId,
        newPermission
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Update collaborator error:", error);
      res.status(500).json({ error: "Failed to update collaborator" });
    }
  });

  // Remove collaborator
  app.delete("/api/cim/:docId/collaborators/:collaboratorId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const collaboratorId = parseInt(req.params.collaboratorId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner") {
        return res.status(403).json({ error: "Only document owner can remove collaborators" });
      }

      const collaborators = await storage.getCollaborators(docId);
      const collaborator = collaborators.find(c => c.id === collaboratorId);

      if (!collaborator) {
        return res.status(404).json({ error: "Collaborator not found" });
      }

      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.deleteCollaborator(collaboratorId);

      if (collaborator.userId) {
        await storage.releaseUserLocks(collaborator.userId, docId);
      }

      // Send removal email notification
      const collaboratorName = collaborator.email.split('@')[0];
      const removerProfile = await storage.getUserProfile(userId);
      const removerName = removerProfile?.firstName
        ? `${removerProfile.firstName}${removerProfile.lastName ? ' ' + removerProfile.lastName : ''}`
        : (removerProfile?.name || removerProfile?.email || 'The document owner');

      await sendCollaboratorRemovedEmail(
        collaborator.email,
        collaboratorName,
        doc.title,
        removerName
      );

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_removed", {
        collaboratorId,
        collaboratorEmail: collaborator.email
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove collaborator error:", error);
      res.status(500).json({ error: "Failed to remove collaborator" });
    }
  });

  // Get pending invitations for current user
  app.get("/api/collaborator/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const userEmail = req.user!.email;
      const pendingInvitations = await storage.getPendingInvitationsByEmail(userEmail);

      // Enrich with document details
      const enrichedInvitations = await Promise.all(
        pendingInvitations.map(async (invitation) => {
          const document = await storage.getCimDocument(invitation.cimDocumentId);
          const inviter = await storage.getUser(invitation.invitedBy);

          return {
            id: invitation.id,
            documentId: invitation.cimDocumentId,
            documentTitle: document?.title || "Unknown Document",
            inviterName: inviter?.firstName && inviter?.lastName
              ? `${inviter.firstName} ${inviter.lastName}`
              : (inviter?.name || inviter?.email || "Unknown"),
            inviterEmail: inviter?.email || "",
            permission: invitation.permission,
            invitedAt: invitation.invitedAt,
            inviteToken: invitation.inviteToken
          };
        })
      );

      res.json(enrichedInvitations);
    } catch (error) {
      console.error("Get pending invitations error:", error);
      res.status(500).json({ error: "Failed to get pending invitations" });
    }
  });

  // Get invitation details (public - no auth required)
  app.get("/api/collaborator/invitation/:token", async (req, res) => {
    try {
      const token = req.params.token;

      const collaborator = await storage.getCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      // Get document details
      const document = await storage.getCimDocument(collaborator.cimDocumentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get inviter details
      const inviter = await storage.getUser(collaborator.invitedBy);
      if (!inviter) {
        return res.status(404).json({ error: "Inviter not found" });
      }

      // Return public invitation info
      res.json({
        documentTitle: document.title,
        inviterName: inviter.firstName && inviter.lastName
          ? `${inviter.firstName} ${inviter.lastName}`
          : (inviter.name || inviter.email),
        inviterEmail: inviter.email,
        permission: collaborator.permission,
        invitedEmail: collaborator.email,
        status: collaborator.status,
        alreadyAccepted: collaborator.status === "active"
      });
    } catch (error) {
      console.error("Get invitation details error:", error);
      res.status(500).json({ error: "Failed to get invitation details" });
    }
  });

  // Accept collaboration invitation
  app.post("/api/collaborator/accept/:token", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const token = req.params.token;
      const userId = req.user!.id;

      const collaborator = await storage.getCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      if (collaborator.status === "active") {
        return res.status(400).json({ error: "Invitation already accepted" });
      }

      await storage.updateCollaborator(collaborator.id, {
        status: "active",
        acceptedAt: new Date(),
        userId
      });

      await storage.logActivity(collaborator.cimDocumentId, userId, req.user!.name || null, req.user!.email, "collaborator_accepted", {
        collaboratorId: collaborator.id
      });

      res.json({ success: true, documentId: collaborator.cimDocumentId });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Self-remove from document
  app.post("/api/cim/:docId/collaborators/:collaboratorId/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const collaboratorId = parseInt(req.params.collaboratorId);
      const userId = req.user!.id;

      const collaborators = await storage.getCollaborators(docId);
      const collaborator = collaborators.find(c => c.id === collaboratorId);

      if (!collaborator || collaborator.userId !== userId) {
        return res.status(403).json({ error: "You can only remove yourself" });
      }

      await storage.deleteCollaborator(collaboratorId);
      await storage.releaseUserLocks(userId, docId);

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_left", {
        collaboratorId
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Leave collaboration error:", error);
      res.status(500).json({ error: "Failed to leave collaboration" });
    }
  });

  // Get lock status
  app.get("/api/cim/:docId/lock/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (!permission) {
        return res.status(403).json({ error: "No access to this document" });
      }

      const lock = await storage.getLock(docId);
      if (!lock) {
        return res.json({ locked: false });
      }

      // If the lock belongs to the current user, don't show it as "locked by someone else"
      if (lock.userId === userId) {
        return res.json({ locked: false });
      }

      const duration = Date.now() - new Date(lock.lockedAt).getTime();
      res.json({
        locked: true,
        user: {
          name: lock.userName,
          email: lock.userEmail,
          lockedAt: lock.lockedAt,
          duration
        }
      });
    } catch (error) {
      console.error("Get lock status error:", error);
      res.status(500).json({ error: "Failed to get lock status" });
    }
  });

  // Acquire edit lock
  app.post("/api/cim/:docId/lock", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner" && permission !== "edit") {
        return res.status(403).json({ error: "Only owners and editors can acquire locks" });
      }

      const existingLock = await storage.getLock(docId);
      if (existingLock && existingLock.userId !== userId) {
        return res.status(409).json({ 
          success: false, 
          error: "Document is locked by another user",
          user: {
            name: existingLock.userName,
            email: existingLock.userEmail
          }
        });
      }

      const lock = await storage.createLock(docId, userId, req.user!.name || "Unknown", req.user!.email);

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "lock_acquired", {});

      res.json({ success: true, lock });
    } catch (error) {
      console.error("Acquire lock error:", error);
      res.status(500).json({ error: "Failed to acquire lock" });
    }
  });

  // Take over edit lock
  app.post("/api/cim/:docId/lock/takeover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner" && permission !== "edit") {
        return res.status(403).json({ error: "Only owners and editors can take over locks" });
      }

      const existingLock = await storage.getLock(docId);
      const previousUser = existingLock ? existingLock.userName : null;
      const previousUserId = existingLock ? existingLock.userId : null;
      const previousUserEmail = existingLock ? existingLock.userEmail : null;

      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const lock = await storage.createLock(docId, userId, req.user!.name || "Unknown", req.user!.email, previousUserId || undefined);

      // Send email notification to previous editor
      if (previousUserEmail && previousUser) {
        const newEditorName = req.user!.name || req.user!.email || "Another user";
        await sendEditLockTakenOverEmail(
          previousUserEmail,
          previousUser,
          doc.title,
          newEditorName
        );
      }

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "lock_taken_over", {
        previousUser,
        previousUserId
      });

      res.json({ success: true, previousUser });
    } catch (error) {
      console.error("Takeover lock error:", error);
      res.status(500).json({ error: "Failed to take over lock" });
    }
  });

  // Release edit lock
  app.delete("/api/cim/:docId/lock", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner" && permission !== "edit") {
        return res.status(403).json({ error: "Only owners and editors can release locks" });
      }

      const existingLock = await storage.getLock(docId);
      if (existingLock && existingLock.userId !== userId) {
        return res.status(403).json({ error: "You can only release your own locks" });
      }

      await storage.releaseLock(docId);

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "lock_released", {});

      res.json({ success: true });
    } catch (error) {
      console.error("Release lock error:", error);
      res.status(500).json({ error: "Failed to release lock" });
    }
  });

  // Lock heartbeat
  app.post("/api/cim/:docId/lock/heartbeat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const existingLock = await storage.getLock(docId);
      if (!existingLock || existingLock.userId !== userId) {
        return res.status(403).json({ error: "You don't hold the lock" });
      }

      await storage.updateLockActivity(docId);

      res.json({ success: true });
    } catch (error) {
      console.error("Lock heartbeat error:", error);
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  // Get activity log
  app.get("/api/cim/:docId/activity", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (!permission) {
        return res.status(403).json({ error: "No access to this document" });
      }

      const maxLimit = 100;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, maxLimit);
      const offset = parseInt(req.query.offset as string) || 0;

      const activities = await storage.getActivityLog(docId, { limit, offset });

      res.json(activities);
    } catch (error) {
      console.error("Get activity log error:", error);
      res.status(500).json({ error: "Failed to get activity log" });
    }
  });

  // Premium Feature: Document Search
  app.get("/api/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      // Search features are now available to all users

      const { q: query, start, end } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      const filters: any = {};
      if (start && end) {
        filters.dateRange = {
          start: new Date(start as string),
          end: new Date(end as string)
        };
      }

      const results = await searchService.searchDocuments(req.user!.id, query, filters);
      
      // Track search analytics
      await analyticsService.trackAction(0, req.user!.id, 'search', { query, resultCount: results.length });

      res.json({ results, total: results.length });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Premium Feature: Version History
  app.get("/api/cim/:id/versions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      // Version history is now available to all users

      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const versions = await versionService.getVersionHistory(docId);
      res.json(versions);
    } catch (error) {
      console.error("Version history error:", error);
      res.status(500).json({ error: "Failed to get version history" });
    }
  });

  // Premium Feature: Restore Version
  app.post("/api/cim/:id/restore/:version", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || !hasPremiumAccess(user)) {
        return res.status(403).json({ 
          error: "Version restore requires a premium subscription",
          upgradeRequired: true 
        });
      }

      const docId = parseInt(req.params.id);
      const targetVersion = parseInt(req.params.version);
      
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const restoredVersion = await versionService.restoreVersion(docId, targetVersion, req.user!.id);
      
      // Track analytics
      await analyticsService.trackAction(docId, req.user!.id, 'restore_version', { targetVersion });

      res.json({ success: true, version: restoredVersion });
    } catch (error) {
      console.error("Version restore error:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  // Premium Feature: Document Analytics
  app.get("/api/cim/:id/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      // Analytics are now available to all users

      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const { start, end } = req.query;
      const timeRange = start && end ? {
        start: new Date(start as string),
        end: new Date(end as string)
      } : undefined;

      const analytics = await analyticsService.getDocumentAnalytics(docId, timeRange);
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // User Analytics Dashboard - Available to all users
  app.get("/api/analytics/dashboard", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { start, end } = req.query;
      const timeRange = start && end ? {
        start: new Date(start as string),
        end: new Date(end as string)
      } : undefined;

      const userAnalytics = await analyticsService.getUserAnalytics(req.user!.id, timeRange);
      res.json(userAnalytics);
    } catch (error) {
      console.error("User analytics error:", error);
      res.status(500).json({ error: "Failed to get user analytics" });
    }
  });

  // Analytics Overview - Aggregate analytics across all user's documents
  app.get("/api/analytics/overview", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { cimDocuments, documentViews, ndaSignatures } = await import('@shared/schema');
      const { count: countFn, gte, lt, isNull } = await import('drizzle-orm');

      const range = (req.query.range as string) || '30d';

      // Get all user's CIM documents
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));
      
      const docIds = userDocs.map(doc => doc.id);

      if (docIds.length === 0) {
        return res.json({
          totalViews: 0,
          totalSignatures: 0,
          pendingApprovals: 0,
          activeDocuments: 0,
          viewsTrend: 0,
          signaturesTrend: 0
        });
      }

      // Calculate date ranges based on range parameter
      const now = new Date();
      let rangeDays: number;
      let currentStartDate: Date;
      let previousStartDate: Date;
      let previousEndDate: Date;

      switch (range) {
        case '7d':
          rangeDays = 7;
          break;
        case '30d':
          rangeDays = 30;
          break;
        case '90d':
          rangeDays = 90;
          break;
        case 'all':
          rangeDays = 0;
          break;
        default:
          rangeDays = 30;
      }

      if (range === 'all') {
        currentStartDate = new Date(0);
        previousStartDate = new Date(0);
        previousEndDate = new Date(0);
      } else {
        currentStartDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
        previousEndDate = currentStartDate;
        previousStartDate = new Date(currentStartDate.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      }

      // Count views in current period
      const [currentViewsResult] = await db
        .select({ count: countFn() })
        .from(documentViews)
        .where(and(
          inArray(documentViews.cimDocumentId, docIds),
          range === 'all' ? sql`1=1` : gte(documentViews.viewedAt, currentStartDate)
        ));
      const totalViews = Number(currentViewsResult?.count || 0);

      // Count signatures in current period
      const [currentSigsResult] = await db
        .select({ count: countFn() })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          range === 'all' ? sql`1=1` : gte(ndaSignatures.signedAt, currentStartDate)
        ));
      const totalSignatures = Number(currentSigsResult?.count || 0);

      // Count pending approvals (always total, not affected by date range)
      const [pendingResult] = await db
        .select({ count: countFn() })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          eq(ndaSignatures.approved, false),
          eq(ndaSignatures.rejected, false)
        ));
      const pendingApprovals = Number(pendingResult?.count || 0);

      // Count active documents (always total, not affected by date range)
      const [activeResult] = await db
        .select({ count: countFn() })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          eq(cimDocuments.shareEnabled, true),
          isNull(cimDocuments.deletedAt)
        ));
      const activeDocuments = Number(activeResult?.count || 0);

      // Calculate trends (compare current period vs previous period of same length)
      let viewsTrend = 0;
      let signaturesTrend = 0;

      if (range !== 'all') {
        // Previous period views
        const [previousViewsResult] = await db
          .select({ count: countFn() })
          .from(documentViews)
          .where(and(
            inArray(documentViews.cimDocumentId, docIds),
            gte(documentViews.viewedAt, previousStartDate),
            lt(documentViews.viewedAt, previousEndDate)
          ));
        const previousViews = Number(previousViewsResult?.count || 0);

        // Previous period signatures
        const [previousSigsResult] = await db
          .select({ count: countFn() })
          .from(ndaSignatures)
          .where(and(
            inArray(ndaSignatures.cimDocumentId, docIds),
            gte(ndaSignatures.signedAt, previousStartDate),
            lt(ndaSignatures.signedAt, previousEndDate)
          ));
        const previousSignatures = Number(previousSigsResult?.count || 0);

        // Calculate percentage trends (handle division by zero)
        viewsTrend = previousViews > 0 
          ? Math.round(((totalViews - previousViews) / previousViews) * 100)
          : totalViews > 0 ? 100 : 0;

        signaturesTrend = previousSignatures > 0
          ? Math.round(((totalSignatures - previousSignatures) / previousSignatures) * 100)
          : totalSignatures > 0 ? 100 : 0;
      }

      res.json({
        totalViews,
        totalSignatures,
        pendingApprovals,
        activeDocuments,
        viewsTrend,
        signaturesTrend
      });
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Analytics Timeline - Time-series data for views and signatures
  app.get("/api/analytics/timeline", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { cimDocuments, documentViews, ndaSignatures } = await import('@shared/schema');
      const { gte, isNull } = await import('drizzle-orm');

      const range = (req.query.range as string) || '30d';
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get all user's CIM documents
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));
      
      const docIds = userDocs.map(doc => doc.id);

      if (docIds.length === 0) {
        return res.json([]);
      }

      // Get views grouped by date
      const viewsByDate = await db
        .select({
          date: sql<string>`DATE(${documentViews.viewedAt})`,
          count: sql<number>`COUNT(*)::int`
        })
        .from(documentViews)
        .where(and(
          inArray(documentViews.cimDocumentId, docIds),
          gte(documentViews.viewedAt, startDate)
        ))
        .groupBy(sql`DATE(${documentViews.viewedAt})`);

      // Get signatures grouped by date
      const signaturesByDate = await db
        .select({
          date: sql<string>`DATE(${ndaSignatures.signedAt})`,
          count: sql<number>`COUNT(*)::int`
        })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          gte(ndaSignatures.signedAt, startDate)
        ))
        .groupBy(sql`DATE(${ndaSignatures.signedAt})`);

      // Create a map for quick lookup
      const viewsMap = new Map(viewsByDate.map(v => [v.date, Number(v.count)]));
      const signaturesMap = new Map(signaturesByDate.map(s => [s.date, Number(s.count)]));

      // Get all unique dates
      const allDates = new Set([...viewsMap.keys(), ...signaturesMap.keys()]);

      // Build timeline array
      const timeline = Array.from(allDates).map(date => ({
        date,
        views: viewsMap.get(date) || 0,
        signatures: signaturesMap.get(date) || 0
      }));

      // Sort by date ascending
      timeline.sort((a, b) => a.date.localeCompare(b.date));

      res.json(timeline);
    } catch (error) {
      console.error('Error fetching analytics timeline:', error);
      res.status(500).json({ error: "Failed to fetch analytics timeline" });
    }
  });

  // Analytics Documents - Per-document analytics
  app.get("/api/analytics/documents", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { cimDocuments, documentViews, ndaSignatures } = await import('@shared/schema');
      const { isNull } = await import('drizzle-orm');

      // Get all user's CIM documents
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title,
          shareEnabled: cimDocuments.shareEnabled
        })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));

      if (userDocs.length === 0) {
        return res.json([]);
      }

      // Get view counts and time spent for each document
      const viewCounts = await db
        .select({
          cimDocumentId: documentViews.cimDocumentId,
          count: sql<number>`COUNT(*)::int`,
          totalTimeSpent: sql<number>`COALESCE(SUM(${documentViews.timeSpentSeconds}), 0)::int`,
          lastViewedAt: sql<Date>`MAX(${documentViews.viewedAt})`
        })
        .from(documentViews)
        .where(inArray(documentViews.cimDocumentId, userDocs.map(d => d.id)))
        .groupBy(documentViews.cimDocumentId);

      // Get signature counts for each document
      const signatureCounts = await db
        .select({
          cimDocumentId: ndaSignatures.cimDocumentId,
          count: sql<number>`COUNT(*)::int`,
          lastSignedAt: sql<Date>`MAX(${ndaSignatures.signedAt})`
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, userDocs.map(d => d.id)))
        .groupBy(ndaSignatures.cimDocumentId);

      // Get download counts for each document
      const downloadCounts = await db
        .select({
          cimDocumentId: documentDownloads.cimDocumentId,
          count: sql<number>`COUNT(*)::int`
        })
        .from(documentDownloads)
        .where(inArray(documentDownloads.cimDocumentId, userDocs.map(d => d.id)))
        .groupBy(documentDownloads.cimDocumentId);

      // Create maps for quick lookup
      const viewsMap = new Map(viewCounts.map(v => [v.cimDocumentId, {
        count: Number(v.count),
        totalTimeSpent: Number(v.totalTimeSpent),
        lastViewedAt: v.lastViewedAt
      }]));

      const signaturesMap = new Map(signatureCounts.map(s => [s.cimDocumentId, {
        count: Number(s.count),
        lastSignedAt: s.lastSignedAt
      }]));

      const downloadsMap = new Map(downloadCounts.map(d => [d.cimDocumentId, Number(d.count)]));

      // Build document analytics array
      const documentAnalytics = userDocs.map(doc => {
        const views = viewsMap.get(doc.id);
        const signatures = signaturesMap.get(doc.id);
        const downloads = downloadsMap.get(doc.id) || 0;

        // Determine last activity (most recent of view or signature)
        const lastViewDate = views?.lastViewedAt ? new Date(views.lastViewedAt) : null;
        const lastSignDate = signatures?.lastSignedAt ? new Date(signatures.lastSignedAt) : null;

        let lastActivity: string | null = null;
        if (lastViewDate && lastSignDate) {
          lastActivity = (lastViewDate > lastSignDate ? lastViewDate : lastSignDate).toISOString();
        } else if (lastViewDate) {
          lastActivity = lastViewDate.toISOString();
        } else if (lastSignDate) {
          lastActivity = lastSignDate.toISOString();
        }

        // Calculate average time per view
        const avgTimePerView = views?.count ? Math.round((views.totalTimeSpent || 0) / views.count) : 0;

        return {
          id: doc.id,
          title: doc.title,
          views: views?.count || 0,
          signatures: signatures?.count || 0,
          downloads,
          totalTimeSpent: views?.totalTimeSpent || 0,
          avgTimePerView,
          shareEnabled: doc.shareEnabled,
          lastActivity
        };
      });

      // Sort by views descending
      documentAnalytics.sort((a, b) => b.views - a.views);

      res.json(documentAnalytics);
    } catch (error) {
      console.error('Error fetching document analytics:', error);
      res.status(500).json({ error: "Failed to fetch document analytics" });
    }
  });

  // Analytics Pending Approvals - Get all pending NDA approvals
  app.get("/api/analytics/pending-approvals", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { cimDocuments, ndaSignatures } = await import('@shared/schema');
      const { isNull } = await import('drizzle-orm');

      // Get all user's CIM documents that have approval required
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title
        })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          eq(cimDocuments.ndaApprovalRequired, true),
          isNull(cimDocuments.deletedAt)
        ));

      if (userDocs.length === 0) {
        return res.json([]);
      }

      const docIds = userDocs.map(doc => doc.id);

      // Get all pending signatures (approved = false AND rejected = false)
      const pendingSignatures = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signerLocation: ndaSignatures.signerLocation,
          signedAt: ndaSignatures.signedAt
        })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          eq(ndaSignatures.approved, false),
          eq(ndaSignatures.rejected, false)
        ))
        .orderBy(desc(ndaSignatures.signedAt));

      // Create a map for document titles
      const docTitlesMap = new Map(userDocs.map(doc => [doc.id, doc.title]));

      // Format the response
      const pendingApprovals = pendingSignatures.map(sig => ({
        id: sig.id,
        documentId: sig.cimDocumentId,
        documentTitle: docTitlesMap.get(sig.cimDocumentId) || 'Unknown Document',
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signerLocation: sig.signerLocation || '',
        signedAt: sig.signedAt.toISOString()
      }));

      res.json(pendingApprovals);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // Analytics All Signatures - Get all NDA signatures across all user's documents
  app.get("/api/analytics/all-signatures", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { cimDocuments, ndaSignatures } = await import('@shared/schema');
      const { isNull } = await import('drizzle-orm');

      // Get all user's CIM documents
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title
        })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));

      if (userDocs.length === 0) {
        return res.json([]);
      }

      const docIds = userDocs.map(doc => doc.id);

      // Get all signatures (approved and unapproved)
      const allSignatures = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signerLocation: ndaSignatures.signerLocation,
          signedAt: ndaSignatures.signedAt
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, docIds))
        .orderBy(desc(ndaSignatures.signedAt));

      // Create a map for document titles
      const docTitlesMap = new Map(userDocs.map(doc => [doc.id, doc.title]));

      // Format the response
      const signatures = allSignatures.map(sig => ({
        id: sig.id,
        documentId: sig.cimDocumentId,
        documentTitle: docTitlesMap.get(sig.cimDocumentId) || 'Unknown Document',
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signerLocation: sig.signerLocation || '',
        signedAt: sig.signedAt.toISOString()
      }));

      res.json(signatures);
    } catch (error) {
      console.error('Error fetching all signatures:', error);
      res.status(500).json({ error: "Failed to fetch signatures" });
    }
  });

  // View tracking heartbeat - updates time spent for a viewing session
  app.post("/api/track/heartbeat", async (req, res) => {
    try {
      const { sessionId, additionalSeconds } = req.body;

      if (!sessionId || typeof additionalSeconds !== 'number') {
        return res.status(400).json({ error: "Missing sessionId or additionalSeconds" });
      }

      await storage.updateViewHeartbeat(sessionId, additionalSeconds);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating heartbeat:', error);
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  // Track document download
  app.post("/api/track/download", async (req, res) => {
    try {
      const { documentId, downloadType, viewerEmail, sessionId } = req.body;

      if (!documentId || !downloadType) {
        return res.status(400).json({ error: "Missing documentId or downloadType" });
      }

      const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';

      await storage.trackDocumentDownload(documentId, downloadType, {
        viewerEmail,
        viewerIdentifier: sessionId,
        ipAddress: clientIp,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking download:', error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });

  // Get signer analytics for a specific document and signer
  app.get("/api/cim/:docId/signer-analytics/:signerEmail", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signerEmail = decodeURIComponent(req.params.signerEmail);

      // Verify user owns the document
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const analytics = await storage.getSignerAnalytics(docId, signerEmail);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching signer analytics:', error);
      res.status(500).json({ error: "Failed to fetch signer analytics" });
    }
  });

  // Get download stats for a document
  app.get("/api/cim/:id/download-stats", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.id);

      // Verify user owns the document
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const stats = await storage.getDocumentDownloadStats(docId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching download stats:', error);
      res.status(500).json({ error: "Failed to fetch download stats" });
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

  // Admin Routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !isAuthorizedAdmin(req.user)) {
      return res.sendStatus(401);
    }

    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = (page - 1) * limit;

      const [users, totalCount] = await Promise.all([
        storage.getAllUsers({ limit, offset }),
        storage.getUsersCount()
      ]);
      // SECURITY: Sanitize user data for admin view - exclude passwords, tokens, and sensitive fields
      const sanitizedUsers = users.map(user => sanitizeUser(user));
      res.json({
        users: sanitizedUsers,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + users.length < totalCount
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/subscription", async (req, res) => {
    if (!req.isAuthenticated() || !isAuthorizedAdmin(req.user)) {
      return res.sendStatus(401);
    }

    const { userId, status, months } = req.body;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await storage.updateSubscription(userId, status, endsAt);
    res.sendStatus(200);
  });

  app.post("/api/admin/grant-admin", async (req, res) => {
    if (!req.isAuthenticated() || !isAuthorizedAdmin(req.user)) {
      return res.sendStatus(401);
    }

    const { email } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user in the database to make them an admin with unlimited CIMs
    await db.update(users).set({ 
      isAdmin: true,
      subscriptionStatus: 'admin'
    }).where(eq(users.id, user.id));
    res.sendStatus(200);
  });

  // REMOVED: Auto-grant admin endpoint was a security vulnerability
  // Admin privileges should be granted through a secure admin panel or direct database access only

  app.post("/api/cim/export/word/:id", async (req, res) => {
    console.log("Word export request received for document ID:", req.params.id);
    
    if (!req.isAuthenticated()) {
      console.log("Word export authentication error - User not authenticated");
      return res.sendStatus(401);
    }

    try {
      console.log("User authenticated, retrieving document");
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc) {
        console.log(`Document with ID ${docId} not found`);
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (doc.userId !== req.user!.id) {
        console.log(`Access error: Document belongs to user ${doc.userId}, request from user ${req.user!.id}`);
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      console.log(`User subscription status: ${user?.subscriptionStatus}, isAdmin: ${user?.isAdmin}`);
      
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
        console.log("Permission error: User does not have premium/admin access");
      }

      console.log("Generating Word document with complete data...");
      console.log("Document object logoUrl field:", doc.logoUrl);
      console.log("Document object keys:", Object.keys(doc));
      const userProfile = {
        name: user?.name,
        title: user?.title,
        phoneNumber: user?.phoneNumber,
        email: user?.email,
        businessName: user?.businessName,
        businessLogo: user?.businessLogo,
        profilePhoto: user?.profilePhoto
      };
      
      // Get financial data from CIM document
      const financialData = {
        enabled: doc.financialsEnabled || false,
        askingPrice: doc.askingPrice,
        askingPriceIncluded: doc.askingPriceIncluded || false,
        revenue: doc.revenue,
        revenueIncluded: doc.revenueIncluded || false,
        ebitda: doc.ebitda,
        ebitdaIncluded: doc.ebitdaIncluded || false
      };
      
      const buffer = await generateWordDocument(doc.analysis, doc.logoUrl || undefined, doc.websiteUrl || undefined, doc.selectedImages ? doc.selectedImages : undefined, userProfile, financialData, doc.id);
      console.log(`Word document generated, size: ${buffer.length} bytes`);
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      // Use the document title in the filename for better user experience
      const safeTitle = doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      res.setHeader("Content-Disposition", `attachment; filename=cim-${safeTitle}.docx`);
      
      console.log("Sending Word document to client");
      res.send(buffer);
      console.log("Word document sent successfully");
    } catch (error) {
      console.error("Word export error:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  app.post("/api/cim/export/pdf/:id", async (req, res) => {
    console.log("PDF export request received for document ID:", req.params.id);
    
    if (!req.isAuthenticated()) {
      console.log("PDF export authentication error - User not authenticated");
      return res.sendStatus(401);
    }

    try {
      console.log("User authenticated, retrieving document");
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);
      
      if (!doc) {
        console.log(`Document with ID ${docId} not found`);
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (doc.userId !== req.user!.id) {
        console.log(`Access error: Document belongs to user ${doc.userId}, request from user ${req.user!.id}`);
        return res.status(404).json({ error: "Document not found" });
      }

      // Parallel data fetching for better performance
      const [user, customSections, documentFinancialFiles] = await Promise.all([
        storage.getUser(req.user!.id),
        storage.getCustomSections(docId),
        db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, docId))
      ]);
      
      console.log(`User subscription status: ${user?.subscriptionStatus}, isAdmin: ${user?.isAdmin}`);
      
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
        console.log("Permission error: User does not have premium/admin access");
      }

      console.log("Generating PDF document with complete data...");
      
      // Prepare user profile and financial data
      const userProfile = {
        name: user?.name,
        title: user?.title,
        phoneNumber: user?.phoneNumber,
        email: user?.email,
        businessName: user?.businessName,
        businessLogo: user?.businessLogo,
        profilePhoto: user?.profilePhoto
      };
      
      const financialData = {
        enabled: doc.financialsEnabled || false,
        askingPrice: doc.askingPrice,
        askingPriceIncluded: doc.askingPriceIncluded || false,
        revenue: doc.revenue,
        revenueIncluded: doc.revenueIncluded || false,
        ebitda: doc.ebitda,
        ebitdaIncluded: doc.ebitdaIncluded || false
      };
      
      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || 'cimshare.com';
      // Use production domain for image URLs in production environment
      let baseUrl;
      if (process.env.NODE_ENV === 'production' || host?.includes('cimshare.com')) {
        baseUrl = 'https://cimshare.com';
      } else {
        baseUrl = `${protocol}://${host}`;
      }
      
      // Get user's PDF template preferences
      const pdfTemplate = userProfile.pdfBackgroundTemplate || 'classic';
      const brandedPdfTemplate = userProfile.brandedPdfTemplate || 'none';

      // Build effective brand colors: use user-selected colors if set, otherwise fall back to extracted colors
      const extractedColors = userProfile.brandColors || [];
      const effectivePrimaryColor = userProfile.pdfPrimaryColor || (extractedColors[0] as string) || '#3b82f6';
      const effectiveSecondaryColor = userProfile.pdfSecondaryColor || (extractedColors[1] as string) || '#e5e7eb';
      const brandColors = [effectivePrimaryColor, effectiveSecondaryColor];

      const processedBusinessLogo = userProfile.businessLogo ?
        (userProfile.businessLogo.startsWith('http') || userProfile.businessLogo.startsWith('data:')
          ? userProfile.businessLogo
          : `${baseUrl}${userProfile.businessLogo.startsWith('/') ? '' : '/'}${userProfile.businessLogo}`)
        : null;
      
      // Process image URLs for PDF export using the same logic as share route
      const processImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        
        // Handle object storage URLs
        if (url.startsWith('/api/object-storage/')) {
          return `${baseUrl}${url}`;
        }
        
        // For user-specific images
        if (url.startsWith('/user-images/')) {
          return `${baseUrl}${url}`;
        }
        
        // For legacy logos/images
        if (url.startsWith('/logos/') || url.startsWith('/business-images/') || url.startsWith('/profile-photos/')) {
          return `${baseUrl}${url}`;
        }
        
        return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      };

      // Process logo URL and selected images with proper URL conversion for PDF export
      const processedLogoUrl = processImageUrl(doc.logoUrl);
      const processedSelectedImages = (doc.selectedImages || []).map(processImageUrl).filter(Boolean);
      const processedCoverImageUrl = processImageUrl(doc.coverImageUrl);

      console.log("=== REGULAR PDF EXPORT IMAGE URL PROCESSING ===");
      console.log("Original logo URL:", doc.logoUrl);
      console.log("Processed logo URL:", processedLogoUrl);
      console.log("Original selected images:", doc.selectedImages);
      console.log("Processed selected images:", processedSelectedImages);
      console.log("Original cover image URL:", doc.coverImageUrl);
      console.log("Processed cover image URL:", processedCoverImageUrl);
      console.log("===============================================");
      
      // Pass all document data to the PDF generator
      console.log("=== BRANDED PDF TEMPLATE DEBUG (REGULAR EXPORT) ===");
      console.log("brandedPdfTemplate:", brandedPdfTemplate);
      console.log("brandColors:", brandColors);
      console.log("processedBusinessLogo:", processedBusinessLogo);
      console.log("===================================================");

      const buffer = await generatePDF(
        doc.analysis,
        processedLogoUrl,
        doc.websiteUrl || undefined,
        processedSelectedImages,
        userProfile,
        financialData,
        documentFinancialFiles,
        baseUrl,
        doc.title,
        customSections,
        processedCoverImageUrl,
        doc.coverImagePosition,
        doc.id,
        pdfTemplate,
        undefined, // shareSlug - not applicable for regular export
        brandedPdfTemplate, // Pass branded template preference
        brandColors, // Pass user's brand colors
        processedBusinessLogo // Pass processed business logo URL
      );
      console.log(`PDF document generated, size: ${buffer.length} bytes`);
      
      res.setHeader("Content-Type", "application/pdf");
      // Use the document title in the filename for better user experience
      const safeTitle = doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      res.setHeader("Content-Disposition", `attachment; filename=cim-${safeTitle}.pdf`);
      
      console.log("Sending PDF document to client");
      res.send(buffer);
      console.log("PDF document sent successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });
  
  // HTML export endpoint for clipboard export with formatting
  app.post("/api/cim/export/html/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const docId = parseInt(req.params.id);
      console.log(`Processing HTML export request for document ID: ${docId}, user ID: ${req.user?.id}`);
      
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID format" });
      }
      
      const doc = await storage.getCimDocument(docId);
      
      if (!doc) {
        console.log(`Document with ID ${docId} not found`);
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (doc.userId !== req.user!.id) {
        console.log(`Access denied: Document belongs to user ${doc.userId}, but request is from user ${req.user!.id}`);
        return res.status(403).json({ error: "You don't have permission to access this document" });
      }
      
      console.log(`Generating HTML for document: ${doc.title}, analysis present: ${Boolean(doc.analysis)}`);
      
      if (!doc.analysis) {
        return res.status(400).json({ error: "Document has no analysis data" });
      }
      
      // Get user profile for contact footer
      const profileUser = await storage.getUser(req.user!.id);
      const userProfile = {
        name: profileUser?.name,
        title: profileUser?.title,
        phoneNumber: profileUser?.phoneNumber,
        email: profileUser?.email,
        businessName: profileUser?.businessName,
        businessLogo: profileUser?.businessLogo,
        profilePhoto: profileUser?.profilePhoto
      };
      
      // Get financial data from CIM document and files
      const financialData = {
        enabled: doc.financialsEnabled || false,
        askingPrice: doc.askingPrice,
        askingPriceIncluded: doc.askingPriceIncluded || false,
        revenue: doc.revenue,
        revenueIncluded: doc.revenueIncluded || false,
        ebitda: doc.ebitda,
        ebitdaIncluded: doc.ebitdaIncluded || false
      };
      
      let financialFilesList: any[] = [];
      try {
        const files = await db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, docId));
        financialFilesList = files;
      } catch (error) {
        console.log("Error fetching financial files:", error);
      }
      
      // Include logo URL, user profile, financial data, and files
      // Use production domain for image URLs in production environment
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      let baseUrl;
      if (process.env.NODE_ENV === 'production' || host?.includes('cimshare.com')) {
        baseUrl = 'https://cimshare.com';
      } else {
        baseUrl = `${protocol}://${host}`;
      }
      
      const html = generateHtml(doc.analysis, doc.logoUrl || undefined, userProfile, doc.websiteUrl || undefined, doc.selectedImages ? doc.selectedImages : undefined, financialData, financialFilesList, baseUrl);
      
      if (!html) {
        return res.status(500).json({ error: "Failed to generate HTML content" });
      }
      
      console.log(`Successfully generated HTML content (${html.length} characters)`);
      res.json({ html });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("HTML export error:", error);
      console.error("Error details:", errorMessage);
      res.status(500).json({ 
        error: "Failed to generate HTML content", 
        details: errorMessage 
      });
    }
  });



  // Rate limiting storage for broker contact emails
  const contactRateLimit = new Map<string, number[]>();

  // Simple email test endpoint for debugging
  app.post("/api/test-email", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { to } = req.body;
      const user = req.user;
      
      console.log('=== EMAIL TEST DEBUG ===');
      console.log('Test email to:', to);
      console.log('From user:', user.email);
      
      const testEmailSent = await sendEmail({
        to: to,
        from: 'system@cimshare.com',
        subject: 'Test Message from Broker Vault',
        text: 'Hello! This is a simple test message to verify email delivery is working correctly. Please reply if you receive this.',
        html: '<p>Hello!</p><p>This is a simple test message to verify email delivery is working correctly.</p><p>Please reply if you receive this.</p>',
        replyTo: user.email
      });

      if (testEmailSent) {
        res.json({ 
          success: true, 
          message: "Test email sent successfully" 
        });
      } else {
        res.status(500).json({ 
          error: "Test email failed to send" 
        });
      }
      
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email sharing endpoint
  app.post("/api/share/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { recipientEmail, shareUrl, documentTitle, customMessage, senderName, documentId } = req.body;

      // Input validation
      if (!recipientEmail?.trim() || !shareUrl?.trim() || !documentTitle?.trim()) {
        return res.status(400).json({ 
          error: "Recipient email, share URL, and document title are required" 
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail.trim())) {
        return res.status(400).json({ 
          error: "Invalid email address format" 
        });
      }

      // Get sender information
      const [sender] = await db.select().from(users).where(eq(users.id, req.user!.id));
      if (!sender) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get CIM document for PDF generation (if documentId provided)
      let cimDocument = null;
      let customSections = [];
      if (documentId) {
        try {
          cimDocument = await storage.getCimDocument(parseInt(documentId));
          if (cimDocument && cimDocument.userId === req.user!.id) {
            // Get custom sections if they exist
            customSections = await storage.getCustomSections(parseInt(documentId)) || [];
          } else {
            cimDocument = null; // Not authorized or not found
          }
        } catch (error) {
          console.error('Error retrieving CIM document for email:', error);
          cimDocument = null;
        }
      }

      // Convert relative URLs to absolute URLs for email images
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://cimshare.com' : req.protocol + '://' + req.get('host');
      const profilePhotoUrl = sender.profilePhoto ? (sender.profilePhoto.startsWith('http') ? sender.profilePhoto : `${baseUrl}${sender.profilePhoto}`) : null;
      const businessLogoUrl = sender.businessLogo ? (sender.businessLogo.startsWith('http') ? sender.businessLogo : `${baseUrl}${sender.businessLogo}`) : null;

      const fromName = senderName || sender.name || sender.email;
      const fromEmail = 'system@cimshare.com'; // Use verified sender email

      // Prepare email content
      const subject = `Confidential Information Memorandum - ${documentTitle}`;
      
      let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Confidential Information Memorandum
          </h2>
          
          <p style="color: #555; font-size: 16px;">
            You have been invited to review a confidential business information memorandum.
          </p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Document: ${documentTitle}</h3>
            <p style="color: #64748b; margin-bottom: 0;">Shared by: ${fromName}</p>
          </div>`;

      if (customMessage?.trim()) {
        htmlContent += `
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-top: 0;">Personal Message:</h4>
            <p style="color: #78350f; white-space: pre-wrap;">${customMessage.trim()}</p>
          </div>`;
      }

      htmlContent += `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${shareUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Document
            </a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Broker's Contact Information</h3>
            
            <div style="text-align: center; margin-bottom: 20px;">
              ${profilePhotoUrl ? `<img src="${profilePhotoUrl}" alt="Profile Photo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">` : ''}
              ${businessLogoUrl ? `<img src="${businessLogoUrl}" alt="Business Logo" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` : ''}
            </div>
            
            <div style="text-align: center;">
              <h4 style="margin: 10px 0; font-size: 18px; color: #333;">${sender.name}</h4>
              ${sender.title ? `<p style="margin: 5px 0; color: #666; font-style: italic;">${sender.title}</p>` : ''}
              ${sender.businessName ? `<p style="margin: 5px 0; color: #666; font-weight: bold;">${sender.businessName}</p>` : ''}
              
              <div style="margin-top: 15px;">
                <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${sender.email}">${sender.email}</a></p>
                ${sender.phoneNumber ? `<p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${sender.phoneNumber}">${sender.phoneNumber}</a></p>` : ''}
              </div>
            </div>
          </div>
          
          <p style="color: #666; text-align: center;">
            Please feel free to reach out if you have any questions about the opportunity.
          </p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="color: #9ca3af; font-size: 14px; text-align: center;">
              This document contains confidential information. Please do not share this link with unauthorized parties.
            </p>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Professional CIM Generation Platform
            </p>
          </div>
        </div>`;

      const textContent = `
Confidential Information Memorandum

You have been invited to review a confidential business information memorandum.

Document: ${documentTitle}
Shared by: ${fromName}

${customMessage?.trim() ? `Personal Message:\n${customMessage.trim()}\n\n` : ''}

Please find the confidential document attached as a PDF file.
You can also view it online at: ${shareUrl}

Broker's Contact Information:
Name: ${sender.name}
${sender.title ? `Title: ${sender.title}` : ''}
${sender.businessName ? `Business: ${sender.businessName}` : ''}
Email: ${sender.email}
${sender.phoneNumber ? `Phone: ${sender.phoneNumber}` : ''}

Please feel free to reach out if you have any questions about the opportunity.

This document contains confidential information. Please do not share without authorization.

Professional CIM Generation Platform`;

      // Generate PDF attachment
      console.log('=== GENERATING PDF ATTACHMENT ===');
      let pdfAttachment = null;
      
      if (cimDocument) {
        try {
          // Import PDF generation function
          const { generatePDF } = await import('./document-export');
          
          // Generate PDF buffer with proper parameters
          const pdfBuffer = await generatePDF(
            cimDocument.analysis,
            cimDocument.logoUrl,
            cimDocument.websiteUrl,
            cimDocument.selectedImages || [],
            sender,
            {
              enabled: cimDocument.financialsEnabled || false,
              askingPrice: cimDocument.askingPrice,
              askingPriceIncluded: cimDocument.askingPriceIncluded || false,
              revenue: cimDocument.revenue,
              revenueIncluded: cimDocument.revenueIncluded || false,
              ebitda: cimDocument.ebitda,
              ebitdaIncluded: cimDocument.ebitdaIncluded || false
            },
            [], // financialFiles - not needed for email attachments
            baseUrl,
            cimDocument.title,
            customSections,
            cimDocument.coverImageUrl,
            cimDocument.coverImagePosition,
            cimDocument.id,
            sender.pdfBackgroundTemplate || 'classic'
          );
          const filename = `${documentTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_CIM.pdf`;
          
          pdfAttachment = {
            content: pdfBuffer.toString('base64'),
            filename: filename,
            type: 'application/pdf',
            disposition: 'attachment'
          };
          
          console.log('✅ PDF attachment generated:', filename);
          console.log('PDF size:', Math.round(pdfBuffer.length / 1024), 'KB');
        } catch (pdfError) {
          console.error('❌ Failed to generate PDF attachment:', pdfError);
          console.log('Sending email with link only...');
        }
      } else {
        console.log('No CIM document found, sending email with link only...');
      }

      // Send email with comprehensive debugging
      console.log('=== EMAIL SHARE DEBUG ===');
      console.log('Sending email to:', recipientEmail.trim());
      console.log('From:', fromEmail);
      console.log('Reply-to:', sender.email);
      console.log('Subject:', subject);
      console.log('Has PDF attachment:', !!pdfAttachment);
      console.log('SendGrid API Key available:', !!process.env.SENDGRID_API_KEY);
      console.log('SendGrid API Key length:', process.env.SENDGRID_API_KEY?.length || 0);
      console.log('Text content length:', textContent.length);
      console.log('HTML content length:', htmlContent.length);
      
      // Check for potential spam triggers
      const spamIndicators = [];
      if (recipientEmail.includes('gmail.com')) spamIndicators.push('Gmail recipient');
      if (subject.toLowerCase().includes('confidential')) spamIndicators.push('Confidential in subject');
      if (textContent.includes('http')) spamIndicators.push('Contains links');
      if (pdfAttachment) spamIndicators.push('Has PDF attachment');
      
      console.log('Potential spam indicators:', spamIndicators);
      
      const emailSent = await sendEmail({
        to: recipientEmail.trim(),
        from: fromEmail,
        subject,
        text: textContent,
        html: htmlContent,
        replyTo: sender.email,
        attachments: pdfAttachment ? [pdfAttachment] : undefined
      });

      console.log('Email sent result:', emailSent);

      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Email sent successfully" 
        });
      } else {
        console.error('❌ Email sending failed - SendGrid returned false');
        res.status(500).json({ 
          error: "Failed to send email. Please try again." 
        });
      }
    } catch (error) {
      console.error("Email sharing error:", error);
      res.status(500).json({ 
        error: "Internal server error while sending email" 
      });
    }
  });

  // Broker contact endpoint with message center integration
  app.post("/api/share/:shareSlug/contact", async (req, res) => {
    console.log('=== CONTACT FORM SUBMISSION RECEIVED ===');
    console.log('Share slug:', req.params.shareSlug);
    console.log('Request body:', req.body);
    
    try {
      const { shareSlug } = req.params;
      // Support both field name formats for compatibility
      const { viewerName, viewerEmail, viewerPhone, question, name, email, message } = req.body;
      
      // Use the provided fields with fallback support
      const finalName = viewerName || name;
      const finalEmail = viewerEmail || email;
      const finalQuestion = question || message;

      // Input validation
      if (!finalName?.trim() || !finalEmail?.trim() || !finalQuestion?.trim()) {
        return res.status(400).json({ 
          error: "Name, email, and question are required fields" 
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        return res.status(400).json({ 
          error: "Please provide a valid email address" 
        });
      }

      // Rate limiting: 2 questions per email per hour
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const userRequests = contactRateLimit.get(finalEmail) || [];
      
      // Clean old requests
      const recentRequests = userRequests.filter(timestamp => timestamp > oneHourAgo);
      
      if (recentRequests.length >= 2) {
        return res.status(429).json({ 
          error: "You can only send 2 questions per hour. Please try again later." 
        });
      }

      // Get the shared CIM document
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Shared document not found" });
      }

      // Create message thread using the message center system
      const { messageService } = await import("./message-service");
      
      const emailSubject = `Question about "${cimDoc.title}" from ${finalName}`;
      const messageContent = `
From: ${finalName}
Email: ${finalEmail}
${viewerPhone ? `Phone: ${viewerPhone}` : ''}

Question:
${finalQuestion}
      `.trim();

      const thread = await messageService.createThreadFromContactForm(
        cimDoc.userId,
        cimDoc.id,
        finalEmail,
        finalName,
        emailSubject,
        messageContent
      );

      // Update rate limiting
      recentRequests.push(now);
      contactRateLimit.set(finalEmail, recentRequests);

      // Clean up old rate limit entries periodically
      if (Math.random() < 0.1) { // 10% chance to clean up
        const emailsToClean = Array.from(contactRateLimit.keys());
        for (const email of emailsToClean) {
          const timestamps = contactRateLimit.get(email) || [];
          const validTimestamps = timestamps.filter((ts: number) => ts > oneHourAgo);
          if (validTimestamps.length === 0) {
            contactRateLimit.delete(email);
          } else {
            contactRateLimit.set(email, validTimestamps);
          }
        }
      }

      res.json({ 
        success: true, 
        message: "Your question has been sent to the broker. You will receive a confirmation email shortly.",
        threadId: thread.id
      });

    } catch (error) {
      console.error("=== CONTACT FORM ERROR ===");
      console.error("Error sending broker contact:", error);
      console.error("Error details:", error);
      console.error("Share slug:", req.params.shareSlug);
      console.error("=== END CONTACT FORM ERROR ===");
      
      res.status(500).json({ 
        error: "Failed to send message. Please try again later.",
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });
  
  // Unsplash search endpoint
  app.get("/api/unsplash/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { query, page = 1, per_page = 12 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        return res.status(500).json({ error: "Unsplash API key not configured" });
      }

      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}&orientation=landscape`, {
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);

    } catch (error) {
      console.error("Unsplash search error:", error);
      res.status(500).json({ error: "Failed to search images" });
    }
  });

  // Unsplash download tracking endpoint
  app.post("/api/unsplash/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { downloadUrl } = req.body;
      console.log("Unsplash download request received for:", downloadUrl);
      
      if (!downloadUrl || typeof downloadUrl !== 'string') {
        console.log("Invalid download URL provided");
        return res.status(400).json({ error: "Download URL is required" });
      }

      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        console.log("Unsplash API key not configured");
        return res.status(500).json({ error: "Unsplash API key not configured" });
      }

      // Trigger the download event as required by Unsplash API guidelines
      console.log("Sending download request to Unsplash API");
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        }
      });

      if (!response.ok) {
        console.log("Unsplash download request failed:", response.status, response.statusText);
        throw new Error(`Unsplash download tracking error: ${response.status}`);
      }

      console.log("Unsplash download tracking successful");
      res.json({ success: true });

    } catch (error) {
      console.error("Unsplash download tracking error:", error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });

  // PDF Template Management Endpoints
  app.get("/api/pdf-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const templates = [
        {
          id: 'none',
          name: 'No Background',
          description: 'Clean, plain pages without any background template',
          preview: null
        },
        {
          id: 'classic',
          name: 'Classic',
          description: 'Traditional professional background with elegant styling',
          preview: '/api/pdf-templates/classic/preview'
        },
        {
          id: 'professional-blue',
          name: 'Professional Blue',
          description: 'Modern minimal blue design for professional presentations',
          preview: '/api/pdf-templates/professional-blue/preview'
        },
        {
          id: 'modern-green',
          name: 'Modern Green',
          description: 'Contemporary green and blue design with modern appeal',
          preview: '/api/pdf-templates/modern-green/preview'
        }
      ];

      res.json({ templates });
    } catch (error) {
      console.error("Error fetching PDF templates:", error);
      res.status(500).json({ error: "Failed to fetch PDF templates" });
    }
  });

  app.get("/api/pdf-templates/:templateId/preview", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { templateId } = req.params;
      
      if (templateId === 'none') {
        return res.status(404).json({ error: "No preview available for 'No Background' option" });
      }

      const templatePath = path.resolve(process.cwd(), 'pdf-templates', `${templateId}.pdf`);
      
      if (!fsSync.existsSync(templatePath)) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${templateId}-preview.pdf"`);
      
      const templateBuffer = fsSync.readFileSync(templatePath);
      res.send(templateBuffer);
    } catch (error) {
      console.error("Error serving template preview:", error);
      res.status(500).json({ error: "Failed to serve template preview" });
    }
  });

  // PDF template thumbnail endpoint
  app.get("/api/pdf-templates/:templateId/thumbnail", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { templateId } = req.params;
      

      
      if (templateId === 'none') {
        return res.status(404).json({ error: "No thumbnail available for 'No Background' option" });
      }

      // Serve actual PNG thumbnail files
      const thumbnailPath = path.resolve(process.cwd(), 'public', 'template-thumbnails', `${templateId}.png`);
      console.log(`Thumbnail path: ${thumbnailPath}`);
      console.log(`File exists: ${fsSync.existsSync(thumbnailPath)}`);
      
      if (fsSync.existsSync(thumbnailPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const thumbnailBuffer = fsSync.readFileSync(thumbnailPath);
        console.log(`Serving PNG thumbnail, size: ${thumbnailBuffer.length} bytes`);
        return res.send(thumbnailBuffer);
      } else {
        console.log(`PNG not found, serving fallback SVG for ${templateId}`);
        // Fallback SVG for missing thumbnails
        const fallbackSvg = `
          <svg width="128" height="160" viewBox="0 0 128 160" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="160" fill="#f8f9fa" stroke="#e9ecef" stroke-width="2" rx="4"/>
            <text x="64" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6c757d">
              ${templateId}
            </text>
            <text x="64" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">
              Template
            </text>
          </svg>
        `;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(fallbackSvg);
      }
    } catch (error) {
      console.error("Error serving template thumbnail:", error);
      res.status(500).json({ error: "Failed to serve template thumbnail" });
    }
  });

  app.put("/api/user/pdf-template", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { templateId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!templateId || typeof templateId !== 'string') {
        return res.status(400).json({ error: "Template ID is required" });
      }

      // Validate template ID
      const validTemplates = ['none', 'classic', 'professional-blue', 'modern-green'];
      if (!validTemplates.includes(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }

      // Update user's PDF template preference
      await db.update(users)
        .set({ pdfBackgroundTemplate: templateId })
        .where(eq(users.id, userId));

      res.json({ success: true, templateId });
    } catch (error) {
      console.error("Error updating PDF template preference:", error);
      res.status(500).json({ error: "Failed to update PDF template preference" });
    }
  });

  // Add endpoint to fetch Beaver Builder templates
  app.post("/api/wordpress/fetch-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { wpUrl, username, password } = req.body;
      
      if (!wpUrl || !username || !password) {
        return res.status(400).json({ 
          error: "Missing WordPress credentials",
          requiredFields: ["wpUrl", "username", "password"] 
        });
      }

      // Basic URL validation
      if (!wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
        return res.status(400).json({
          error: "WordPress URL must start with http:// or https://"
        });
      }
      
      try {
        const templates = await fetchBeaverBuilderTemplates(wpUrl, username, password);
        res.json({ templates });
      } catch (error) {
        // Handle specific WordPress API errors
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch templates";
        
        if (errorMessage.includes('HTML instead of JSON')) {
          return res.status(400).json({
            error: "The WordPress site returned HTML instead of JSON. Please check that the REST API is enabled and the site URL is correct.",
            details: "This typically happens when a WordPress site has REST API disabled or is using a security plugin that blocks API access."
          });
        }
        
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          return res.status(404).json({
            error: "Beaver Builder templates not found on this WordPress site.",
            details: "Please ensure Beaver Builder is installed and activated on your WordPress site."
          });
        }
        
        res.status(500).json({ error: errorMessage });
      }
    } catch (error) {
      console.error("Error in template fetch route:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process template request"
      });
    }
  });

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
        const baseUrl = process.env.BASE_URL || 'https://cimshare.com';
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

  // Let React app handle shared CIMs for proper NDA protection
  // Remove this route so requests go to React app at /cims/:slug

  // Add WordPress export endpoint
  app.post("/api/cim/export/wordpress/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const doc = await storage.getCimDocument(parseInt(req.params.id));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
      }

      const { 
        wpUrl, 
        username, 
        password, 
        postId, 
        status, 
        template, 
        useCustomField,
        useToolsetFields = false, 
        postType = 'listing' 
      } = req.body;
      
      if (!wpUrl || !username || !password) {
        return res.status(400).json({ 
          error: "Missing WordPress credentials",
          requiredFields: ["wpUrl", "username", "password"] 
        });
      }
      
      // Basic URL validation
      if (!wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
        return res.status(400).json({
          error: "WordPress URL must start with http:// or https://"
        });
      }

      // Format the CIM data for WordPress - both as rich content and plain text
      const wpContent = formatWordPressContent(doc.analysis);
      const plainTextContent = formatTextContent(doc.analysis);
      
      // Set up custom fields
      const customFields: Record<string, string | number> = {
        cim_generated: "true", // Convert to string as WordPress custom fields usually expect string values
        cim_generator_id: doc.id,
        cim_date: new Date().toISOString()
      };
      
      // Always store the raw text in wpcf-text-dump custom field for backward compatibility
      customFields['wpcf-text-dump'] = plainTextContent;
      
      // If template is a Beaver Builder template (numeric ID)
      if (template && !isNaN(parseInt(template))) {
        const templateId = parseInt(template);
        // Set the Beaver Builder template ID in _fl_builder_template_id custom field
        customFields['_fl_builder_template_id'] = templateId;
        // Also set a flag to enable Beaver Builder for this post
        customFields['_fl_builder_enabled'] = '1';
      } 
      // If it's a regular WordPress page template
      else if (template && template !== 'default') {
        customFields['_wp_page_template'] = `template-${template}.php`;
      }
      
      // Create minimal content for the main post content if using custom field or Toolset fields
      const content = (useCustomField || useToolsetFields) ? 
        `<!-- wp:paragraph -->
        <p>This is a business listing created by CIM Generator. The full content is available in the custom fields.</p>
        <!-- /wp:paragraph -->` : 
        wpContent;
      
      try {
        // Export to WordPress
        // Ensure content is properly formatted based on whether we're using Toolset fields
        const formattedAnalysis = doc.analysis ? 
          (typeof doc.analysis === 'string' ? JSON.parse(doc.analysis) : doc.analysis) : 
          {};
        
        console.log("Preparing WordPress export. Analysis data:", 
          Object.keys(formattedAnalysis).join(', '));
          
        const result = await exportToWordPress({
          wpUrl,
          username,
          password,
          postId: postId ? parseInt(postId) : undefined,
          title: doc.title,
          content: useToolsetFields ? formattedAnalysis : content,
          status: status || 'draft',
          excerpt: `CIM Document for ${doc.title}`,
          customFields,
          useToolsetFields,
          postType
        });
  
        if (result.success) {
          res.json({ 
            success: true,
            postId: result.postId,
            url: result.url,
            fieldsUpdated: result.fieldsUpdated || 0
          });
        } else {
          throw new Error(result.error || "Failed to export to WordPress");
        }
      } catch (error) {
        // Handle specific WordPress API errors
        const errorMessage = error instanceof Error ? error.message : "Failed to export to WordPress";
        
        if (errorMessage.includes('HTML instead of JSON')) {
          return res.status(400).json({
            error: "The WordPress site returned HTML instead of JSON. Please check that the REST API is enabled and the site URL is correct.",
            details: "This typically happens when a WordPress site has REST API disabled or is using a security plugin that blocks API access."
          });
        }
        
        if (errorMessage.includes('listing') && errorMessage.includes('not available')) {
          return res.status(404).json({
            error: "The 'listing' post type is not available on this WordPress site.",
            details: "Please ensure your WordPress site has the 'listing' custom post type registered and available via the REST API."
          });
        }
        
        if (errorMessage.includes('not allowed to create')) {
          return res.status(403).json({
            error: "You don't have permission to create posts with this WordPress user.",
            details: "Please use an administrator account or a user with Editor role that has permissions to create 'listing' posts."
          });
        }
        
        res.status(500).json({ 
          error: errorMessage,
          details: "There was a problem connecting to WordPress or creating the listing."
        });
      }
    } catch (error) {
      console.error("WordPress export error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to export to WordPress"
      });
    }
  });

  // Profile management routes
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log("=== PROFILE API DEBUG START ===");
      console.log("User from database:", {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        subscriptionStatus: user.subscriptionStatus
      });
      
      // SECURITY: Return only profile-specific fields, excluding sensitive data
      const profileData = {
        name: user.name,
        title: user.title,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        email: user.email,
        brandColors: user.brandColors,
        pdfPrimaryColor: user.pdfPrimaryColor,
        pdfSecondaryColor: user.pdfSecondaryColor,
        brandedPdfTemplate: user.brandedPdfTemplate,
        customSubdomain: user.customSubdomain,
        timezone: user.timezone
      };
      
      console.log("Profile data being returned:", profileData);
      console.log("=== PROFILE API DEBUG END ===");
      
      res.json(profileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Add request timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`Profile update timeout for user ${req.user!.id}`);
        res.status(504).json({ error: "Profile update request timeout" });
      }
    }, 30000);

    try {
      const { name, title, phoneNumber, businessName, businessLogo, profilePhoto, customSubdomain, timezone } = req.body;

      // Validate input data
      if (typeof name !== 'string' && name !== undefined ||
          typeof title !== 'string' && title !== undefined ||
          typeof phoneNumber !== 'string' && phoneNumber !== undefined ||
          typeof businessName !== 'string' && businessName !== undefined ||
          typeof customSubdomain !== 'string' && customSubdomain !== undefined ||
          typeof timezone !== 'string' && timezone !== undefined) {
        clearTimeout(timeout);
        return res.status(400).json({ error: "Invalid input data types" });
      }

      // Validate timezone if provided (must be valid IANA timezone)
      if (timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch (e) {
          clearTimeout(timeout);
          return res.status(400).json({ error: "Invalid timezone", message: "Please select a valid timezone" });
        }
      }

      // Validate custom subdomain format if provided
      let processedSubdomain = customSubdomain;
      if (customSubdomain) {
        // Must be 3-32 chars, lowercase alphanumeric and hyphens only, no leading/trailing hyphens
        const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$|^[a-z0-9]{1,2}$/;
        if (!subdomainRegex.test(customSubdomain)) {
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid subdomain format",
            message: "Subdomain must be 1-32 characters, using only lowercase letters, numbers, and hyphens"
          });
        }

        // Check for reserved subdomains
        const reservedSubdomains = ['www', 'app', 'api', 'mail', 'admin', 'support', 'help', 'blog', 'docs', 'status'];
        if (reservedSubdomains.includes(customSubdomain)) {
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Reserved subdomain",
            message: "This subdomain is reserved and cannot be used"
          });
        }

        // Check if subdomain is already taken by another user
        const existingUser = await storage.getUserBySubdomain(customSubdomain);
        if (existingUser && existingUser.id !== req.user!.id) {
          clearTimeout(timeout);
          return res.status(409).json({
            error: "Subdomain already taken",
            message: "This subdomain is already in use by another account"
          });
        }
      }
      
      // Process images with size limits and better error handling
      let processedBusinessLogo = businessLogo;
      let processedProfilePhoto = profilePhoto;

      // Track if we need to extract brand colors from a new logo upload
      let extractedBrandColors: string[] | null = null;

      // Handle logo removal - sync to eSignature branding
      if (businessLogo === "" || businessLogo === null) {
        try {
          const [existingBranding] = await db
            .select()
            .from(userBranding)
            .where(eq(userBranding.userId, req.user!.id))
            .limit(1);

          if (existingBranding) {
            await db
              .update(userBranding)
              .set({ logoUrl: null, updatedAt: new Date() })
              .where(eq(userBranding.userId, req.user!.id));
            console.log('Synced logo removal to e-signature settings');
          }
        } catch (syncError) {
          console.warn('E-signature branding logo removal sync failed:', syncError);
        }
        processedBusinessLogo = null;
      }

      // Process business logo if it's a new upload - save as file instead of base64
      if (businessLogo && businessLogo.startsWith('data:image/')) {
        try {
          // Check size limit (increased to 10MB base64 for better handling)
          if (businessLogo.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({
              error: "Business logo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }

          const base64Data = businessLogo.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }

          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Extract brand colors from the logo
          try {
            const { extractBrandColors } = await import('./services/brand-color-extractor');
            const colors = await extractBrandColors(imageBuffer);
            extractedBrandColors = colors.colors;
            console.log('Extracted brand colors from logo:', extractedBrandColors);

            // Sync primary brand color to e-signature branding settings
            if (extractedBrandColors.length > 0) {
              const primaryColor = extractedBrandColors[0];
              try {
                // Check if user has existing e-signature branding
                const [existingBranding] = await db
                  .select()
                  .from(userBranding)
                  .where(eq(userBranding.userId, req.user!.id))
                  .limit(1);

                if (existingBranding) {
                  // Update existing branding with primary color (logo will be synced after file save)
                  await db
                    .update(userBranding)
                    .set({ primaryColor, updatedAt: new Date() })
                    .where(eq(userBranding.userId, req.user!.id));
                } else {
                  // Create new branding entry with primary color (logo will be synced after file save)
                  await db.insert(userBranding).values({
                    userId: req.user!.id,
                    primaryColor,
                    companyName: businessName || null,
                  });
                }
                console.log('Synced primary brand color to e-signature settings:', primaryColor);
              } catch (syncError) {
                console.warn('E-signature branding sync failed:', syncError);
                // Continue - this is not a critical failure
              }
            }
          } catch (colorError) {
            console.warn('Brand color extraction failed:', colorError);
            // Continue without brand colors - not a critical failure
          }

          // Save as persistent file instead of base64 data
          try {
            const logoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer,
              `logo_${req.user!.id}_${Date.now()}.png`,
              'image/png',
              req.user!.id,
              'logos'
            );
            // Add cache-busting timestamp to prevent browser caching old image
            const logoUrlWithCacheBust = `${logoMetadata.publicPath}?t=${Date.now()}`;
            processedBusinessLogo = logoUrlWithCacheBust;
            console.log('Business logo saved as file:', logoUrlWithCacheBust);

            // Also sync the logo to e-signature branding settings
            try {
              const [existingBranding] = await db
                .select()
                .from(userBranding)
                .where(eq(userBranding.userId, req.user!.id))
                .limit(1);

              if (existingBranding) {
                await db
                  .update(userBranding)
                  .set({ logoUrl: logoUrlWithCacheBust, updatedAt: new Date() })
                  .where(eq(userBranding.userId, req.user!.id));
              } else {
                await db.insert(userBranding).values({
                  userId: req.user!.id,
                  logoUrl: logoUrlWithCacheBust,
                  companyName: businessName || null,
                });
              }
              console.log('Synced logo to e-signature settings:', logoUrlWithCacheBust);
            } catch (logoSyncError) {
              console.warn('E-signature logo sync failed:', logoSyncError);
              // Continue - this is not a critical failure
            }
          } catch (processingError) {
            console.warn('Logo file save failed, falling back to base64:', processingError);
            processedBusinessLogo = businessLogo;
          }
        } catch (error) {
          console.error('Business logo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }

      // Process profile photo if it's a new upload - save as file instead of base64
      if (profilePhoto && profilePhoto.startsWith('data:image/')) {
        try {
          // Check size limit (increased to 10MB base64 for better handling)
          if (profilePhoto.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({ 
              error: "Profile photo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }
          
          const base64Data = profilePhoto.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }
          
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Save as persistent file instead of base64 data
          try {
            const photoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer, 
              `profile_${req.user!.id}_${Date.now()}.png`, 
              'image/png', 
              req.user!.id, 
              'profile-photos'
            );
            processedProfilePhoto = photoMetadata.publicPath; // Use file path instead of base64
            console.log('Profile photo saved as file:', photoMetadata.publicPath);
          } catch (processingError) {
            console.warn('Profile photo file save failed, falling back to base64:', processingError);
            processedProfilePhoto = profilePhoto;
          }
        } catch (error) {
          console.error('Profile photo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({ 
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }
      
      // Update user profile in database
      const profileUpdate: any = {
        name,
        title,
        phoneNumber,
        businessName,
        businessLogo: processedBusinessLogo,
        profilePhoto: processedProfilePhoto,
        customSubdomain: processedSubdomain || null,
        timezone: timezone || undefined
      };

      // Add brand colors if we extracted them from a new logo
      if (extractedBrandColors && extractedBrandColors.length > 0) {
        profileUpdate.brandColors = extractedBrandColors;
      }

      const updatedUser = await storage.updateUserProfile(req.user!.id, profileUpdate);
      
      // Invalidate user cache to ensure fresh data on next request
      const { invalidateUserCache } = await import("./auth");
      invalidateUserCache(req.user!.id);
      
      clearTimeout(timeout);
      
      // Return sanitized response - explicitly excluding sensitive fields
      res.json({
        name: updatedUser.name,
        title: updatedUser.title,
        phoneNumber: updatedUser.phoneNumber,
        businessName: updatedUser.businessName,
        businessLogo: updatedUser.businessLogo,
        profilePhoto: updatedUser.profilePhoto,
        customSubdomain: updatedUser.customSubdomain,
        brandColors: updatedUser.brandColors,
        brandedPdfTemplate: updatedUser.brandedPdfTemplate,
        timezone: updatedUser.timezone,
        email: updatedUser.email
        // Explicitly omitting: password, stripeCustomerId, subscriptionId, googleTokens, etc.
      });
    } catch (error) {
      clearTimeout(timeout);
      
      console.error('Profile update error:', error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('pool') || error.message.includes('connection')) {
          return res.status(503).json({ 
            error: "Database connection error",
            message: "Service temporarily unavailable"
          });
        }
        
        if (error.message.includes('timeout')) {
          return res.status(504).json({ 
            error: "Request timeout",
            message: "Profile update took too long"
          });
        }
        
        if (error.message.includes('size') || error.message.includes('large')) {
          return res.status(400).json({ 
            error: "File too large",
            message: "Please use smaller images"
          });
        }
      }
      
      res.status(500).json({ 
        error: "Failed to update profile",
        message: "Please try again later"
      });
    }
  });

  // Branded PDF template preference endpoint
  app.put("/api/user/branded-pdf-template", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { brandedPdfTemplate } = req.body;

      // Validate template option
      const validTemplates = ['none', 'watermark', 'footer', 'accent', 'full'];
      if (!validTemplates.includes(brandedPdfTemplate)) {
        return res.status(400).json({
          error: "Invalid template option",
          message: "Please select a valid template option"
        });
      }

      // Update user's branded PDF template preference
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        brandedPdfTemplate
      });

      // Invalidate user cache
      const { invalidateUserCache } = await import("./auth");
      invalidateUserCache(req.user!.id);

      res.json({
        brandedPdfTemplate: updatedUser.brandedPdfTemplate,
        message: "Branded PDF template updated successfully"
      });
    } catch (error) {
      console.error('Branded PDF template update error:', error);
      res.status(500).json({
        error: "Failed to update template preference",
        message: "Please try again later"
      });
    }
  });

  // PDF branding colors endpoint
  app.put("/api/user/pdf-branding-colors", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { pdfPrimaryColor, pdfSecondaryColor } = req.body;

      // Validate hex color format
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      const updates: any = {};

      if (pdfPrimaryColor !== undefined) {
        if (pdfPrimaryColor === null || pdfPrimaryColor === '') {
          updates.pdfPrimaryColor = null;
        } else if (hexColorRegex.test(pdfPrimaryColor)) {
          updates.pdfPrimaryColor = pdfPrimaryColor;
        } else {
          return res.status(400).json({
            error: "Invalid primary color",
            message: "Primary color must be a valid hex color (e.g., #FF5733)"
          });
        }
      }

      if (pdfSecondaryColor !== undefined) {
        if (pdfSecondaryColor === null || pdfSecondaryColor === '') {
          updates.pdfSecondaryColor = null;
        } else if (hexColorRegex.test(pdfSecondaryColor)) {
          updates.pdfSecondaryColor = pdfSecondaryColor;
        } else {
          return res.status(400).json({
            error: "Invalid secondary color",
            message: "Secondary color must be a valid hex color (e.g., #FF5733)"
          });
        }
      }

      // Update user's PDF branding colors
      const updatedUser = await storage.updateUserProfile(req.user!.id, updates);

      // Invalidate user cache
      const { invalidateUserCache } = await import("./auth");
      invalidateUserCache(req.user!.id);

      res.json({
        pdfPrimaryColor: updatedUser.pdfPrimaryColor,
        pdfSecondaryColor: updatedUser.pdfSecondaryColor,
        message: "PDF branding colors updated successfully"
      });
    } catch (error) {
      console.error('PDF branding colors update error:', error);
      res.status(500).json({
        error: "Failed to update branding colors",
        message: "Please try again later"
      });
    }
  });

  // Save default display settings for new documents
  app.put("/api/user/default-display-settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { theme, sectionStyle, contactPosition, customColor, customColorSecondary } = req.body;

      // Validate theme
      const validThemes = ['corporate-blue', 'forest-green', 'charcoal', 'burgundy', 'brand', 'custom'];
      if (theme && !validThemes.includes(theme)) {
        return res.status(400).json({ error: "Invalid theme" });
      }

      // Validate sectionStyle
      const validStyles = ['cards', 'minimal'];
      if (sectionStyle && !validStyles.includes(sectionStyle)) {
        return res.status(400).json({ error: "Invalid section style" });
      }

      // Validate contactPosition
      const validPositions = ['sidebar', 'bottom'];
      if (contactPosition && !validPositions.includes(contactPosition)) {
        return res.status(400).json({ error: "Invalid contact position" });
      }

      // Validate custom colors if provided
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (customColor && !hexColorRegex.test(customColor)) {
        return res.status(400).json({ error: "Invalid custom color format" });
      }
      if (customColorSecondary && !hexColorRegex.test(customColorSecondary)) {
        return res.status(400).json({ error: "Invalid custom secondary color format" });
      }

      const defaultDisplaySettings = {
        theme: theme || 'corporate-blue',
        sectionStyle: sectionStyle || 'cards',
        contactPosition: contactPosition || 'sidebar',
        ...(customColor && { customColor }),
        ...(customColorSecondary && { customColorSecondary })
      };

      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        defaultDisplaySettings
      });

      // Invalidate user cache
      const { invalidateUserCache } = await import("./auth");
      invalidateUserCache(req.user!.id);

      res.json({
        defaultDisplaySettings: updatedUser.defaultDisplaySettings,
        message: "Default display settings saved successfully"
      });
    } catch (error) {
      console.error('Default display settings update error:', error);
      res.status(500).json({
        error: "Failed to save default display settings",
        message: "Please try again later"
      });
    }
  });

  // Settings management routes
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return user settings for the settings page
      const settingsData = {
        fullName: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        companyName: user.businessName,
        companyLogo: user.businessLogo,
        // Default UI settings
        emailNotifications: true,
        documentCompleted: true,
        reminderEmails: false,
        twoFactorAuth: false,
        primaryColor: "#2563eb",
        secondaryColor: "#64748b",
        customEmailTemplate: true,
        brandingOnSigningPage: true,
        customFooterText: `Powered by ${user.businessName || user.name || 'Your Company'}`
      };
      
      res.json(settingsData);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`Settings update timeout for user ${req.user!.id}`);
        res.status(504).json({ error: "Settings update request timeout" });
      }
    }, 30000);

    try {
      const { 
        fullName, 
        phoneNumber, 
        businessName, 
        businessLogo, 
        profilePhoto,
        companyName,
        companyLogo
      } = req.body;
      
      // Validate input data
      if (typeof fullName !== 'string' && fullName !== undefined ||
          typeof phoneNumber !== 'string' && phoneNumber !== undefined ||
          typeof businessName !== 'string' && businessName !== undefined ||
          typeof companyName !== 'string' && companyName !== undefined) {
        clearTimeout(timeout);
        return res.status(400).json({ error: "Invalid input data types" });
      }
      
      // Process images if they are new uploads
      let processedBusinessLogo = businessLogo || companyLogo;
      let processedProfilePhoto = profilePhoto;
      
      // Process business logo if it's a new upload
      if (processedBusinessLogo && processedBusinessLogo.startsWith('data:image/')) {
        try {
          if (processedBusinessLogo.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({ 
              error: "Business logo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }
          
          const base64Data = processedBusinessLogo.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }
          
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          try {
            const logoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer, 
              `logo_${req.user!.id}_${Date.now()}.png`, 
              'image/png', 
              req.user!.id, 
              'logos'
            );
            processedBusinessLogo = logoMetadata.publicPath;
            console.log('Business logo saved as file:', logoMetadata.publicPath);
          } catch (processingError) {
            console.warn('Logo file save failed, falling back to base64:', processingError);
            processedBusinessLogo = businessLogo || companyLogo;
          }
        } catch (error) {
          console.error('Business logo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({ 
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }
      
      // Process profile photo if it's a new upload
      if (processedProfilePhoto && processedProfilePhoto.startsWith('data:image/')) {
        try {
          if (processedProfilePhoto.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({ 
              error: "Profile photo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }
          
          const base64Data = processedProfilePhoto.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }
          
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          try {
            const photoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer, 
              `profile_${req.user!.id}_${Date.now()}.png`, 
              'image/png', 
              req.user!.id, 
              'profile-photos'
            );
            processedProfilePhoto = photoMetadata.publicPath;
            console.log('Profile photo saved as file:', photoMetadata.publicPath);
          } catch (processingError) {
            console.warn('Profile photo file save failed, falling back to base64:', processingError);
            processedProfilePhoto = profilePhoto;
          }
        } catch (error) {
          console.error('Profile photo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({ 
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }
      
      // Update user profile in database using the existing updateUserProfile method
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        name: fullName,
        phoneNumber,
        businessName: businessName || companyName,
        businessLogo: processedBusinessLogo,
        profilePhoto: processedProfilePhoto
      });
      
      clearTimeout(timeout);
      
      // Return updated settings data
      const updatedSettings = {
        fullName: updatedUser.name,
        phoneNumber: updatedUser.phoneNumber,
        businessName: updatedUser.businessName,
        businessLogo: updatedUser.businessLogo,
        profilePhoto: updatedUser.profilePhoto,
        companyName: updatedUser.businessName,
        companyLogo: updatedUser.businessLogo
      };
      
      res.json({ 
        success: true, 
        message: "Settings updated successfully",
        settings: updatedSettings
      });
    } catch (error: any) {
      clearTimeout(timeout);
      console.error("Settings update error:", error);
      
      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: "Database connection failed",
          message: "Service temporarily unavailable"
        });
      }
      
      res.status(500).json({ 
        error: "Failed to update settings",
        message: "Please try again later"
      });
    }
  });

  // Password reset rate limiter - strict limits to prevent abuse and email enumeration
  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per 15 minutes per IP
    keyGenerator: (req) => req.ip || 'unknown',
    message: { error: 'Too many password reset requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Password reset routes
  app.post("/api/forgot-password", forgotPasswordLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const success = await storage.createPasswordResetToken(email, resetToken, expiry);

      if (success) {
        // Send password reset email using SendGrid
        const { sendPasswordResetEmail } = await import("./email");
        const emailSent = await sendPasswordResetEmail(email, resetToken);

        // Security: Don't log sensitive password reset tokens
        console.log(`Password reset email sent to ${email}: ${emailSent}`);
      }

      // Security: Always return success message, even if email doesn't exist
      // Use a small delay to normalize response time and prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      return res.json({ message: "If an account with that email exists, a reset link has been sent." });
    } catch (error) {
      console.error("Password reset error:", error);
      // Still normalize timing on error to prevent information leakage
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Password reset completion route
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
      }
      
      // Verify the reset token and get user
      const user = await storage.verifyPasswordResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      // Hash the new password using the consistent auth method
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);
      
      // Update the user's password
      await storage.updateUserPassword(user.id, hashedPassword);
      
      // Clear the reset token
      await storage.clearPasswordResetToken(user.id);
      
      console.log(`Password successfully reset for user: ${user.email}`);
      res.json({ message: "Password reset successfully" });
      
    } catch (error) {
      console.error("Password reset completion error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // SECURITY: Direct password reset endpoint disabled for production
  // This endpoint poses a severe security risk as it bypasses normal password reset flow
  /*
  app.post("/api/direct-password-reset", async (req, res) => {
    // This endpoint has been disabled for security reasons
    res.status(404).json({ error: "Endpoint not found" });
  });
  */

  // User account update route (email and password)
  app.post("/api/user/update", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { email, currentPassword, newPassword } = req.body;
      const userId = req.user!.id;
      
      // Verify current password is provided
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required for account changes" });
      }
      
      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      const { comparePasswords } = await import("./auth");
      const isValidPassword = await comparePasswords(currentPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      let changes = [];
      
      // Update email if provided and different
      if (email && email !== user.email) {
        // Check if email already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: "Email address is already in use by another account" });
        }
        
        await storage.updateUserEmail(userId, email);
        changes.push("email address");
      }
      
      // Update password if provided and not empty
      if (newPassword && newPassword.trim().length > 0) {
        const { hashPassword } = await import("./auth");
        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUserPassword(userId, hashedPassword);
        changes.push("password");
      }
      
      // Return appropriate message based on what was changed
      if (changes.length === 0) {
        return res.status(400).json({ error: "No changes were made. Please update your email or password." });
      }
      
      const message = changes.length === 1 
        ? `Your ${changes[0]} has been updated successfully`
        : `Your ${changes.join(' and ')} have been updated successfully`;
      
      res.json({ message });
    } catch (error) {
      console.error("Error updating user account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // Support contact form
  app.post("/api/support", upload.fields([
    { name: 'attachment_0', maxCount: 1 },
    { name: 'attachment_1', maxCount: 1 },
    { name: 'attachment_2', maxCount: 1 },
    { name: 'attachment_3', maxCount: 1 },
    { name: 'attachment_4', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { subject, message, email } = req.body;
      
      if (!subject || !message || !email) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Sanitize user inputs to prevent HTML injection
      const safeEmail = escapeHtml(email);
      const safeSubject = escapeHtml(subject);
      const safeMessage = escapeHtml(message);

      // Prepare email content with sanitized inputs
      let emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Support Request from Broker Vault</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>From:</strong> ${safeEmail}</p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
          </div>
          <div style="background-color: white; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h3>Message:</h3>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This message was sent through the Broker Vault support form.
          </p>
        </div>
      `;

      // Prepare attachments from multiple file uploads
      let attachments: any[] = [];
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files) {
        for (let i = 0; i < 5; i++) {
          const fieldName = `attachment_${i}`;
          if (files[fieldName] && files[fieldName][0]) {
            const file = files[fieldName][0];
            attachments.push({
              content: file.buffer.toString('base64'),
              filename: file.originalname,
              type: file.mimetype,
              disposition: 'attachment'
            });
          }
        }
      }

      // Send email using existing email service
      const { sendEmail } = await import("./email");
      const emailSent = await sendEmail({
        to: 'system@cimshare.com',
        from: 'system@cimshare.com', // Verified sender
        replyTo: email, // User's email as reply-to
        subject: `Support Request: ${subject}`,
        html: emailHtml,
        text: `Support Request from ${email}\n\nSubject: ${subject}\n\nMessage:\n${message}`,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      if (emailSent) {
        res.json({ message: "Support message sent successfully" });
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Support form error:", error);
      res.status(500).json({ error: "Failed to send support message" });
    }
  });

  // Get current Stripe pricing
  app.get("/api/pricing", async (req, res) => {
    try {
      const pricing = await getPricing();
      res.json(pricing);
    } catch (error: any) {
      console.error("Error fetching pricing:", error);
      res.status(500).json({ 
        error: "Failed to fetch pricing",
        details: error.message 
      });
    }
  });

  // Share link routes - duplicate endpoint removed to prevent conflicts

  // Populate default NDA templates for all users  
  app.post("/api/populate-default-nda", async (req, res) => {
    if (!req.isAuthenticated() || !req.user!.isAdmin) {
      return res.sendStatus(403);
    }

    try {
      const result = await storage.addDefaultNdaTemplateToAllUsers();
      res.json(result);
    } catch (error) {
      console.error('Error populating default NDA templates:', error);
      res.status(500).json({ error: "Failed to populate default NDA templates" });
    }
  });

  // NDA Template routes - optimized for performance
  app.get("/api/nda-templates", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Use lightweight version that excludes heavy fileContent
      const templates = await storage.getNdaTemplatesLight(req.user.id);
      
      // Check if user has a default NDA template, if not and user is standard or premium, create one
      const hasDefault = templates.some(template => template.isDefault);
      if (!hasDefault && (req.user.subscriptionStatus === 'standard' || req.user.subscriptionStatus === 'premium' || req.user.subscriptionStatus === 'pro')) {
        const { populateDefaultNDAForUser } = await import("./populate-default-nda");
        await populateDefaultNDAForUser(req.user.id);
        // Refetch templates after creating default (still lightweight)
        const updatedTemplates = await storage.getNdaTemplatesLight(req.user.id);
        return res.json(updatedTemplates);
      }
      
      res.json(templates);
    } catch (error) {
      console.error('Error fetching NDA templates:', error);
      res.status(500).json({ error: "Failed to fetch NDA templates" });
    }
  });

  // PDF to image conversion endpoint  
  app.post('/api/pdf-to-image', express.json({ limit: '50mb' }), async (req, res) => {
    console.log('PDF to image endpoint hit');
    try {
      const { pdfBase64 } = req.body;
      
      if (!pdfBase64) {
        console.log('No PDF data provided');
        return res.status(400).json({ error: 'No PDF data provided' });
      }

      console.log('Converting PDF to image, size:', pdfBase64.length);

      const tempDir = '/tmp';
      const pdfPath = path.join(tempDir, `pdf_${Date.now()}.pdf`);
      const imagePath = path.join(tempDir, `pdf_${Date.now()}.png`);

      try {
        // Validate PDF base64 data
        if (pdfBase64.length < 1000) {
          throw new Error('PDF data appears to be incomplete or corrupted');
        }

        // Write PDF to temporary file with optimized buffer handling
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        fsSync.writeFileSync(pdfPath, pdfBuffer, { flag: 'w' });

        // Validate PDF file was written correctly
        const stats = fsSync.statSync(pdfPath);
        if (stats.size < 100) {
          throw new Error('Generated PDF file is too small');
        }

        console.log(`PDF written to temp file: ${pdfPath}, size: ${stats.size} bytes`);

        // Get total page count using pdfinfo first
        let totalPages = 1;
        try {
          const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`, { timeout: 5000 });
          const pageMatch = stdout.match(/Pages:\s+(\d+)/);
          if (pageMatch) {
            totalPages = parseInt(pageMatch[1]);
          }
        } catch (infoError) {
          console.warn('Could not get page count, defaulting to 1');
        }

        console.log(`Converting all ${totalPages} pages to images`);

        // Convert all pages to PNG using poppler-utils with optimized settings
        const baseImagePath = imagePath.replace('.png', '');
        const convertCommand = `pdftoppm -png -scale-to-x 800 -scale-to-y -1 -q -cropbox "${pdfPath}" "${baseImagePath}"`;
        
        console.log('Running conversion command for all pages:', convertCommand);
        await execAsync(convertCommand, { timeout: 20000 });

        // Collect all generated page images
        const pageImages: Array<{ pageNumber: number; imageBase64: string; imageDataUrl: string }> = [];
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          // Check multiple possible output formats
          const possiblePaths = [
            `${baseImagePath}-${pageNum.toString().padStart(2, '0')}.png`,
            `${baseImagePath}-${pageNum}.png`,
            pageNum === 1 ? `${baseImagePath}.png` : null,
            pageNum === 1 ? `${baseImagePath}-1.png` : null
          ].filter(Boolean) as string[];

          let actualImagePath = '';
          for (const possiblePath of possiblePaths) {
            if (fsSync.existsSync(possiblePath)) {
              actualImagePath = possiblePath;
              break;
            }
          }

          if (actualImagePath) {
            console.log(`Processing image file: ${actualImagePath}`);
            const imageBuffer = fsSync.readFileSync(actualImagePath);

            // Get actual image dimensions using sharp
            let actualWidth = 800;
            let actualHeight = Math.round(800 * 1.414);
            try {
              const metadata = await sharp(imageBuffer).metadata();
              if (metadata.width && metadata.height) {
                actualWidth = metadata.width;
                actualHeight = metadata.height;
                console.log(`Page ${pageNum} actual dimensions: ${actualWidth}x${actualHeight}`);
              }
            } catch (metadataError) {
              console.warn(`Could not read image metadata for page ${pageNum}, using defaults`);
            }

            // Create a unique filename for serving
            const uniqueId = `${Date.now()}_${pageNum}`;
            const serveFileName = `nda_page_${uniqueId}.png`;
            const servePath = path.join('/tmp', serveFileName);

            // Copy image to serve directory with unique name and optimization
            fsSync.writeFileSync(servePath, imageBuffer, { flag: 'w' });

            pageImages.push({
              pageNumber: pageNum,
              imageUrl: `/api/temp-image/${serveFileName}`,
              width: actualWidth,
              height: actualHeight
            });

            // Clean up the original conversion output immediately
            try {
              fsSync.unlinkSync(actualImagePath);
            } catch (cleanupError) {
              console.warn(`Failed to cleanup ${actualImagePath}:`, cleanupError);
            }
            console.log(`Page ${pageNum} processed successfully, serving at ${serveFileName}`);
          }
        }

        // Clean up PDF file
        fsSync.unlinkSync(pdfPath);

        console.log(`All ${pageImages.length} pages converted successfully`);

        return res.json({
          success: true,
          totalPages,
          pages: pageImages.map(p => ({
            pageNumber: p.pageNumber,
            filename: p.imageUrl.split('/').pop(), // Extract filename from URL
            imageUrl: p.imageUrl,
            width: p.width,
            height: p.height
          }))
        });

      } catch (conversionError: any) {
        console.error('PDF conversion error:', conversionError);
        
        // Clean up any temporary files
        try {
          if (fsSync.existsSync(pdfPath)) fsSync.unlinkSync(pdfPath);
          if (fsSync.existsSync(finalImagePath)) fsSync.unlinkSync(finalImagePath);
        } catch {}

        return res.status(500).json({ 
          error: 'PDF conversion failed',
          details: conversionError.message 
        });
      }

    } catch (error: any) {
      console.error('PDF to image endpoint error:', error);
      return res.status(500).json({ error: 'Server error during PDF conversion' });
    }
  });

  // Optimized temporary image serving endpoint for PDF pages
  app.get('/api/temp-image/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Security: only allow specific pattern
      if (!/^nda_page_\d+_\d+\.png$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename pattern' });
      }
      
      const imagePath = path.join('/tmp', filename);
      
      if (!fsSync.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Check if file is modified since last request
      const stats = fsSync.statSync(imagePath);
      const lastModified = stats.mtime.toUTCString();
      const etag = `"${filename}-${stats.mtime.getTime()}"`;
      
      // Handle conditional requests
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      // Set optimized headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=7200, immutable'); // 2 hour cache
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', lastModified);
      res.setHeader('Vary', 'Accept-Encoding');
      
      // Send the image file
      const imageBuffer = fsSync.readFileSync(imagePath);
      res.send(imageBuffer);
      
      // Clean up after extended period for memory management
      setTimeout(() => {
        if (fsSync.existsSync(imagePath)) {
          fsSync.unlinkSync(imagePath);
        }
      }, 7200000); // Delete after 2 hours
      
    } catch (error) {
      console.error('Error serving temp image:', error);
      res.status(500).json({ error: 'Failed to serve image' });
    }
  });

  app.post("/api/nda-templates", upload.single('ndaFile'), async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { name, isDefault } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Accept both PDF and Word documents
      const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword' // .doc
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only PDF and Word documents (.pdf, .docx, .doc) are allowed" });
      }

      let fileContent: string;

      if (file.mimetype === 'application/pdf') {
        // Handle PDF files directly
        fileContent = file.buffer.toString('base64');
      } else {
        // Convert Word documents to PDF
        const mammoth = require('mammoth');
        const PDFDocument = require('pdfkit');
        
        try {
          // Extract HTML from Word document
          const result = await mammoth.convertToHtml({ buffer: file.buffer });
          const htmlContent = result.value;
          
          // Create PDF from HTML using PDFKit
          const doc = new PDFDocument({
            margins: {
              top: 72,
              bottom: 72,
              left: 72,
              right: 72
            }
          });
          
          const chunks: Buffer[] = [];
          doc.on('data', (chunk: Buffer) => chunks.push(chunk));
          
          // Simple HTML to PDF conversion
          // Remove HTML tags and convert to plain text for basic conversion
          const plainText = htmlContent
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
          
          // Add text to PDF with proper formatting
          const lines = plainText.split('\n');
          let yPosition = 72;
          
          for (const line of lines) {
            if (line.trim()) {
              // Check if we need a new page
              if (yPosition > doc.page.height - 72) {
                doc.addPage();
                yPosition = 72;
              }
              
              doc.fontSize(12).text(line.trim(), 72, yPosition, {
                width: doc.page.width - 144,
                align: 'left'
              });
              yPosition += 20;
            } else {
              yPosition += 10; // Add space for empty lines
            }
          }
          
          doc.end();
          
          // Wait for PDF generation to complete
          await new Promise<void>((resolve) => {
            doc.on('end', resolve);
          });
          
          const pdfBuffer = Buffer.concat(chunks);
          fileContent = pdfBuffer.toString('base64');
          
        } catch (conversionError) {
          console.error('Word to PDF conversion error:', conversionError);
          return res.status(400).json({ error: "Failed to convert Word document to PDF. Please ensure the document is valid." });
        }
      }
      
      const templateData = insertNdaTemplateSchema.parse({
        name,
        fileContent,
        isDefault: isDefault === 'true'
      });

      const template = await storage.createNdaTemplate(req.user.id, templateData);
      res.json(template);
    } catch (error) {
      console.error('NDA template creation error:', error);
      res.status(500).json({ error: "Failed to create NDA template" });
    }
  });

  // Download NDA template endpoint
  // Get individual NDA template
  app.get("/api/nda-templates/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getNdaTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Verify ownership
      if (template.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Error fetching NDA template:', error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.get("/api/nda-templates/:id/download", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getNdaTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "NDA template not found" });
      }

      // Convert base64 back to buffer
      const pdfBuffer = Buffer.from(template.fileContent, 'base64');
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${template.name}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('NDA template download error:', error);
      res.status(500).json({ error: "Failed to download NDA template" });
    }
  });

  app.put("/api/nda-templates/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const templateId = parseInt(req.params.id);
      const { name, isDefault } = req.body;

      const updatedTemplate = await storage.updateNdaTemplate(templateId, {
        name,
        isDefault
      });

      res.json(updatedTemplate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update NDA template" });
    }
  });

  app.delete("/api/nda-templates/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const templateId = parseInt(req.params.id);
      await storage.deleteNdaTemplate(templateId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete NDA template" });
    }
  });

  // NDA Signature routes
  app.get("/api/cim/:id/nda-signatures", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cimId = parseInt(req.params.id);

      // Get basic signature data
      const signatures = await storage.getNdaSignatures(cimId);

      // Import documentViews table
      const { documentViews } = await import('@shared/schema');
      const { sql, count } = await import('drizzle-orm');

      // Enhance signatures with access tokens and view count
      const enhancedSignatures = await Promise.all(signatures.map(async (signature) => {
        // Get access token for this signature
        const [accessToken] = await db
          .select()
          .from(ndaAccessTokens)
          .where(eq(ndaAccessTokens.ndaSignatureId, signature.id));

        // Count views by this signer (matching by email)
        const viewCountResult = await db
          .select({ count: count() })
          .from(documentViews)
          .where(
            sql`${documentViews.cimDocumentId} = ${cimId}
            AND ${documentViews.viewerIdentifier} = ${signature.signerEmail}`
          );

        return {
          ...signature,
          accessToken: accessToken?.token || null,
          viewCount: viewCountResult[0]?.count || 0
        };
      }));

      res.json(enhancedSignatures);
    } catch (error) {
      console.error('Error fetching NDA signatures:', error);
      res.status(500).json({ error: "Failed to fetch NDA signatures" });
    }
  });

  // Approve NDA signature
  app.post("/api/cim/:docId/nda-signatures/:signatureId/approve", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signatureId = parseInt(req.params.signatureId);

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Approve the signature
      const approvedSignature = await storage.approveNdaSignature(signatureId, req.user.id);

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send approval email to the signer
      await sendApprovalEmail(approvedSignature, doc, ownerProfile);

      res.json({ 
        success: true, 
        signature: approvedSignature,
        message: "Signer approved and notified"
      });
    } catch (error) {
      console.error('Error approving NDA signature:', error);
      res.status(500).json({ error: "Failed to approve signature" });
    }
  });

  // Batch approve NDA signatures
  app.post("/api/cim/:docId/nda-signatures/approve-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signatureIds } = req.body;

      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Batch approve signatures
      const approvedSignatures = await storage.approveNdaSignaturesBatch(signatureIds, req.user.id);

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send approval emails to all signers
      await Promise.all(
        approvedSignatures.map(signature => sendApprovalEmail(signature, doc, ownerProfile))
      );

      res.json({
        success: true,
        signatures: approvedSignatures,
        message: `${approvedSignatures.length} signers approved and notified`
      });
    } catch (error) {
      console.error('Error batch approving NDA signatures:', error);
      res.status(500).json({ error: "Failed to approve signatures" });
    }
  });

  // Reject single NDA signature
  app.post("/api/cim/:docId/nda-signatures/:signatureId/reject", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signatureId = parseInt(req.params.signatureId);

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Reject the signature
      const rejectedSignature = await storage.rejectNdaSignature(signatureId, req.user.id);

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send rejection email to the signer
      await sendRejectionEmail(
        rejectedSignature.signerEmail,
        rejectedSignature.signerName,
        doc.title,
        {
          name: req.user.name || req.user.email,
          email: req.user.email,
          businessName: ownerProfile?.businessName || undefined
        }
      );

      // Dispatch nda.declined event
      const ndaDeclinedPayload = {
        cim_id: docId,
        document_title: doc.title,
        recipient_email: rejectedSignature.signerEmail,
        recipient_name: rejectedSignature.signerName,
        decline_reason: 'Rejected by document owner',
        declined_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(req.user.id, 'nda.declined', ndaDeclinedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(req.user.id, 'nda.declined', ndaDeclinedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      res.json({
        success: true,
        signature: rejectedSignature,
        message: "Signer rejected and notified"
      });
    } catch (error) {
      console.error('Error rejecting NDA signature:', error);
      res.status(500).json({ error: "Failed to reject signature" });
    }
  });

  // Batch reject NDA signatures
  app.post("/api/cim/:docId/nda-signatures/reject-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signatureIds } = req.body;

      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Batch reject signatures
      const rejectedSignatures = await storage.rejectNdaSignaturesBatch(signatureIds, req.user.id);

      // Fetch owner profile for email
      const ownerProfile = await storage.getUserProfile(doc.userId);

      // Send rejection emails to all signers
      await Promise.all(
        rejectedSignatures.map(signature => sendRejectionEmail(
          signature.signerEmail,
          signature.signerName,
          doc.title,
          {
            name: req.user.name || req.user.email,
            email: req.user.email,
            businessName: ownerProfile?.businessName || undefined
          }
        ))
      );

      res.json({
        success: true,
        signatures: rejectedSignatures,
        message: `${rejectedSignatures.length} signers rejected and notified`
      });
    } catch (error) {
      console.error('Error batch rejecting NDA signatures:', error);
      res.status(500).json({ error: "Failed to reject signatures" });
    }
  });

  // Update NDA signature stage (for Kanban drag-and-drop)
  app.patch("/api/nda-signatures/:signatureId/stage", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const signatureId = parseInt(req.params.signatureId);
      const { stage } = req.body;

      // Get the signature to verify document ownership
      const signature = await storage.getNdaSignatureById(signatureId);
      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(signature.cimDocumentId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Update the stage
      const updatedSignature = await storage.updateNdaSignatureStage(signatureId, stage);

      res.json({ success: true, signature: updatedSignature });
    } catch (error) {
      console.error('Error updating signature stage:', error);
      res.status(500).json({ error: "Failed to update signature stage" });
    }
  });

  // Resend share link email to NDA signer
  app.post("/api/cim/:docId/nda-signatures/:signatureId/resend-email", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signatureId = parseInt(req.params.signatureId);

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get the signature with access token
      const signatures = await storage.getNdaSignatures(docId);
      const signature = signatures.find(s => s.id === signatureId);
      
      if (!signature) {
        return res.status(404).json({ error: "Signature not found" });
      }

      // Get access token for this signature
      const [accessToken] = await db
        .select()
        .from(ndaAccessTokens)
        .where(eq(ndaAccessTokens.ndaSignatureId, signatureId));

      const signatureWithToken = {
        ...signature,
        accessToken: accessToken?.token || ''
      };

      // Send the appropriate email based on approval status
      let emailSent = false;
      if (doc.ndaApprovalRequired && !signature.approved) {
        // Send "pending approval" email
        emailSent = await sendEmail({
          to: signature.signerEmail,
          from: 'system@cimshare.com',
          replyTo: 'system@cimshare.com',
          subject: `NDA Signature Received - ${doc.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>NDA Signature Received</h2>
              <p>Hello ${signature.signerName},</p>
              
              <p>Thank you for signing the NDA for <strong>${doc.title}</strong>.</p>
              
              <p>Your signature has been received and is currently pending approval. You will receive another email with document access once your signature is approved.</p>
              
              <p>Thank you for your patience.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">
                This email contains confidential information. Please handle accordingly.
              </p>
            </div>
          `,
          text: `
            NDA Signature Received
            
            Hello ${signature.signerName},
            
            Thank you for signing the NDA for ${doc.title}.
            
            Your signature has been received and is currently pending approval. You will receive another email with document access once your signature is approved.
            
            Thank you for your patience.
          `
        });
      } else {
        // Send access email (approved or no approval required)
        emailSent = await sendApprovalEmail(signatureWithToken, doc);
      }

      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Email sent successfully"
        });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error('Error resending email:', error);
      res.status(500).json({ error: "Failed to resend email" });
    }
  });

  // Bulk resend emails to NDA signers
  app.post("/api/cim/:docId/nda-signatures/resend-batch", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signatureIds } = req.body;

      if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
        return res.status(400).json({ error: "Invalid signature IDs" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get signatures with access tokens
      const signatures = await storage.getNdaSignatures(docId);
      const selectedSignatures = signatures.filter(s => signatureIds.includes(s.id));

      // Get access tokens for all signatures
      const tokensResult = await db
        .select()
        .from(ndaAccessTokens)
        .where(inArray(ndaAccessTokens.ndaSignatureId, signatureIds));

      const tokenMap = new Map(tokensResult.map(t => [t.ndaSignatureId, t.token]));

      // Send emails
      const emailPromises = selectedSignatures.map(async (signature) => {
        const signatureWithToken = {
          ...signature,
          accessToken: tokenMap.get(signature.id) || ''
        };

        if (doc.ndaApprovalRequired && !signature.approved) {
          // Send "pending approval" email
          return await sendEmail({
            to: signature.signerEmail,
            from: 'system@cimshare.com',
            replyTo: 'system@cimshare.com',
            subject: `NDA Signature Received - ${doc.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>NDA Signature Received</h2>
                <p>Hello ${signature.signerName},</p>
                
                <p>Thank you for signing the NDA for <strong>${doc.title}</strong>.</p>
                
                <p>Your signature has been received and is currently pending approval. You will receive another email with document access once your signature is approved.</p>
                
                <p>Thank you for your patience.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                  This email contains confidential information. Please handle accordingly.
                </p>
              </div>
            `,
            text: `
              NDA Signature Received
              
              Hello ${signature.signerName},
              
              Thank you for signing the NDA for ${doc.title}.
              
              Your signature has been received and is currently pending approval. You will receive another email with document access once your signature is approved.
              
              Thank you for your patience.
            `
          });
        } else {
          // Send access email
          return await sendApprovalEmail(signatureWithToken, doc);
        }
      });

      const results = await Promise.allSettled(emailPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      res.json({ 
        success: true, 
        message: `${successCount} of ${selectedSignatures.length} emails sent successfully`
      });
    } catch (error) {
      console.error('Error bulk resending emails:', error);
      res.status(500).json({ error: "Failed to resend emails" });
    }
  });

  // Add manual NDA signer - File upload is OPTIONAL
  app.post("/api/cim/:docId/nda-signatures/manual",
    // Use multer but make it completely optional
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    }).none(), // Use .none() to handle FormData without files
    async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const { signerName, signerEmail, signedDate } = req.body;
      // No file handling needed - we're using .none()
      const ndaFile = null;

      if (!signerName) {
        return res.status(400).json({ error: "Signer name is required" });
      }

      // Verify document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Generate a unique token for this manual signer
      const accessToken = generateSecureToken();

      // Convert file buffer to base64 for storage, or use a placeholder if no file
      const signedNdaContent = ndaFile
        ? `data:application/pdf;base64,${ndaFile.buffer.toString('base64')}`
        : 'data:text/plain;base64,' + Buffer.from('Manual entry - no document uploaded').toString('base64');

      // Create the NDA signature record
      const signatureData = {
        cimDocumentId: docId,
        signerName,
        signerEmail: signerEmail || `manual_${Date.now()}@offline.local`, // Use placeholder email if not provided
        signerIpAddress: 'Manual Entry',
        signerLocation: 'Offline Signature',
        signedNdaContent,
        fieldValues: {
          manualEntry: true,
          signedDate: signedDate || new Date().toISOString(),
          uploadedBy: req.user.id,
          uploadedAt: new Date().toISOString(),
          hasDocument: !!ndaFile
        }
      };

      const signature = await storage.createNdaSignature(signatureData);

      // Now approve the signature since it's being added manually by the document owner
      const approvedSignature = await storage.approveNdaSignature(signature.id, req.user.id);

      // Create access token for this signature
      await storage.createNdaAccessToken(
        accessToken,
        docId,
        signature.id,
        signatureData.signerEmail,
        undefined // Never expires for manual entries
      );

      // Add contact to CRM (investor database)
      try {
        const { investorContacts } = await import('@shared/schema');

        // Check if contact already exists
        const existingContact = await db.select()
          .from(investorContacts)
          .where(and(
            eq(investorContacts.userId, req.user.id),
            eq(investorContacts.email, signatureData.signerEmail)
          ))
          .limit(1);

        if (existingContact.length === 0) {
          // Create new contact in CRM
          await db.insert(investorContacts).values({
            userId: req.user.id,
            email: signatureData.signerEmail,
            name: signerName,
            notes: 'Added via manual NDA signature entry',
            tags: [],
            status: 'new',
            location: 'Offline Signature',
            totalDocumentViews: 0,
            totalTimeSpentMinutes: 0,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            ipAddress: 'Manual Entry',
            isPotentialVpn: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (crmError) {
        console.error('Error adding contact to CRM:', crmError);
        // Don't fail the whole request if CRM addition fails
      }

      // Return the approved signature with access token
      res.json({
        success: true,
        signature: {
          ...approvedSignature,
          accessToken
        }
      });

    } catch (error) {
      console.error('Error adding manual NDA signer:', error);
      res.status(500).json({ error: "Failed to add manual signer" });
    }
  });

  app.post("/api/share/:shareSlug/sign-nda", async (req, res) => {
    console.log("=== NDA SIGNING REQUEST STARTED ===");
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Request params:", req.params);
    console.log("=====================================");

    try {
      const { shareSlug } = req.params;
      const { signerName, signerEmail, fieldValues = {} } = req.body;
      
      console.log("=== EMAIL DEBUG - INITIAL VALUES ===");
      console.log("signerName from request body:", signerName);
      console.log("signerEmail from request body:", signerEmail);
      console.log("fieldValues from request body:", fieldValues);
      console.log("shareSlug from params:", shareSlug);
      console.log("====================================");
      // Get real client IP address, not proxy IP
      const signerIpAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                             req.headers['x-real-ip']?.toString() ||
                             req.headers['cf-connecting-ip']?.toString() ||
                             req.ip || 
                             req.connection.remoteAddress || 
                             'unknown';

      // Get location information from IP address
      let signerLocation = 'Unknown Location';
      let geo = null;

      try {
        const { lookupIp } = await import('./services/geo-ip-service');
        geo = await lookupIp(signerIpAddress);
        if (geo && geo.city && geo.region && geo.country) {
          signerLocation = `${geo.city}, ${geo.region}, ${geo.country}`;
        } else if (geo && geo.country) {
          signerLocation = `${geo.country}`;
        }
        console.log('Geolocation lookup successful:', geo);
      } catch (geoError: any) {
        console.log('Geolocation lookup failed:', geoError?.message || 'Unknown error');
      }

      console.log("Share slug:", shareSlug);
      console.log("Signer name:", signerName);
      console.log("Signer email:", signerEmail);
      console.log("Field values:", fieldValues);
      console.log("Email validation:", {
        hasName: !!signerName && signerName.trim().length > 0,
        hasEmail: !!signerEmail && signerEmail.trim().length > 0,
        emailFormat: signerEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail) : false
      });
      console.log("Headers:", {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'req.ip': req.ip,
        'remoteAddress': req.connection.remoteAddress
      });
      console.log("Final IP address:", signerIpAddress);
      console.log("Geo location:", geo);
      console.log("Formatted location:", signerLocation);

      // Get CIM document by share slug
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      console.log("Found CIM doc:", !!cimDoc, cimDoc?.id);
      
      if (!cimDoc) {
        console.log("ERROR: CIM document not found");
        return res.status(404).json({ error: "CIM document not found" });
      }

      // Check if NDA is required
      
      if (!cimDoc.ndaProtected || !cimDoc.ndaTemplateId) {
        return res.status(400).json({ error: "This CIM does not require NDA signing" });
      }

      // Always process NDA signing and send all emails (no distinction between new/existing signers)

      // Get NDA template
      const templates = await storage.getNdaTemplates(cimDoc.userId);
      console.log("Found templates:", templates.length);
      
      const ndaTemplate = templates.find(t => t.id === cimDoc.ndaTemplateId);
      
      if (!ndaTemplate) {
        return res.status(400).json({ error: "NDA template not found" });
      }

      // Create signed NDA
      const signedAt = new Date();
      
      try {
        // Enhanced signature processing with field values
        let signedNdaContent: string;
        
        // Ensure signatureFields is an array (JSONB field might return object)
        const signatureFields = Array.isArray(ndaTemplate.signatureFields) 
          ? ndaTemplate.signatureFields 
          : [];
        
        if (signatureFields && signatureFields.length > 0) {
          console.log("=== PDF GENERATION START ===");
          console.log("Processing signature using enhanced field-based system");
          console.log("Template file content length:", ndaTemplate.fileContent?.length || 0);

          const processor = await PdfSignatureProcessor.fromBase64(ndaTemplate.fileContent);

          // Prepare field values with signature data
          const processedFieldValues = { ...fieldValues };

          // Auto-populate standard fields if not provided
          if (!processedFieldValues.name && signatureFields.some((f: any) => f.type === 'name')) {
            const nameField = signatureFields.find((f: any) => f.type === 'name');
            if (nameField) processedFieldValues[nameField.id] = signerName;
          }

          if (!processedFieldValues.email && signatureFields.some((f: any) => f.type === 'email')) {
            const emailField = signatureFields.find((f: any) => f.type === 'email');
            if (emailField) processedFieldValues[emailField.id] = signerEmail;
          }

          // Process date fields
          signatureFields.filter((f: any) => f.type === 'date').forEach((field: any) => {
            if (!processedFieldValues[field.id]) {
              processedFieldValues[field.id] = signedAt.toLocaleDateString();
            }
          });

          // Embed fields into PDF
          console.log("Embedding fields into PDF...");
          signedNdaContent = await processor.embedFields(signatureFields, processedFieldValues);
          console.log("Fields embedded, PDF length:", signedNdaContent?.length || 0);

          // Add completion certificate
          try {
            console.log("Adding completion certificate...");
            await processor.addCompletionCertificate(signerName, signerEmail, signedAt, signerIpAddress);
            signedNdaContent = await processor.saveAsBase64();
            console.log("✅ Certificate added successfully, final PDF length:", signedNdaContent?.length || 0);
          } catch (certError) {
            console.error('❌ Error adding completion certificate:', certError);
            console.error('Certificate error details:', {
              message: certError instanceof Error ? certError.message : String(certError),
              stack: certError instanceof Error ? certError.stack : undefined
            });
            // Continue without certificate if it fails
            console.log('⚠️ Continuing without completion certificate, using PDF without certificate');
            console.log('PDF length without certificate:', signedNdaContent?.length || 0);
          }

          console.log("=== PDF GENERATION COMPLETE ===");
        } else {
          console.log("=== PDF GENERATION START (CERTIFICATE ONLY) ===");
          console.log("Using certificate-only processing (no signature fields)");
          console.log("Template file content length:", ndaTemplate.fileContent?.length || 0);

          signedNdaContent = await addCertificateToNda(
            ndaTemplate.fileContent,
            signerName,
            signedAt,
            signerEmail,
            signerIpAddress
          );

          console.log("✅ Certificate added, final PDF length:", signedNdaContent?.length || 0);
          console.log("=== PDF GENERATION COMPLETE ===");
        }

        // Validate PDF before proceeding
        console.log("=== VALIDATING GENERATED PDF ===");
        if (!signedNdaContent || signedNdaContent.length === 0) {
          console.error("❌ CRITICAL ERROR: Generated PDF is empty!");
          throw new Error("PDF generation failed - resulting content is empty");
        }

        try {
          const pdfBuffer = Buffer.from(signedNdaContent, 'base64');
          const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
          console.log("PDF header check:", pdfHeader);

          if (!pdfHeader.startsWith('%PDF')) {
            console.error("❌ CRITICAL ERROR: Generated PDF has invalid header!");
            console.error("First 100 chars:", signedNdaContent.substring(0, 100));
            throw new Error("PDF generation failed - invalid PDF format");
          }

          console.log("✅ PDF validation passed - header is correct");
        } catch (validationError) {
          console.error("❌ PDF validation failed:", validationError);
          throw new Error("PDF validation failed: " + (validationError instanceof Error ? validationError.message : String(validationError)));
        }

        // Save signature record
        console.log("📝 Preparing signature data...");
        
        const signatureData = {
          cimDocumentId: cimDoc.id,
          signerName,
          signerEmail,
          signerIpAddress,
          signerLocation,
          signedNdaContent,
          fieldValues
        };
        
        const validatedData = insertNdaSignatureSchema.parse(signatureData);
        const signature = await storage.createNdaSignature(validatedData);

        // Get owner information for email
        console.log("Getting document owner information...");
        const owner = await storage.getUser(cimDoc.userId);
        if (!owner) {
          console.log("ERROR: Document owner not found");
          return res.status(500).json({ error: "Document owner not found" });
        }
        console.log("Owner found:", owner.email);



        // Auto-sync to investor database after successful NDA signing
        console.log("Auto-syncing new contact to investor database...");
        try {
          const { investorContacts } = await import('@shared/schema');
          const { and } = await import('drizzle-orm');
          
          // Check if contact already exists
          const [existingContact] = await db
            .select()
            .from(investorContacts)
            .where(and(
              eq(investorContacts.userId, cimDoc.userId),
              eq(investorContacts.email, signerEmail)
            ));
          
          if (existingContact) {
            // Update existing contact with latest activity and location info
            await db
              .update(investorContacts)
              .set({
                totalDocumentViews: existingContact.totalDocumentViews + 1,
                lastSeenAt: new Date(),
                ipAddress: signerIpAddress,
                location: signerLocation,
                updatedAt: new Date()
              })
              .where(eq(investorContacts.id, existingContact.id));
            console.log("Updated existing investor contact with location:", signerEmail, signerLocation);
          } else {
            // Create new contact with location info
            await db
              .insert(investorContacts)
              .values({
                userId: cimDoc.userId,
                email: signerEmail,
                name: signerName,
                status: 'new',
                totalDocumentViews: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                ipAddress: signerIpAddress,
                location: signerLocation,
                tags: []
              });
            console.log("Created new investor contact with location:", signerEmail, signerLocation);
          }
        } catch (syncError) {
          console.error('Auto-sync to investor database failed:', syncError);
          // Don't fail the NDA signing if sync fails
        }

        // Create access token for the signed user
        const accessToken = generateSecureToken();
        const ndaAccessToken = await storage.createNdaAccessToken(
          accessToken,
          cimDoc.id,
          signature.id,
          signerEmail
        );

        // Create redirect link
        console.log("Creating redirect link...");
        const redirectId = generateRedirectId();
        const redirectLink = await storage.createNdaRedirectLink(
          redirectId,
          ndaAccessToken.id,
          cimDoc.id,
          signerEmail
        );

        // Check if manual approval is required
        if (cimDoc.ndaApprovalRequired) {
          console.log("Manual approval required - not sending immediate access email");
          
          // Send notification to owner about new signature requiring approval
          const ownerNotificationSent = await sendOwnerApprovalNotification(
            owner.email,
            owner.name || owner.email,
            cimDoc.title,
            signerName,
            signerEmail,
            signerLocation
          );
          
          if (!ownerNotificationSent) {
            console.error('Failed to send owner approval notification');
          }

          res.json({ 
            success: true, 
            signature,
            requiresApproval: true,
            message: "Thank you for signing the NDA. Your signature has been received and someone will follow up as soon as possible to share the document once it is approved."
          });
        } else {
          // Get owner's complete profile information for CIM link email
          console.log("Fetching owner profile information...");
          const ownerProfile = await storage.getUserProfile(cimDoc.userId);
          
          // Prepare owner profile data for email with full URLs for images
          const processImageUrlForEmail = (url: string | null) => {
            if (!url) return undefined;
            if (url.startsWith('data:') || url.startsWith('http')) return url;
            
            // Handle object storage URLs - convert to full domain URLs for emails
            if (url.startsWith('/api/object-storage/')) {
              return `https://cimshare.com${url}`;
            }
            
            return url;
          };
          
          const ownerProfileData = {
            name: owner.name || owner.email,
            email: owner.email,
            phone: ownerProfile?.phoneNumber || undefined,
            title: ownerProfile?.title || undefined,
            businessName: ownerProfile?.businessName || undefined,
            profilePhotoUrl: processImageUrlForEmail(ownerProfile?.profilePhoto),
            businessLogoUrl: processImageUrlForEmail(ownerProfile?.businessLogo)
          };

          // Send immediate access email with separate NDA confirmation and CIM link emails
          const redirectUrl = `${req.protocol}://${req.get('host')}/nda/redirect/${redirectId}`;
          
          // Enhanced email validation and logging
          console.log("=== EMAIL SENDING VALIDATION ===");
          console.log("Signer email (final):", signerEmail);
          console.log("Signer name (final):", signerName);
          console.log("Owner email:", owner.email);
          console.log("CIM title:", cimDoc.title);
          console.log("Redirect URL:", redirectUrl);
          console.log("Owner profile data:", ownerProfileData);
          
          // Validate required data before sending
          if (!signerEmail || !signerEmail.trim()) {
            console.error("ERROR: Signer email is empty or undefined");
            throw new Error("Signer email is required for email sending");
          }
          
          if (!signerName || !signerName.trim()) {
            console.error("ERROR: Signer name is empty or undefined");
            throw new Error("Signer name is required for email sending");
          }
          
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
            console.error("ERROR: Invalid email format:", signerEmail);
            throw new Error("Invalid email format");
          }
          
          console.log("✅ Email validation passed, proceeding with email sending...");
          
          const finalEmailSent = await sendNdaSignedEmail(
            signerEmail.trim(),
            owner.email,
            owner.name || owner.email,
            cimDoc.title,
            redirectUrl,
            signedNdaContent,
            signerName.trim(),
            ownerProfileData,
            cimDoc.userId
          );

          if (!finalEmailSent) {
            console.error('Failed to send NDA confirmation emails - check email debug logs above');
          } else {
          }

          // Dispatch webhook event for NDA signed (async, don't await)
          const ndaEventPayload = {
            nda_id: signature.id,
            cim_id: cimDoc.id,
            cim_title: cimDoc.title,
            signer_email: signerEmail,
            signer_name: signerName,
            signer_location: signerLocation,
            signed_at: signature.signedAt,
            // Add additional fields for integrations
            signer: {
              email: signerEmail,
              name: signerName,
            },
            document: {
              id: cimDoc.id,
              title: cimDoc.title,
            },
          };

          dispatchWebhookEvent(cimDoc.userId, 'nda.signed', ndaEventPayload)
            .catch(err => console.error('Webhook dispatch error:', err));

          // Dispatch to integration automations (HubSpot, etc.)
          dispatchIntegrationEvent(cimDoc.userId, 'nda.signed', ndaEventPayload)
            .catch(err => console.error('Integration dispatch error:', err));

          res.json({
            success: true,
            signature,
            requiresApproval: false,
            message: "NDA signed successfully. Check your email for confirmation and CIM access."
          });
        }

      } catch (innerError) {
        console.error('Inner NDA signing error:', innerError);
        console.error('Inner error message:', innerError instanceof Error ? innerError.message : String(innerError));
        console.error('Inner error stack:', innerError instanceof Error ? innerError.stack : 'No stack trace');
        throw innerError;
      }

    } catch (error) {
      console.error('NDA signing error:', error);

      // Return more detailed error in development
      const errorMessage = error instanceof Error ? error.message : "Failed to process NDA signature";
      const errorStack = error instanceof Error ? error.stack : undefined;

      res.status(500).json({
        error: "Failed to process NDA signature",
        details: errorMessage, // Always return details for debugging
        stack: errorStack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
      });
    }
  });

  // NDA Redirect handler - stable URL that redirects to current token
  app.get("/api/nda/redirect/:redirectId", async (req, res) => {
    try {
      const { redirectId } = req.params;
      
      console.log("Redirect ID:", redirectId);
      
      // Get redirect link
      const redirectLink = await storage.getNdaRedirectLink(redirectId);
      if (!redirectLink || !redirectLink.isActive) {
        console.log("ERROR: Redirect link not found or inactive");
        return res.status(404).json({ error: "Invalid or expired redirect link" });
      }
      
      console.log("Found redirect link:", redirectLink.id);
      
      // Get current access token by ID using storage method
      console.log("Looking up access token by ID:", redirectLink.currentTokenId);
      const accessTokens = await db.select().from(ndaAccessTokens).where(eq(ndaAccessTokens.id, redirectLink.currentTokenId));
      
      if (!accessTokens || accessTokens.length === 0) {
        console.log("ERROR: Access token record not found");
        return res.status(404).json({ error: "Invalid or expired access token" });
      }
      
      const accessToken = accessTokens[0];
      
      if (!accessToken.isActive) {
        console.log("ERROR: Access token is inactive");
        return res.status(404).json({ error: "Invalid or expired access token" });
      }
      
      console.log("Found access token record:", accessToken.id, "Token:", accessToken.token.substring(0, 10) + "...");
      
      console.log("Found access token:", accessToken.id);
      
      // Update token last accessed and track NDA signer view
      await storage.updateTokenLastAccessed(accessToken.token);
      
      // Note: Views are tracked only when users access the actual CIM content, not the NDA page
      
      // Get CIM document
      const cimDoc = await storage.getCimDocument(accessToken.cimDocumentId);
      if (!cimDoc) {
        console.log("ERROR: CIM document not found");
        return res.status(404).json({ error: "Document not found" });
      }
      
      console.log("Redirecting to document with token:", accessToken.token);
      
      // Redirect to document with token
      const documentUrl = `/cims/${cimDoc.shareSlug}?token=${accessToken.token}`;
      res.redirect(documentUrl);
      
    } catch (error) {
      console.error('NDA redirect error:', error);
      res.status(500).json({ error: "Failed to process redirect" });
    }
  });

  // Validate NDA access token
  app.get("/api/nda/validate-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const accessToken = await storage.getNdaAccessToken(token);
      console.log("Token lookup result:", !!accessToken, accessToken?.isActive);
      
      if (!accessToken) {
        console.log("Token not found in database");
        return res.status(401).json({ error: "Invalid token", valid: false });
      }
      
      if (!accessToken.isActive) {
        console.log("Token is inactive");
        return res.status(401).json({ error: "Token has been deactivated", valid: false });
      }
      
      // Check if token has expired (only if expiresAt is set)
      if (accessToken.expiresAt && new Date() > accessToken.expiresAt) {
        console.log("Token has expired:", accessToken.expiresAt);
        return res.status(401).json({ error: "Token has expired", valid: false });
      }
      
      // Update last accessed
      await storage.updateTokenLastAccessed(token);
      
      // Get CIM document
      const cimDoc = await storage.getCimDocument(accessToken.cimDocumentId);
      if (!cimDoc) {
        console.log("CIM document not found for token");
        return res.status(404).json({ error: "Document not found", valid: false });
      }
      
      console.log("Token validation successful");
      res.json({
        valid: true,
        cimDocument: {
          id: cimDoc.id,
          title: cimDoc.title,
          shareSlug: cimDoc.shareSlug
        },
        signerEmail: accessToken.signerEmail
      });
      
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: "Failed to validate token", valid: false });
    }
  });

  // Check NDA signature status
  app.get("/api/cim/:shareSlug/nda-status", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      if (!cimDoc) {
        return res.status(404).json({ error: "CIM document not found" });
      }

      const signature = await storage.checkNdaSignature(cimDoc.id, email as string);
      
      res.json({ 
        ndaRequired: cimDoc.ndaProtected,
        hasSignature: !!signature,
        signature: signature || null
      });

    } catch (error) {
      res.status(500).json({ error: "Failed to check NDA status" });
    }
  });



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

  // Investor Database API Routes (Premium Feature)
  
  // Get all investor contacts for the user
  app.get("/api/investor-contacts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const { 
        search, 
        status, 
        cimDocumentId,
        sortBy = 'lastSeenAt', 
        sortOrder = 'desc',
        page = '1',
        limit = '20'
      } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      
      // Import tables
      const { investorContacts, ndaSignatures: ndaSigs, cimDocuments: cimDocs } = await import('@shared/schema');
      const { and, like, or, desc, asc, count, inArray } = await import('drizzle-orm');
      
      // Build conditions
      const conditions = [eq(investorContacts.userId, req.user.id)];
      
      if (search) {
        conditions.push(
          or(
            like(investorContacts.name, `%${search}%`),
            like(investorContacts.email, `%${search}%`)
          )
        );
      }
      
      if (status && status !== 'all') {
        conditions.push(eq(investorContacts.status, status as string));
      }

      // Filter by CIM document if specified
      let cimFilteredContactEmails: string[] = [];
      if (cimDocumentId && cimDocumentId !== 'all') {
        const cimId = parseInt(cimDocumentId as string);
        
        // Get all signatures for this specific CIM document
        const cimSignatures = await db
          .select({ signerEmail: ndaSigs.signerEmail })
          .from(ndaSigs)
          .where(eq(ndaSigs.cimDocumentId, cimId));
        
        cimFilteredContactEmails = cimSignatures.map(sig => sig.signerEmail);
        
        // If no signatures found for this CIM, return empty results
        if (cimFilteredContactEmails.length === 0) {
          return res.json({
            contacts: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false
            }
          });
        }
        
        // Add condition to filter contacts by emails that signed this CIM
        conditions.push(inArray(investorContacts.email, cimFilteredContactEmails));
      }
      
      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: count() })
        .from(investorContacts)
        .where(and(...conditions));
      
      const totalCount = totalCountResult[0]?.count || 0;
      
      // Build query with conditions, sorting, and pagination
      let query = db
        .select()
        .from(investorContacts)
        .where(and(...conditions))
        .limit(limitNum)
        .offset(offset);
      
      // Apply sorting
      if (sortBy === 'name') {
        query = sortOrder === 'desc' ? query.orderBy(desc(investorContacts.name)) : query.orderBy(asc(investorContacts.name));
      } else if (sortBy === 'email') {
        query = sortOrder === 'desc' ? query.orderBy(desc(investorContacts.email)) : query.orderBy(asc(investorContacts.email));
      } else {
        query = sortOrder === 'desc' ? query.orderBy(desc(investorContacts.lastSeenAt)) : query.orderBy(asc(investorContacts.lastSeenAt));
      }
      
      const contacts = await query;
      
      // Auto-sync from NDA signatures if no contacts exist
      if (contacts.length === 0) {
        const { ndaSignatures, cimDocuments } = await import('@shared/schema');
        const { inArray } = await import('drizzle-orm');
        
        // Get all user's CIM documents
        const userCims = await db.select().from(cimDocuments).where(eq(cimDocuments.userId, req.user.id));
        const cimIds = userCims.map(cim => cim.id);
        
        if (cimIds.length > 0) {
          // Get all NDA signatures for user's documents
          const signatures = await db
            .select()
            .from(ndaSignatures)
            .where(inArray(ndaSignatures.cimDocumentId, cimIds));
          
          // Group signatures by email and create contacts
          const signaturesByEmail = signatures.reduce((acc, sig) => {
            if (!acc[sig.signerEmail]) {
              acc[sig.signerEmail] = [];
            }
            acc[sig.signerEmail].push(sig);
            return acc;
          }, {} as Record<string, any[]>);
          
          // Create contacts from signatures
          for (const [email, sigs] of Object.entries(signaturesByEmail)) {
            const latestSig = sigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())[0];
            
            await db
              .insert(investorContacts)
              .values({
                userId: req.user.id,
                email: email,
                name: latestSig.signerName,
                status: 'new',
                totalDocumentViews: sigs.length,
                firstSeenAt: new Date(sigs[0].signedAt),
                lastSeenAt: new Date(latestSig.signedAt),
                tags: []
              });
          }
          
          // Re-fetch contacts after auto-sync
          const updatedContacts = await db.select().from(investorContacts).where(and(...conditions));
          const allSignatures = await db.select().from(ndaSignatures);
          
          const enrichedContacts = updatedContacts.map(contact => {
            const contactSignatures = allSignatures.filter(sig => sig.signerEmail === contact.email);
            const contactDocuments = contactSignatures.map(sig => {
              const doc = userCims.find(d => d.id === sig.cimDocumentId);
              return {
                documentId: sig.cimDocumentId,
                documentTitle: doc?.title || 'Unknown Document',
                signedAt: sig.signedAt,
                signerName: sig.signerName,
                cimDocumentId: sig.cimDocumentId,
                signatureId: sig.id
              };
            });
            
            return {
              ...contact,
              totalNdaSignatures: contactSignatures.length,
              documents: contactDocuments,
              lastNdaSigned: contactSignatures.length > 0 ? Math.max(...contactSignatures.map(sig => new Date(sig.signedAt).getTime())) : null
            };
          });
          
          return res.json(enrichedContacts);
        }
      }
      
      // Efficiently get NDA signature data using joins for better performance
      const { ndaSignatures, cimDocuments } = await import('@shared/schema');
      const { sql, inArray: inArrayImport } = await import('drizzle-orm');
      
      // Get user's document IDs for filtering
      const userCims = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(eq(cimDocuments.userId, req.user.id));
      const userCimIds = userCims.map(cim => cim.id);
      
      // Use efficient aggregation query to get signature counts and latest dates
      const signatureStats = userCimIds.length > 0 ? await db
        .select({
          signerEmail: ndaSignatures.signerEmail,
          totalSignatures: sql<number>`COUNT(*)::int`,
          lastSignedAt: sql<Date>`MAX(${ndaSignatures.signedAt})`
        })
        .from(ndaSignatures)
        .where(
          and(
            inArrayImport(ndaSignatures.cimDocumentId, userCimIds),
            sql`${ndaSignatures.signerEmail} IN (${sql.join(
              contacts.map(c => sql`${c.email}`),
              sql`, `
            )})`
          )
        )
        .groupBy(ndaSignatures.signerEmail) : [];
      
      // Get detailed document info only for contacts that need it
      const contactDocuments = userCimIds.length > 0 ? await db
        .select({
          signerEmail: ndaSignatures.signerEmail,
          documentId: ndaSignatures.cimDocumentId,
          documentTitle: cimDocuments.title,
          signedAt: ndaSignatures.signedAt,
          signerName: ndaSignatures.signerName,
          cimDocumentId: ndaSignatures.cimDocumentId,
          signatureId: ndaSignatures.id
        })
        .from(ndaSignatures)
        .innerJoin(cimDocuments, eq(ndaSignatures.cimDocumentId, cimDocuments.id))
        .where(
          and(
            inArrayImport(ndaSignatures.cimDocumentId, userCimIds),
            sql`${ndaSignatures.signerEmail} IN (${sql.join(
              contacts.map(c => sql`${c.email}`),
              sql`, `
            )})`
          )
        ) : [];
      
      // Create lookup maps for O(1) access
      const statsMap = new Map(signatureStats.map(stat => [stat.signerEmail, stat]));
      const docsMap = new Map<string, typeof contactDocuments>();
      contactDocuments.forEach(doc => {
        if (!docsMap.has(doc.signerEmail)) {
          docsMap.set(doc.signerEmail, []);
        }
        docsMap.get(doc.signerEmail)!.push(doc);
      });
      
      // Efficiently enrich contacts using lookup maps
      const enrichedContacts = contacts.map(contact => {
        const stats = statsMap.get(contact.email);
        const docs = docsMap.get(contact.email) || [];
        
        return {
          ...contact,
          totalNdaSignatures: stats?.totalSignatures || 0,
          documents: docs.map(doc => ({
            documentId: doc.documentId,
            cimDocumentId: doc.documentId, // Add this for consistency
            documentTitle: doc.documentTitle,
            signedAt: doc.signedAt,
            signerName: doc.signerName,
            signatureId: doc.signatureId // Add the missing signatureId
          })),
          lastNdaSigned: stats?.lastSignedAt ? new Date(stats.lastSignedAt).getTime() : null
        };
      });
      
      // Return paginated response with metadata
      res.json({
        contacts: enrichedContacts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      console.error('Error fetching investor contacts:', error);
      res.status(500).json({ error: "Failed to fetch investor contacts" });
    }
  });

  // Create investor contact manually
  app.post("/api/investor-contacts", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { investorContacts, insertInvestorContactSchema } = await import('@shared/schema');

      // Validate input
      const validatedData = insertInvestorContactSchema.parse(req.body);

      // Check if contact with this email already exists for this user
      const existingContact = await db.select()
        .from(investorContacts)
        .where(and(
          eq(investorContacts.userId, req.user.id),
          eq(investorContacts.email, validatedData.email)
        ))
        .limit(1);

      if (existingContact.length > 0) {
        return res.status(400).json({ error: "A contact with this email already exists" });
      }

      // Create new contact
      const [newContact] = await db
        .insert(investorContacts)
        .values({
          userId: req.user.id,
          email: validatedData.email,
          name: validatedData.name,
          notes: validatedData.notes || '',
          tags: validatedData.tags || [],
          status: validatedData.status || 'new',
          location: req.body.location || null,
          nextFollowUpDate: validatedData.nextFollowUpDate ? new Date(validatedData.nextFollowUpDate) : null,
          lastContactDate: validatedData.lastContactDate ? new Date(validatedData.lastContactDate) : null,
          totalDocumentViews: 0,
          totalTimeSpentMinutes: 0,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          ipAddress: null,
          isPotentialVpn: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Dispatch webhook event for contact created (async, don't await)
      const contactCreatedPayload = {
        contact_id: newContact.id,
        email: newContact.email,
        name: newContact.name,
        status: newContact.status,
        created_at: newContact.createdAt,
        contact: {
          email: newContact.email,
          name: newContact.name,
          company: newContact.company,
          phone: newContact.phone,
        },
      };
      dispatchWebhookEvent(req.user!.id, 'contact.created', contactCreatedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));
      dispatchIntegrationEvent(req.user!.id, 'contact.created', contactCreatedPayload)
        .catch(err => console.error('Integration dispatch error:', err));

      res.json(newContact);
    } catch (error: any) {
      console.error('Error creating investor contact:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid contact data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  // Update investor contact
  app.put("/api/investor-contacts/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const contactId = parseInt(req.params.id);
      const { investorContacts } = await import('@shared/schema');
      const { and } = await import('drizzle-orm');

      // Process request body to handle date fields properly
      const updateData = {
        ...req.body,
        nextFollowUpDate: req.body.nextFollowUpDate ? new Date(req.body.nextFollowUpDate) : null,
        updatedAt: new Date()
      };

      const [updated] = await db
        .update(investorContacts)
        .set(updateData)
        .where(and(
          eq(investorContacts.id, contactId),
          eq(investorContacts.userId, req.user.id)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Dispatch contact.updated event
      const contactUpdatedPayload = {
        contact_id: updated.id,
        email: updated.email,
        name: updated.name,
        company: updated.company,
        updated_fields: Object.keys(req.body),
        updated_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(req.user.id, 'contact.updated', contactUpdatedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(req.user.id, 'contact.updated', contactUpdatedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      res.json(updated);
    } catch (error) {
      console.error('Error updating investor contact:', error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  // Bulk delete investor contacts
  app.post("/api/investor-contacts/bulk-delete", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }

      const { investorContacts } = await import('@shared/schema');
      const { and, inArray } = await import('drizzle-orm');

      // Delete contacts belonging to this user
      const result = await db
        .delete(investorContacts)
        .where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, contactIds)
          )
        )
        .returning();

      res.json({ deleted: result.length });
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });

  // Bulk update investor contacts
  app.post("/api/investor-contacts/bulk-update", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds, updates } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }

      const { investorContacts } = await import('@shared/schema');
      const { and, inArray } = await import('drizzle-orm');

      // Update contacts belonging to this user
      const result = await db
        .update(investorContacts)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, contactIds)
          )
        )
        .returning();

      res.json({ updated: result.length });
    } catch (error) {
      console.error('Error bulk updating contacts:', error);
      res.status(500).json({ error: "Failed to update contacts" });
    }
  });

  // Bulk add tag to investor contacts
  app.post("/api/investor-contacts/bulk-add-tag", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds, tag } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }

      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ error: "No tag provided" });
      }

      const { investorContacts } = await import('@shared/schema');
      const { and, inArray } = await import('drizzle-orm');

      // Get current contacts
      const currentContacts = await db
        .select()
        .from(investorContacts)
        .where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, contactIds)
          )
        );

      // Update each contact's tags
      let updatedCount = 0;
      for (const contact of currentContacts) {
        const currentTags = contact.tags || [];
        if (!currentTags.includes(tag)) {
          await db
            .update(investorContacts)
            .set({
              tags: [...currentTags, tag],
              updatedAt: new Date()
            })
            .where(eq(investorContacts.id, contact.id));
          updatedCount++;
        }
      }

      res.json({ updated: updatedCount });
    } catch (error) {
      console.error('Error bulk adding tag:', error);
      res.status(500).json({ error: "Failed to add tag" });
    }
  });

  // Create or update investor contact from NDA signature
  app.post("/api/investor-contacts/sync-from-signatures", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const { investorContacts, ndaSignatures, cimDocuments } = await import('@shared/schema');
      const { and, inArray } = await import('drizzle-orm');
      
      // Get all user's CIM documents
      const userCims = await db.select().from(cimDocuments).where(eq(cimDocuments.userId, req.user.id));
      const cimIds = userCims.map(cim => cim.id);
      
      if (cimIds.length === 0) {
        return res.json({ synced: 0 });
      }
      
      // Get all NDA signatures for user's documents
      const signatures = await db
        .select()
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, cimIds));
      
      let syncedCount = 0;
      
      // Group signatures by email
      const signaturesByEmail = signatures.reduce((acc, sig) => {
        if (!acc[sig.signerEmail]) {
          acc[sig.signerEmail] = [];
        }
        acc[sig.signerEmail].push(sig);
        return acc;
      }, {} as Record<string, any[]>);
      
      // Process each unique signer
      for (const [email, sigs] of Object.entries(signaturesByEmail)) {
        const latestSig = sigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())[0];
        
        // Check if contact already exists
        const [existingContact] = await db
          .select()
          .from(investorContacts)
          .where(and(
            eq(investorContacts.userId, req.user.id),
            eq(investorContacts.email, email)
          ));
        
        if (existingContact) {
          // Update existing contact with latest data
          await db
            .update(investorContacts)
            .set({
              totalDocumentViews: existingContact.totalDocumentViews + 1,
              lastSeenAt: new Date(latestSig.signedAt),
              updatedAt: new Date()
            })
            .where(eq(investorContacts.id, existingContact.id));
        } else {
          // Create new contact
          await db
            .insert(investorContacts)
            .values({
              userId: req.user.id,
              email: email,
              name: latestSig.signerName,
              status: 'new',
              totalDocumentViews: sigs.length,
              firstSeenAt: new Date(sigs[0].signedAt),
              lastSeenAt: new Date(latestSig.signedAt),
              tags: []
            });
          syncedCount++;
        }
      }
      
      res.json({ synced: syncedCount });
    } catch (error) {
      console.error('Error syncing investor contacts:', error);
      res.status(500).json({ error: "Failed to sync contacts" });
    }
  });

  // Get CIM documents for investor contacts filtering
  app.get("/api/investor-contacts/cim-documents", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const { cimDocuments } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      // Get all CIM documents for this user
      const userCims = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title,
          createdAt: cimDocuments.createdAt
        })
        .from(cimDocuments)
        .where(eq(cimDocuments.userId, req.user.id))
        .orderBy(desc(cimDocuments.createdAt));
      
      res.json(userCims);
    } catch (error) {
      console.error('Error fetching CIM documents:', error);
      res.status(500).json({ error: "Failed to fetch CIM documents" });
    }
  });

  // Export investor contacts to CSV
  app.get("/api/investor-contacts/export", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Feature is now available to all users

    try {
      const { contactIds } = req.query;
      const { investorContacts, ndaSignatures } = await import('@shared/schema');
      const { and, inArray } = await import('drizzle-orm');
      
      let query = db.select().from(investorContacts).where(eq(investorContacts.userId, req.user.id));
      
      // If specific contacts selected, filter by IDs
      if (contactIds) {
        const ids = (contactIds as string).split(',').map(id => parseInt(id));
        query = db.select().from(investorContacts).where(
          and(
            eq(investorContacts.userId, req.user.id),
            inArray(investorContacts.id, ids)
          )
        );
      }
      
      const contacts = await query;
      
      // Get NDA signatures for additional data
      const allSignatures = await db.select().from(ndaSignatures);
      
      // Create CSV content
      const csvHeaders = [
        'Name',
        'Email',
        'Status',
        'Tags',
        'Total NDA Signatures',
        'Total Document Views',
        'Total Time Spent (minutes)',
        'First Seen',
        'Last Seen',
        'Last Contact Date',
        'Next Follow Up',
        'Notes'
      ];
      
      const csvRows = contacts.map(contact => {
        const signatures = allSignatures.filter(sig => sig.signerEmail === contact.email);
        return [
          contact.name,
          contact.email,
          contact.status,
          contact.tags.join('; '),
          signatures.length,
          contact.totalDocumentViews,
          contact.totalTimeSpentMinutes,
          contact.firstSeenAt?.toISOString() || '',
          contact.lastSeenAt?.toISOString() || '',
          contact.lastContactDate?.toISOString() || '',
          contact.nextFollowUpDate?.toISOString() || '',
          contact.notes || ''
        ];
      });
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="investor-contacts-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
      
    } catch (error) {
      console.error('Error exporting investor contacts:', error);
      res.status(500).json({ error: "Failed to export contacts" });
    }
  });

  // Custom Tags API
  app.get("/api/custom-tags", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const tags = await storage.getCustomTags(req.user.id);
      res.json(tags);
    } catch (error) {
      console.error('Error fetching custom tags:', error);
      res.status(500).json({ error: "Failed to fetch custom tags" });
    }
  });

  app.post("/api/custom-tags", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { name, color } = req.body;
      if (!name || !color) {
        return res.status(400).json({ error: "Name and color are required" });
      }
      
      const newTag = await storage.createCustomTag(req.user.id, name, color);
      res.json(newTag);
    } catch (error) {
      console.error('Error creating custom tag:', error);
      res.status(500).json({ error: "Failed to create custom tag" });
    }
  });

  app.delete("/api/custom-tags/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const tagId = parseInt(req.params.id);
      await storage.deleteCustomTag(tagId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting custom tag:', error);
      res.status(500).json({ error: "Failed to delete custom tag" });
    }
  });

  // Analysis Templates API
  app.get("/api/analysis-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templates = await storage.getAnalysisTemplates(req.user.id);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching analysis templates:', error);
      res.status(500).json({ error: "Failed to fetch analysis templates" });
    }
  });

  app.post("/api/analysis-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateData = insertAnalysisTemplateSchema.parse(req.body);
      const newTemplate = await storage.createAnalysisTemplate(req.user.id, templateData);
      res.json(newTemplate);
    } catch (error) {
      console.error('Error creating analysis template:', error);
      res.status(500).json({ error: "Failed to create analysis template" });
    }
  });

  app.put("/api/analysis-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      const templateData = insertAnalysisTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateAnalysisTemplate(templateId, templateData);
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating analysis template:', error);
      res.status(500).json({ error: "Failed to update analysis template" });
    }
  });

  app.delete("/api/analysis-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      await storage.deleteAnalysisTemplate(templateId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting analysis template:', error);
      res.status(500).json({ error: "Failed to delete analysis template" });
    }
  });

  // Content & Style Template Routes
  app.get("/api/content-style-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templates = await storage.getContentStyleTemplates(req.user!.id);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching content style templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/content-style-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      console.log("[ContentStyleTemplate] Creating template for user:", req.user!.id);
      console.log("[ContentStyleTemplate] Request body:", JSON.stringify(req.body, null, 2));

      // Validate the request body
      const { insertContentStyleTemplateSchema } = await import("@shared/schema");
      const validatedData = insertContentStyleTemplateSchema.parse(req.body);

      console.log("[ContentStyleTemplate] Validated data:", JSON.stringify(validatedData, null, 2));

      const template = await storage.createContentStyleTemplate(req.user!.id, validatedData);
      console.log("[ContentStyleTemplate] Template created successfully:", template.id);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("[ContentStyleTemplate] Error creating template:", error);

      // Check if it's a Zod validation error
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors
        });
      }

      res.status(500).json({ error: "Failed to create template", message: error.message });
    }
  });

  app.patch("/api/content-style-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      
      const template = await storage.updateContentStyleTemplate(templateId, req.user!.id, req.body);
      res.json(template);
    } catch (error) {
      console.error("Error updating content style template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/content-style-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      
      await storage.deleteContentStyleTemplate(templateId, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting content style template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  app.post("/api/content-style-templates/:id/set-default", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      
      await storage.setDefaultContentStyleTemplate(templateId, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default content style template:", error);
      res.status(500).json({ error: "Failed to set default template" });
    }
  });

  app.get("/api/content-style-templates/default", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const template = await storage.getUserDefaultContentStyleTemplate(req.user!.id);
      res.json(template || null);
    } catch (error) {
      console.error("Error fetching default content style template:", error);
      res.status(500).json({ error: "Failed to fetch default template" });
    }
  });

  // Admin-only migration endpoint to convert external cover images to local storage
  app.post("/api/admin/migrate-cover-images", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Check if user is admin
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      console.log("Starting cover image migration...");

      // Get all CIM documents with external cover images (admin operation - explicit high limit)
      const allDocs = await storage.getAllCimDocuments({ limit: 10000, offset: 0 });
      const docsToMigrate = allDocs.filter(doc =>
        doc.coverImageUrl && coverImageService.isExternalImageUrl(doc.coverImageUrl)
      );

      console.log(`Found ${docsToMigrate.length} documents with external cover images to migrate`);

      let successCount = 0;
      let failCount = 0;

      for (const doc of docsToMigrate) {
        try {
          console.log(`Migrating cover image for document ${doc.id}: ${doc.coverImageUrl}`);
          
          const downloadResult = await coverImageService.downloadAndStoreImage(doc.coverImageUrl!, doc.userId);
          
          await storage.updateCimDocument(doc.id, {
            coverImageUrl: downloadResult.publicUrl
          });

          console.log(`✅ Successfully migrated document ${doc.id}: ${downloadResult.publicUrl}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to migrate document ${doc.id}:`, error);
          failCount++;
        }
      }

      res.json({
        success: true,
        totalDocuments: docsToMigrate.length,
        successCount,
        failCount,
        message: `Migration completed: ${successCount} successful, ${failCount} failed`
      });

    } catch (error) {
      console.error("Cover image migration error:", error);
      res.status(500).json({ error: "Failed to complete cover image migration" });
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
  
  // Register e-signature routes
  app.use('/api/esignature', eSignatureRoutes);
  app.use('/api/esign', esignRoutes);

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

  // ========== Notification Preferences Routes ==========

  // Get current user's notification preferences
  app.get("/api/user/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;
      let preferences = await storage.getNotificationPreferences(userId);

      // If no preferences exist, return defaults
      if (!preferences) {
        preferences = {
          id: 0,
          userId,
          // Email defaults
          emailMentions: true,
          emailTaskAssigned: true,
          emailTaskReminder: true,
          emailDealUpdates: false,
          emailTeamInvites: true,
          emailEsignRequests: true,
          emailEsignCompleted: true,
          emailWeeklyDigest: false,
          // In-app defaults
          inappMentions: true,
          inappTaskAssigned: true,
          inappTaskReminder: true,
          inappDealUpdates: true,
          inappEsignRequests: true,
          inappEsignCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  // Update user's notification preferences
  app.put("/api/user/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;
      const updates = req.body;

      // Validate the fields - only allow known preference fields
      const allowedFields = [
        'emailMentions', 'emailTaskAssigned', 'emailTaskReminder', 'emailDealUpdates',
        'emailTeamInvites', 'emailEsignRequests', 'emailEsignCompleted', 'emailWeeklyDigest',
        'inappMentions', 'inappTaskAssigned', 'inappTaskReminder', 'inappDealUpdates',
        'inappEsignRequests', 'inappEsignCompleted'
      ];

      const filteredUpdates: Record<string, boolean> = {};
      for (const key of allowedFields) {
        if (key in updates && typeof updates[key] === 'boolean') {
          filteredUpdates[key] = updates[key];
        }
      }

      const preferences = await storage.upsertNotificationPreferences(userId, filteredUpdates);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

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
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript, generateFlexibleCimDocument, type FlexibleCimDocument } from "./perplexity";
import { normalizeUrl, extractLogoFromWebsite, extractWebsiteImages, downloadSelectedImages } from "./website-analyzer";
import { imageManager } from "./image-manager";
import { insertCimDocumentSchema, subscriptionPlans, users, insertNdaTemplateSchema, insertNdaSignatureSchema, financialFiles, insertFinancialFileSchema, insertCollaboratorSchema, uploadedFiles, ndaAccessTokens, insertAnalysisTemplateSchema } from "@shared/schema";
import { searchService, versionService, analyticsService } from "./premium-services";
import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { withRetry } from './db-utils';
import { createSubscriptionSession, createSubscriptionSessionDirect, handleStripeWebhook, verifyCheckoutSession, createCustomerPortalSession, getPricing } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { generateWordDocument, generatePDF, generateHtml, formatTextContent } from "./document-export";
import { exportToWordPress, formatWordPressContent, fetchBeaverBuilderTemplates } from "./wordpress-export";
// Geoip will be imported dynamically in the function where it's used

import JSZip from 'jszip';
import sharp from 'sharp';
import { sendNdaSignedEmail, sendEmail, sendApprovalEmail, sendOwnerApprovalNotification } from "./email";
import { addSignatureToNda } from "./pdf-utils";
import { generateSecureToken, generateRedirectId } from "./token-utils";
import { sanitizeUser, sanitizeUserForSharing, sanitizeForLogging, validateResponseSafety } from "./data-sanitizer";
import { responseSanitizationMiddleware, securityHeadersMiddleware, sensitiveEndpointLimiter } from "./security-middleware";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { registerNdaTemplateRoutes } from "./routes/nda-template-routes";
import { PdfSignatureProcessor } from "./pdf-signature-processor";


// Setup upload directory
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Setup business images directory
const businessImagesDir = path.join(process.cwd(), 'public', 'business-images');
fs.mkdir(businessImagesDir, { recursive: true }).catch(console.error);

// Setup secure financial files directory (outside public folder)
const financialFilesDir = path.join(process.cwd(), 'private', 'financial-files');
fs.mkdir(financialFilesDir, { recursive: true }).catch(console.error);

// Setup secure uploaded CIM files directory (outside public folder)
const uploadedCimsDir = path.join(process.cwd(), 'private', 'uploaded-cims');
fs.mkdir(uploadedCimsDir, { recursive: true }).catch(console.error);


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Define authorized admin emails
const AUTHORIZED_ADMIN_EMAILS = [
  'robertkale20@gmail.com',
  'robertkale20+cimshare@gmail.com'
];

// Helper function to check if user is an authorized admin
function isAuthorizedAdmin(user: any): boolean {
  if (!user) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(user.email);
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

// Configure multer for memory storage with increased limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for large files
    fieldSize: 100 * 1024 * 1024, // 100MB limit for field data
    fields: 50, // Increase field count limit
    files: 20 // Increase file count limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files including user-images
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/user-images', express.static(path.join(process.cwd(), 'public', 'user-images')));
  
  // Setup authentication first, before any other routes
  setupAuth(app);
  
  // SECURITY: Apply security middleware globally
  app.use(responseSanitizationMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(sensitiveEndpointLimiter);

  // Register NDA template routes BEFORE other routes to avoid conflicts
  console.log('=== REGISTERING NDA TEMPLATE ROUTES ===');
  registerNdaTemplateRoutes(app);
  console.log('=== NDA TEMPLATE ROUTES REGISTERED ===');

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

  // Image serving endpoints - serve user images statically
  app.use('/user-images', express.static(path.join(process.cwd(), 'public', 'user-images')));

  // Migration endpoint - run image migration
  app.post("/api/admin/migrate-images", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const result = await migrateImagesToFiles();
      res.json(result);
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ error: "Migration failed" });
    }
  });

  // Serve uploaded file content for sharing
  app.get("/api/share/:shareSlug/file", async (req, res) => {
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
          const fileBuffer = await fs.readFile(firstFile.filePath);
          
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
          console.error("Error reading uploaded file from uploadedFiles table:", fileError);
        }
      }

      // Fallback to old uploadedFilePath system
      if (cimDoc.uploadedFilePath) {
        try {
          const fileBuffer = await fs.readFile(cimDoc.uploadedFilePath);
          
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
          console.error("Error reading uploaded file from legacy path:", fileError);
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
    
    console.log("=== OPTIMIZED NDA CHECK ===");
    console.log("Processing NDA check for slug:", shareSlug?.substring(0, 10) + "...");
    
    try {
      // Direct database lookup without cache complications
      console.log("Processing NDA check with direct database lookup");

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

      const result = {
        requiresNda: Boolean(cimDoc.ndaProtected),
        requiresApproval: Boolean(cimDoc.ndaApprovalRequired),
        title: cimDoc.title || 'Untitled Document',
        documentId: cimDoc.id
      };

      // Skip caching to avoid import issues
      console.log("NDA check completed successfully without cache");

      console.log("NDA check completed in:", Date.now() - startTime + "ms");
      res.json(result);

    } catch (error) {
      console.error('NDA check error:', error);
      res.status(500).json({ error: "Failed to check NDA status" });
    }
  });

  // Public share endpoints (comprehensively optimized for performance)
  app.get("/api/share/:shareSlug", async (req, res) => {
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
        console.log("Optimized query failed, using standard method:", error.message);
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

      // PERFORMANCE OPTIMIZATION 2: Async view tracking (non-blocking)
      console.log("Starting async view tracking for document:", cimDoc.id);
      
      const viewTrackingPromise = (async () => {
        try {
          if (cimDoc.ndaProtected) {
            console.log("NDA-protected document - view will be tracked via token access");
          } else {
            const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            
            await Promise.all([
              storage.trackDocumentView(cimDoc.id, 'anonymous', {
                ipAddress: clientIp,
                userAgent: userAgent
              }),
              storage.incrementShareViewCount(cimDoc.id)
            ]);
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
      const baseUrl = `${protocol}://${host}`;

      // Optimized URL processing function
      const processImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      };

      // Process images and URLs in parallel
      const [absoluteSelectedImages, absoluteLogoUrl, ndaUrl] = [
        (cimDoc.selectedImages || []).map(processImageUrl).filter(Boolean),
        processImageUrl(cimDoc.logoUrl),
        cimDoc.ndaProtected ? `${baseUrl}/nda/${shareSlug}` : null
      ];

      console.log("URL processing time:", Date.now() - urlProcessingStart + "ms");

      // PERFORMANCE OPTIMIZATION 5: Streamlined profile sanitization
      const sanitizedUserProfile = {
        name: userProfile.name,
        title: userProfile.title,
        email: userProfile.email,
        phoneNumber: userProfile.phone,
        businessName: userProfile.businessName,
        businessLogo: userProfile.businessLogo,
        profilePhoto: userProfile.profile_photo || userProfile.profilePhoto // Use actual profile photo from database
      };

      // Ensure view tracking completes (but don't wait for it)
      viewTrackingPromise.catch(error => 
        console.error('View tracking failed (non-blocking):', error)
      );

      console.log("Total optimized response time:", Date.now() - startTime + "ms");

      const responseData = {
        cim: {
          id: cimDoc.id,
          title: cimDoc.title,
          analysis: cimDoc.analysis,
          logoUrl: cimDoc.logoUrl,
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
          userProfile: sanitizedUserProfile
        },
        websiteUrl: cimDoc.websiteUrl || '',
        selectedImages: absoluteSelectedImages,
        logoUrl: absoluteLogoUrl,
        userProfileData: sanitizedUserProfile,
        requiresNda: cimDoc.ndaProtected || false,
        ndaUrl,
        customSections: customSections || [],
        ndaApprovalStatus
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
    try {
      const { shareSlug } = req.params;
      console.log("Shared PDF export request for slug:", shareSlug);
      
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

      // PERFORMANCE OPTIMIZATION: Parallel data fetching for shared PDF export
      const dataFetchStart = Date.now();
      const [userProfile, documentFinancialFiles, customSections] = await Promise.all([
        storage.getUser(cimDoc.userId),
        db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, cimDoc.id)),
        storage.getCustomSections(cimDoc.id)
      ]);

      console.log("Data fetch time:", Date.now() - dataFetchStart + "ms");

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
      const baseUrl = `${protocol}://${host}`;

      // PERFORMANCE OPTIMIZATION: Direct PDF generation with cached data
      const pdfGenStart = Date.now();
      const pdfBuffer = await generatePDF(
        cimDoc.analysis, // Use cached analysis - no regeneration
        cimDoc.logoUrl, // Use cached logo URL  
        cimDoc.websiteUrl || undefined,
        cimDoc.selectedImages || [], // Use cached images - no reprocessing
        userProfile,
        financialData,
        documentFinancialFiles,
        baseUrl,
        cimDoc.title,
        customSections,
        cimDoc.coverImageUrl,
        cimDoc.coverImagePosition,
        cimDoc.id,
        pdfTemplate, // Pass user's template preference
        shareSlug // Pass shareSlug to PDF generator for shared links
      );
      
      console.log("PDF generation time:", Date.now() - pdfGenStart + "ms");
      console.log("Total shared PDF export time:", Date.now() - startTime + "ms");
      console.log("PDF generation completed, buffer length:", pdfBuffer.length);

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

  // Stripe configuration endpoint for frontend
  app.get("/api/stripe-config", (req, res) => {
    res.json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
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






  // CIM Document Routes with file upload support
  app.post("/api/cim/generate", async (req, res) => {
    console.log("🚀 CIM POST ROUTE ACCESSED");
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Debug: Check if request reaches this point
      console.log("=== CIM POST ROUTE HIT ===");
      console.log("Request method:", req.method);
      console.log("Request URL:", req.url);
      console.log("Has selectedImages in body:", !!req.body.selectedImages);
      
      // Debug: Check EVERYTHING in the request
      console.log("=== CIM REQUEST DEBUG START ===");
      console.log("Request body keys:", Object.keys(req.body));
      console.log("Request body selectedImages:", req.body.selectedImages);
      console.log("=== CIM REQUEST DEBUG END ===");
      
      const data = insertCimDocumentSchema.parse(req.body);
      const docId = data.docId; // For regeneration
      const customizations = data.customizations || {};
      
      // Debug selectedImages after Zod parsing
      console.log("After Zod parsing - data.selectedImages:", data.selectedImages);
      console.log("Raw req.body.selectedImages:", req.body.selectedImages);
      
      // Debug: Check if selectedImages are present in regular route
      console.log("Selected images in regular route:", req.body.selectedImages);
      console.log("Selected images type:", typeof req.body.selectedImages);
      console.log("Customizations in regular route:", customizations);

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
        
        let analysis = await generateFlexibleCimDocument(
          data.transcript,
          data.directions,
          purpose,
          tone,
          audience,
          data.financials,
          undefined // websiteData - will add later if needed
        );
        
        // If website URL is provided, extract logo in parallel
        if (data.websiteUrl) {
          try {
            const normalizedUrl = normalizeUrl(data.websiteUrl);
            
            // Extract logo only (screenshot functionality removed for efficiency)
            try {
              console.log("Extracting logo from website...");
              const logoUrl = await extractLogoFromWebsite(normalizedUrl, req.user!.id);
              if (logoUrl) {
                existingDoc.logoUrl = logoUrl;
              }
              console.log("Logo extraction completed:", logoUrl);
            } catch (logoError) {
              console.error("Logo extraction error:", logoError);
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

      // New document generation using flexible CIM system
      const purpose = data.purpose || 'business_overview';
      const tone = data.tone || 'professional';
      const audience = data.audience || 'investors';
      
      console.log("=== USING NEW FLEXIBLE CIM SYSTEM ===");
      console.log("Purpose:", purpose);
      console.log("Tone:", tone);
      console.log("Audience:", audience);
      console.log("Custom directions:", data.directions);
      
      let analysis = await generateFlexibleCimDocument(
        data.transcript,
        data.directions,
        purpose,
        tone,
        audience,
        data.financials,
        undefined // websiteData - will add later if needed
      );
      
      console.log("=== FLEXIBLE CIM ANALYSIS RESULT ===");
      console.log("Analysis type:", typeof analysis);
      console.log("Has sections:", !!analysis.sections);
      console.log("Number of sections:", analysis.sections?.length || 0);
      
      // Handle selected images early in the process for regular route
      let savedImagePaths: string[] = [];
      console.log("Checking for selected images:", {
        hasWebsiteUrl: !!data.websiteUrl,
        hasSelectedImages: !!data.selectedImages,
        selectedImagesType: typeof data.selectedImages,
        selectedImagesLength: Array.isArray(data.selectedImages) ? data.selectedImages.length : 'not array'
      });
      
      // Store selectedImages URLs for processing after CIM creation
      let selectedImageUrls: string[] = [];
      if (data.selectedImages && Array.isArray(data.selectedImages) && data.selectedImages.length > 0) {
        selectedImageUrls = data.selectedImages;
        console.log(`Will process ${selectedImageUrls.length} selected images after CIM creation`);
      }
      
      // If website URL is provided, extract logo and images in parallel
      let logoUrl = null;
      let extractedImages: string[] = [];
      
      if (data.websiteUrl) {
        try {
          const normalizedUrl = normalizeUrl(data.websiteUrl);
          console.log("Starting parallel website processing...");
          
          // Run logo extraction and image extraction in parallel for efficiency
          const [logoResult, imagesResult] = await Promise.allSettled([
            extractLogoFromWebsite(normalizedUrl, req.user!.id),
            extractWebsiteImages(normalizedUrl)
          ]);
          
          // Handle logo extraction result
          if (logoResult.status === 'fulfilled' && logoResult.value) {
            logoUrl = logoResult.value;
            console.log("Logo extracted successfully:", logoUrl);
          } else {
            console.log("Logo extraction failed or no logo found");
          }
          
          // Handle image extraction result
          if (imagesResult.status === 'fulfilled' && Array.isArray(imagesResult.value)) {
            extractedImages = imagesResult.value;
            console.log(`Extracted ${extractedImages.length} images from website`);
          } else {
            console.log("Image extraction failed or no images found");
          }
          
        } catch (error) {
          console.error("Website processing error:", error);
          // Continue with just the transcript analysis
        }
      }
      
      // Extract financial data from request
      const financials = data.financials;
      
      // Extract cover image data from request (handling nested object structure)
      const coverImage = data.coverImage;
      const coverImageUrl = coverImage?.url || null;
      const coverImagePosition = coverImage?.position ? JSON.stringify(coverImage.position) : null;
      const coverImageAttribution = coverImage?.attribution || null;
      
      console.log("Creating CIM document with directions:", data.directions);
      
      // Generate automatic share link for new document
      const randomId = Math.random().toString(36).substring(2, 8);
      const shareSlug = `cim-${randomId}`;
      
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        directions: data.directions, // Explicitly include custom directions
        websiteUrl: data.websiteUrl,
        logoUrl,
        analysis,
        selectedImages: savedImagePaths,
        regenerationCount: 0,
        // Add cover image data
        coverImageUrl,
        coverImagePosition,
        coverImageAttribution,
        // Add financial data directly to the document
        financialsEnabled: financials?.enabled || false,
        askingPrice: financials?.askingPrice || null,
        askingPriceIncluded: financials?.askingPriceIncluded || false,
        revenue: financials?.revenue || null,
        revenueIncluded: financials?.revenueIncluded || false,
        ebitda: financials?.ebitda || null,
        ebitdaIncluded: financials?.ebitdaIncluded || false,
        // Enable sharing by default with generated slug
        shareEnabled: true,
        shareSlug: shareSlug,
        sharePassword: null,
        shareExpiresAt: null,
        ndaProtected: false,
        ndaTemplateId: null
      });

      // Process only the user-selected images (selectedImageUrls already contains the user's choices)
      // Note: extractedImages are just for UI display, selectedImageUrls contains the actual user selections
      const imagesToProcess = selectedImageUrls;
      
      // Process selected images after CIM creation with proper CIM ID
      if (imagesToProcess.length > 0) {
        try {
          console.log(`Processing ${imagesToProcess.length} user-selected images for CIM ${doc.id}...`);
          console.log(`Selected image URLs:`, imagesToProcess);
          
          const imagePromises = imagesToProcess.map(async (imageUrl: string, index: number) => {
            try {
              console.log(`Downloading image ${index + 1}/${imagesToProcess.length}: ${imageUrl}`);
              const metadata = await imageManager.downloadImageFromUrl(imageUrl, doc.id);
              console.log(`Successfully downloaded image ${index + 1}: ${metadata.publicPath}`);
              return metadata.publicPath;
            } catch (error) {
              console.error(`Failed to download image ${imageUrl}:`, error);
              return null;
            }
          });
          
          const imageResults = await Promise.allSettled(imagePromises);
          const downloadedImages = imageResults
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => (result as PromiseFulfilledResult<string>).value);
          
          console.log(`Download results: ${downloadedImages.length}/${imagesToProcess.length} images downloaded successfully`);
          console.log(`Downloaded image paths:`, downloadedImages);
          
          // Update the CIM document with the downloaded image paths
          if (downloadedImages.length > 0) {
            await storage.updateCimImages(doc.id, downloadedImages);
            doc.selectedImages = downloadedImages; // Update the response object
            console.log(`Successfully updated CIM ${doc.id} with ${downloadedImages.length} images`);
          } else {
            console.log(`No images were successfully downloaded for CIM ${doc.id}`);
          }
        } catch (imageError) {
          console.error("Error processing selected images:", imageError);
        }
      }

      res.json(doc);
    } catch (error) {
      console.error("=== CIM GENERATION ERROR ===");
      console.error("Error type:", typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      console.error("Request body keys:", Object.keys(req.body));
      console.error("User ID:", req.user?.id);
      console.error("=== END CIM GENERATION ERROR ===");
      
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

  // Upload business image endpoint
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

      // Optimize and convert image to base64 for persistent storage
      let processedBuffer = req.file.buffer;
      let mimeType = req.file.mimetype;
      
      try {
        // Use sharp to resize and optimize the image
        const sharp = require('sharp');
        const image = sharp(req.file.buffer);
        
        // Check if the original image has transparency
        const metadata = await image.metadata();
        const hasAlpha = metadata.channels === 4 || metadata.hasAlpha;
        
        if (hasAlpha || req.file.mimetype === 'image/png') {
          // Preserve transparency for PNG images
          processedBuffer = await image
            .resize(1200, 800, { 
              fit: 'inside', 
              withoutEnlargement: true,
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({ quality: 85, force: true })
            .toBuffer();
          mimeType = 'image/png';
        } else {
          // Convert to JPEG for photos without transparency
          processedBuffer = await image
            .resize(1200, 800, { 
              fit: 'inside', 
              withoutEnlargement: true,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .jpeg({ quality: 85 })
            .toBuffer();
          mimeType = 'image/jpeg';
        }
      } catch (sharpError) {
        console.log('Sharp optimization failed, using original:', sharpError.message);
      }

      // Convert to base64 data URL for persistent storage
      const base64Data = processedBuffer.toString('base64');
      const imageDataUrl = `data:${mimeType};base64,${base64Data}`;
      
      // Update the CIM document with the new base64 image
      const currentImages = cim.selectedImages || [];
      const updatedImages = [...currentImages, imageDataUrl];
      await storage.updateCimImages(cimId, updatedImages);

      console.log(`Successfully uploaded business image as base64 (${base64Data.length} characters)`);
      res.json({ success: true, imagePath: imageDataUrl });
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

  // Create specialized upload configuration for large financial files
  const largeFileUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB limit for financial files
      fieldSize: 200 * 1024 * 1024, // 200MB limit for field data
      fields: 100, // Increase field count limit
      files: 50 // Increase file count limit
    }
  });

  // File upload endpoint for large text and financial files
  app.post("/api/cim/upload", (req, res, next) => {
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
      const transcript = transcriptFile ? transcriptFile.buffer.toString('utf-8') : req.body.transcript;
      
      // Parse selectedImages from FormData string to array before schema validation
      let parsedBody = { ...req.body };
      if (req.body.selectedImages && typeof req.body.selectedImages === 'string') {
        try {
          parsedBody.selectedImages = JSON.parse(req.body.selectedImages);
          console.log("Parsed selectedImages from FormData:", parsedBody.selectedImages);
        } catch (error) {
          console.error("Failed to parse selectedImages:", error);
          parsedBody.selectedImages = [];
        }
      }
      
      const data = insertCimDocumentSchema.parse({
        ...parsedBody,
        transcript
      });

      // Debug: Check if selectedImages are present
      console.log("Selected images in request:", data.selectedImages);
      
      // Parse customizations from upload form
      const customizations = data.customizations || {};
      
      // Debug financial data in upload endpoint
      console.log("=== UPLOAD ENDPOINT FINANCIAL DEBUG ===");
      console.log("Raw financials from form:", req.body.financials);
      console.log("financialsEnabled from parsed data:", data.financialsEnabled);
      let parsedFinancials = null;
      if (req.body.financials) {
        try {
          parsedFinancials = JSON.parse(req.body.financials);
          console.log("Parsed financials:", parsedFinancials);
        } catch (e) {
          console.error("Failed to parse financials:", e);
        }
      }
      console.log("Customizations from upload:", customizations);

      console.log("Custom directions provided:", data.directions ? "Yes" : "No");
      if (data.directions) {
        console.log("Custom directions content:", data.directions);
      }
      
      // Use flexible CIM system for upload route as well
      const purpose = data.purpose || 'business_overview';
      const tone = data.tone || 'professional';
      const audience = data.audience || 'investors';
      
      let analysis = await generateFlexibleCimDocument(
        transcript,
        data.directions,
        purpose,
        tone,
        audience,
        parsedFinancials,
        undefined
      );
      
      // Handle selected images early in the process - always download if provided
      let savedImagePaths: string[] = [];
      if (data.selectedImages && Array.isArray(data.selectedImages) && data.selectedImages.length > 0) {
        try {
          const normalizedUrl = data.websiteUrl ? normalizeUrl(data.websiteUrl) : 'unknown-source';
          console.log(`Processing ${data.selectedImages.length} selected images...`);
          console.log("Selected image URLs to download:", data.selectedImages);
          savedImagePaths = await downloadSelectedImages(data.selectedImages, normalizedUrl, req.user!.id);
          console.log(`Successfully downloaded ${savedImagePaths.length} selected images`);
          console.log("Downloaded image paths:", savedImagePaths);
          
          // Store selected images in analysis object
          if (typeof analysis === 'object' && analysis !== null) {
            (analysis as any).selectedImages = savedImagePaths;
          }
        } catch (imageError) {
          console.error("Selected images processing error:", imageError);
          console.error("Error details:", imageError);
        }
      } else {
        console.log("No selected images to process:", {
          hasSelectedImages: !!data.selectedImages,
          isArray: Array.isArray(data.selectedImages),
          length: data.selectedImages?.length || 0
        });
      }
      
      // If website URL is provided, extract logo in parallel (for file upload route)
      let logoUrl = null;
      if (data.websiteUrl) {
        try {
          const normalizedUrl = normalizeUrl(data.websiteUrl);
          console.log("Extracting logo from website (upload route)...");
          
          try {
            logoUrl = await extractLogoFromWebsite(normalizedUrl, req.user!.id);
            console.log("Logo extraction completed:", logoUrl);
          } catch (logoError) {
            console.error("Logo extraction error:", logoError);
          }
        } catch (error) {
          console.error("Website processing error:", error);
        }
      }
      
      // Extract financial data from request
      const financials = data.financials;
      
      // Extract cover image data from request
      const coverImageUrl = data.coverImageUrl || null;
      const coverImagePosition = data.coverImagePosition || null;
      const coverImageAttribution = data.coverImageAttribution || null;
      
      console.log("Creating CIM document from upload with directions:", data.directions);
      console.log("Financial data for upload route:", parsedFinancials);
      
      // Handle financial files upload
      let uploadedFinancialFiles = [];
      const financialFileFields = files.filter(file => file.fieldname.startsWith('financialFile_'));
      
      console.log("Found financial files to upload:", financialFileFields.length);
      
      if (financialFileFields.length > 0) {
        const financialFilesDir = path.join(process.cwd(), 'financial-files');
        if (!fsSync.existsSync(financialFilesDir)) {
          fsSync.mkdirSync(financialFilesDir, { recursive: true });
        }
        
        for (const file of financialFileFields) {
          const fileExtension = path.extname(file.originalname);
          const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
          const filePath = path.join(financialFilesDir, uniqueFileName);
          
          fsSync.writeFileSync(filePath, file.buffer);
          
          uploadedFinancialFiles.push({
            fileName: uniqueFileName,
            originalName: file.originalname,
            filePath,
            fileSize: file.size,
            mimeType: file.mimetype
          });
        }
        console.log("Uploaded financial files:", uploadedFinancialFiles.length);
      }
      
      // Generate automatic share link for new document
      const randomId = Math.random().toString(36).substring(2, 8);
      const shareSlug = `cim-${randomId}`;
      
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        directions: data.directions, // Explicitly include custom directions
        websiteUrl: data.websiteUrl,
        logoUrl,
        analysis,
        selectedImages: savedImagePaths,
        regenerationCount: 0,
        // Add cover image data
        coverImageUrl,
        coverImagePosition,
        coverImageAttribution,
        // Add financial data directly to the document (upload route uses parsedFinancials)
        financialsEnabled: parsedFinancials?.enabled || false,
        askingPrice: parsedFinancials?.askingPrice || null,
        askingPriceIncluded: parsedFinancials?.askingPriceIncluded || false,
        revenue: parsedFinancials?.revenue || null,
        revenueIncluded: parsedFinancials?.revenueIncluded || false,
        ebitda: parsedFinancials?.ebitda || null,
        ebitdaIncluded: parsedFinancials?.ebitdaIncluded || false,
        // Enable sharing by default with generated slug
        shareEnabled: true,
        shareSlug: shareSlug,
        sharePassword: null,
        shareExpiresAt: null,
        ndaProtected: false,
        ndaTemplateId: null
      });

      // Save financial files to database after document creation
      if (uploadedFinancialFiles.length > 0) {
        console.log("Saving financial files to database for doc ID:", doc.id);
        for (const fileData of uploadedFinancialFiles) {
          await db.insert(financialFiles).values({
            cimDocumentId: doc.id,
            fileName: fileData.fileName,
            originalName: fileData.originalName,
            filePath: fileData.filePath,
            fileSize: fileData.fileSize,
            mimeType: fileData.mimeType,
            included: true
          });
        }
        console.log("Financial files saved to database successfully");
      }

      res.json(doc);
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

      const { title } = req.body;
      if (!title || title.trim() === '') {
        console.log("No title provided:", title);
        return res.status(400).json({ error: "Title is required" });
      }

      // Validate file types
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      for (const file of files) {
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ error: `File "${file.originalname}" is not a supported type. Only PDF, DOCX, and TXT files are supported.` });
        }
      }

      // Create upload directory if it doesn't exist
      const uploadedCimsDir = path.join(process.cwd(), 'uploaded-cims');
      await fs.mkdir(uploadedCimsDir, { recursive: true });

      // Create CIM document record first
      const cimDoc = await storage.createUploadedCimDocument(req.user!.id, {
        title: title.trim()
      });

      // Process and save each file
      const savedFiles = [];
      for (const file of files) {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(file.originalname);
        const fileName = `${timestamp}_${randomStr}${ext}`;
        const filePath = path.join(uploadedCimsDir, fileName);

        // Save file to disk
        await fs.writeFile(filePath, file.buffer);

        // Store file record in uploadedFiles table
        const uploadedFile = await storage.createUploadedFile({
          cimDocumentId: cimDoc.id,
          fileName: file.originalname,
          filePath,
          fileSize: file.size,
          mimeType: file.mimetype
        });

        savedFiles.push(uploadedFile);
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
        // Check if file exists
        try {
          await fs.access(doc.uploadedFilePath);
          
          // Set appropriate headers
          res.setHeader('Content-Type', doc.uploadedFileMimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${doc.uploadedFileName}"`);
          
          // Stream the file
          const fileBuffer = await fs.readFile(doc.uploadedFilePath);
          res.send(fileBuffer);
        } catch (fileError) {
          return res.status(404).json({ error: "File not found on disk" });
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

      // Check if file is included
      if (file.included === false) {
        return res.status(404).json({ error: "File not available for download" });
      }

      // Check if file exists on disk
      const fileExists = await fs.access(file.filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      // Set appropriate headers
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType);

      // Stream the file
      const fileStream = await fs.readFile(file.filePath);
      res.send(fileStream);
    } catch (error) {
      console.error('Error downloading shared financial file:', error);
      res.status(500).json({ error: "Failed to download file" });
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

      // Check if file exists on disk
      try {
        await fs.access(file.filePath);
        
        // Set appropriate headers
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
        
        // Stream the file
        const fileBuffer = await fs.readFile(file.filePath);
        res.send(fileBuffer);
      } catch (fileError) {
        return res.status(404).json({ error: "File not found on disk" });
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
          const fileBuffer = await fs.readFile(file.filePath);
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
    
    const result = await storage.getCimDocuments(req.user!.id, { page, limit, search });
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
      
      if (doc.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: "You don't have permission to view this document" });
      }
      
      res.json(doc);
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
      
      if (doc.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: "You don't have permission to update this document" });
      }
      
      console.log("Updating CIM document with data:", req.body);
      const updatedDoc = await storage.updateCimDocument(docId, req.body);
      console.log("Updated CIM document:", updatedDoc);
      
      res.json(updatedDoc);
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
      res.json(updatedDoc);
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
      
      const imageUrls = await extractWebsiteImages(websiteUrl);
      
      res.json({ images: imageUrls });
    } catch (error) {
      console.error("Error extracting website images:", error);
      res.status(500).json({ error: "Failed to extract website images" });
    }
  });

  // Download selected images endpoint
  app.post("/api/download-images", async (req, res) => {
    try {
      const { imageUrls, websiteUrl } = req.body;
      
      if (!imageUrls || !Array.isArray(imageUrls) || !websiteUrl) {
        return res.status(400).json({ error: "imageUrls array and websiteUrl are required" });
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
        dailyViews: {} // Can be enhanced later with daily breakdown
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

      const viewHistory = await storage.getNdaSignerViewHistory(docId, signerEmail);
      res.json(viewHistory);
    } catch (error) {
      console.error("NDA signer view history error:", error);
      res.status(500).json({ error: "Failed to get signer view history" });
    }
  });

  // Subscription Routes
  app.get("/api/subscription/verify-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "No session ID provided" });

    try {
      console.log("Verifying session:", session_id);
      const result = await verifyCheckoutSession(session_id as string);
      if (result) {
        const { userId, status, endsAt } = result;
        console.log("Session verified, updating subscription:", { userId, status, endsAt });

        await storage.updateSubscription(userId, status, endsAt);

        // Update the user's session
        const user = await storage.getUser(userId);
        if (req.session && req.user?.id === userId) {
          req.session.passport = req.session.passport || {};
          // @ts-ignore - we know the passport property exists now
          req.session.passport.user = user;
          await new Promise((resolve) => req.session.save(resolve));
        }

        res.json({ success: true, status });
      } else {
        console.log("Invalid or expired session");
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
      const hostHeader = req.get('host');
      console.log("Creating Stripe session with host:", hostHeader);
      
      // Use direct price ID to avoid retrieval issues
      const priceId = "price_1RdzViLgC8JlC4RajYNV2iqN";
      console.log("Using direct price ID:", priceId);
      
      if (!priceId) {
        throw new Error("Price ID not configured");
      }

      // For authenticated users, use their ID and email
      // For non-authenticated users, create a temp session
      let userId = req.user?.id;
      let userEmail = req.user?.email || email;
      
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
        standard: process.env.STRIPE_PRICE_ID_STANDARD,
        premium: process.env.STRIPE_PRICE_ID_PREMIUM
      });
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(400).json({ error: `Failed to create checkout session: ${errorMessage}` });
    }
  });

  // Stripe webhook endpoint
  app.post("/api/webhook/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.log("No Stripe signature found");
      return res.sendStatus(400);
    }

    try {
      console.log("Received Stripe webhook event");
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      console.log("Webhook event type:", event.type);
      const result = await handleStripeWebhook(event);

      if (result) {
        const { userId, status, endsAt, subscriptionId } = result;
        console.log("Updating subscription:", { userId, status, endsAt, subscriptionId });

        await storage.updateSubscription(userId, status, endsAt, subscriptionId);
        console.log(`Successfully updated subscription for user ${userId} to ${status}`);

        // Force refresh the user's session if they're currently logged in
        const user = await storage.getUser(userId);
        console.log("Retrieved updated user subscription status:", user?.subscriptionStatus);

        if (req.session && req.user?.id === userId) {
          req.session.passport = req.session.passport || {};
          // @ts-ignore - we know the passport property exists now
          req.session.passport.user = userId; // Store only the user ID, not the full object
          await new Promise((resolve) => req.session.save(resolve));
          console.log("Updated session for user:", userId);
        }
      } else {
        console.log("No subscription update required for event:", event.type);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      return res.status(400).json({ error: "Webhook handling failed" });
    }
  });

  // New route for creating Stripe Customer Portal session
  app.post("/api/subscription/create-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const session = await createCustomerPortalSession(req.user!.id);
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating portal session:', error);
      const message = error instanceof Error ? error.message : "Failed to create portal session";
      res.status(500).json({
        error: message === "No Stripe customer ID found"
          ? "Please subscribe to a plan first before managing your subscription"
          : "Failed to access subscription management"
      });
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

      const collaborator = await storage.inviteCollaborator(validation.data);

      // TODO: Send invitation email
      // await sendCollaborationInviteEmail(collaborator);

      res.json(collaborator);
    } catch (error) {
      console.error("Invite collaborator error:", error);
      res.status(500).json({ error: "Failed to invite collaborator" });
    }
  });

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
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
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
      
      // Process and save all images
      const imageUrls: string[] = [];
      
      for (const file of req.files) {
        const filename = `custom-section-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const imagePath = path.join(uploadsDir, filename);
        
        await sharp(file.buffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toFile(imagePath);

        imageUrls.push(`/uploads/${filename}`);
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

  app.put("/api/custom-section/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const sectionId = parseInt(req.params.id);
      const { title, content } = req.body;
      
      await storage.updateCustomSection(sectionId, { title, content });
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
      const users = await storage.getAllUsers();
      // SECURITY: Sanitize user data for admin view - exclude passwords, tokens, and sensitive fields
      const sanitizedUsers = users.map(user => sanitizeUser(user));
      res.json(sanitizedUsers);
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

    // Update user in the database to make them an admin
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
    res.sendStatus(200);
  });

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
      const baseUrl = `${protocol}://${host}`;
      
      // Pass all document data to the PDF generator
      const buffer = await generatePDF(doc.analysis, doc.logoUrl || undefined, doc.websiteUrl || undefined, doc.selectedImages ? doc.selectedImages : undefined, userProfile, financialData, documentFinancialFiles, baseUrl, doc.title, customSections, doc.coverImageUrl || undefined, doc.coverImagePosition, doc.id);
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
      const baseUrl = `${req.protocol}://${req.get('host')}`;
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

  // Email sharing endpoint
  app.post("/api/share/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { recipientEmail, shareUrl, documentTitle, customMessage, senderName } = req.body;

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

      const fromName = senderName || sender.name || sender.email;
      const fromEmail = 'noreply@cimshare.com'; // Use verified sender email

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

View the document at: ${shareUrl}

This document contains confidential information. Please do not share this link with unauthorized parties.

Professional CIM Generation Platform`;

      // Send email
      console.log('=== EMAIL SHARE DEBUG ===');
      console.log('Sending email to:', recipientEmail.trim());
      console.log('From:', fromEmail);
      console.log('Reply-to:', sender.email);
      console.log('Subject:', subject);
      
      const emailSent = await sendEmail({
        to: recipientEmail.trim(),
        from: fromEmail,
        subject,
        text: textContent,
        html: htmlContent,
        replyTo: sender.email
      });

      console.log('Email sent result:', emailSent);

      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Email sent successfully" 
        });
      } else {
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

  // Broker contact endpoint with rate limiting
  app.post("/api/share/:shareSlug/contact", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const { viewerName, viewerEmail, viewerPhone, question } = req.body;

      // Input validation
      if (!viewerName?.trim() || !viewerEmail?.trim() || !question?.trim()) {
        return res.status(400).json({ 
          error: "Name, email, and question are required fields" 
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(viewerEmail)) {
        return res.status(400).json({ 
          error: "Please provide a valid email address" 
        });
      }

      // Rate limiting: 2 questions per email per hour
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const userRequests = contactRateLimit.get(viewerEmail) || [];
      
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

      // Get the document owner's profile
      const ownerProfile = await storage.getUser(cimDoc.userId);
      if (!ownerProfile?.email) {
        return res.status(500).json({ error: "Unable to contact document owner" });
      }

      // Send email to the document owner
      const emailSubject = `Question about "${cimDoc.title}" from ${viewerName}`;
      const emailBody = `
You have received a question about your CIM document "${cimDoc.title}".

From: ${viewerName}
Email: ${viewerEmail}
${viewerPhone ? `Phone: ${viewerPhone}` : ''}

Question:
${question}

---
This message was sent through your shared CIM link. You can reply directly to this email to respond to ${viewerName}.

View your CIM: ${req.protocol}://${req.get('host')}/cims/${shareSlug}
      `.trim();

      const emailSent = await sendEmail({
        to: ownerProfile.email,
        from: 'noreply@cimshare.com',
        replyTo: viewerEmail,
        subject: emailSubject,
        text: emailBody
      });

      if (!emailSent) {
        return res.status(500).json({ error: "Failed to send email. Please try again." });
      }

      // Update rate limiting
      recentRequests.push(now);
      contactRateLimit.set(viewerEmail, recentRequests);

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
        message: "Your question has been sent to the broker" 
      });

    } catch (error) {
      console.error("Error sending broker contact email:", error);
      res.status(500).json({ error: "Failed to send message. Please try again later." });
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
        viewCount: doc.shareViewCount
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

      const { isPublic, requireNda, password, expiresAt, customSlug, ndaProtected, ndaTemplateId, ndaRequiresManualApproval } = req.body;
      
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

      const updatedDoc = await storage.updateCimShareSettings(docId, {
        shareEnabled: isPublic,
        shareSlug: shareSlug || undefined,
        customSlug: validatedCustomSlug,
        sharePassword: password,
        shareExpiresAt: expiresAt,
        ndaProtected: ndaProtected !== undefined ? ndaProtected : requireNda,
        ndaTemplateId: ndaTemplateId !== undefined ? ndaTemplateId : doc.ndaTemplateId,
        ndaApprovalRequired: ndaRequiresManualApproval !== undefined ? ndaRequiresManualApproval : doc.ndaApprovalRequired
      });

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
        ndaRequiresManualApproval: updatedDoc.ndaApprovalRequired
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
      
      console.log("Share settings update:", { docId, shareEnabled, shareSlug, customSlug, ndaProtected, ndaTemplateId, userId: req.user!.id });

      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        console.log("Document not found:", docId);
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (doc.userId !== req.user!.id) {
        console.log("Document access denied:", { docUserId: doc.userId, requestUserId: req.user!.id });
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedDoc = await storage.updateCimShareSettings(docId, {
        shareEnabled,
        shareSlug,
        customSlug,
        sharePassword,
        shareExpiresAt,
        ndaProtected,
        ndaTemplateId
      });

      console.log("Share settings updated successfully:", updatedDoc.shareSlug);

      res.json({
        shareEnabled: updatedDoc.shareEnabled,
        shareSlug: updatedDoc.shareSlug,
        viewCount: updatedDoc.shareViewCount,
        ndaProtected: updatedDoc.ndaProtected,
        ndaTemplateId: updatedDoc.ndaTemplateId,
        ndaRequiresManualApproval: updatedDoc.ndaApprovalRequired
      });
    } catch (error: any) {
      console.error("Error updating share settings:", error);
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
      
      // SECURITY: Return only profile-specific fields, excluding sensitive data
      const profileData = {
        name: user.name,
        title: user.title,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        email: user.email
      };
      
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
      const { name, title, phoneNumber, businessName, businessLogo, profilePhoto } = req.body;
      
      // Validate input data
      if (typeof name !== 'string' && name !== undefined ||
          typeof title !== 'string' && title !== undefined ||
          typeof phoneNumber !== 'string' && phoneNumber !== undefined ||
          typeof businessName !== 'string' && businessName !== undefined) {
        clearTimeout(timeout);
        return res.status(400).json({ error: "Invalid input data types" });
      }
      
      // Process images with size limits and better error handling
      let processedBusinessLogo = businessLogo;
      let processedProfilePhoto = profilePhoto;
      
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
          
          // Save as persistent file instead of base64 data
          try {
            const logoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer, 
              `logo_${req.user!.id}_${Date.now()}.png`, 
              'image/png', 
              req.user!.id, 
              'logos'
            );
            processedBusinessLogo = logoMetadata.publicPath; // Use file path instead of base64
            console.log('Business logo saved as file:', logoMetadata.publicPath);
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
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        name,
        title,
        phoneNumber,
        businessName,
        businessLogo: processedBusinessLogo,
        profilePhoto: processedProfilePhoto
      });
      
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

  // Password reset routes
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      const success = await storage.createPasswordResetToken(email, resetToken, expiry);
      
      if (success) {
        // Send password reset email using SendGrid
        const { sendPasswordResetEmail } = await import("./email");
        const emailSent = await sendPasswordResetEmail(email, resetToken);
        
        // Security: Don't log sensitive password reset tokens
        console.log(`Password reset email sent to ${email}: ${emailSent}`);
        
        res.json({ message: "If an account with that email exists, a reset link has been sent." });
      } else {
        // Don't reveal if email exists or not for security
        res.json({ message: "If an account with that email exists, a reset link has been sent." });
      }
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
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

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.clearPasswordResetToken(user.id);
      
      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
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

      // Prepare email content
      let emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Support Request from CIM Share</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>From:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="background-color: white; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h3>Message:</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This message was sent through the CIM Share support form.
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
            
            // Create a unique filename for serving
            const uniqueId = `${Date.now()}_${pageNum}`;
            const serveFileName = `nda_page_${uniqueId}.png`;
            const servePath = path.join('/tmp', serveFileName);
            
            // Copy image to serve directory with unique name and optimization
            fsSync.writeFileSync(servePath, imageBuffer, { flag: 'w' });
            
            pageImages.push({
              pageNumber: pageNum,
              imageUrl: `/api/temp-image/${serveFileName}`,
              width: 800, // Reduced resolution for better performance
              height: Math.round(800 * 1.414) // Approximate A4 ratio
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
      
      // Enhance signatures with access tokens and view count
      const enhancedSignatures = await Promise.all(signatures.map(async (signature) => {
        // Get access token for this signature
        const [accessToken] = await db
          .select()
          .from(ndaAccessTokens)
          .where(eq(ndaAccessTokens.ndaSignatureId, signature.id));
        
        return {
          ...signature,
          accessToken: accessToken?.token || null,
          viewCount: 0 // You can implement view tracking later
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

      // Send approval email to the signer
      await sendApprovalEmail(approvedSignature, doc);

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

      // Send approval emails to all signers
      await Promise.all(
        approvedSignatures.map(signature => sendApprovalEmail(signature, doc))
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

  app.post("/api/share/:shareSlug/sign-nda", async (req, res) => {
    console.log("🚀 NDA SIGNING ENDPOINT HIT!");
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request body:", req.body);
    console.log("Request params:", req.params);
    
    try {
      const { shareSlug } = req.params;
      const { signerName, signerEmail, fieldValues = {} } = req.body;
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
        const geoipModule = await import('geoip-lite');
        const geoipLib = geoipModule.default || geoipModule;
        geo = geoipLib.lookup(signerIpAddress);
        if (geo && geo.city && geo.region && geo.country) {
          signerLocation = `${geo.city}, ${geo.region}, ${geo.country}`;
        } else if (geo && geo.country) {
          signerLocation = `${geo.country}`;
        }
        console.log('Geolocation lookup successful:', geo);
      } catch (geoError: any) {
        console.log('Geolocation lookup failed:', geoError?.message || 'Unknown error');
      }

      console.log("=== NDA SIGNING DEBUG ===");
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
      console.log("NDA protected:", cimDoc.ndaProtected);
      console.log("NDA template ID:", cimDoc.ndaTemplateId);
      
      if (!cimDoc.ndaProtected || !cimDoc.ndaTemplateId) {
        console.log("ERROR: This CIM does not require NDA signing");
        return res.status(400).json({ error: "This CIM does not require NDA signing" });
      }

      // Check if user already signed
      console.log("Checking existing signature for CIM:", cimDoc.id, "Email:", signerEmail);
      const existingSignature = await storage.checkNdaSignature(cimDoc.id, signerEmail);
      console.log("Existing signature found:", !!existingSignature);
      
      if (existingSignature) {
        console.log("User already signed, getting existing access token...");
        
        // Get existing access token for this signature
        const { ndaAccessTokens } = await import('@shared/schema');
        const { and, eq } = await import('drizzle-orm');
        const existingTokens = await db.select().from(ndaAccessTokens)
          .where(and(
            eq(ndaAccessTokens.cimDocumentId, cimDoc.id),
            eq(ndaAccessTokens.signerEmail, signerEmail),
            eq(ndaAccessTokens.isActive, true)
          ));
        
        let accessToken = null;
        if (existingTokens.length > 0) {
          accessToken = existingTokens[0].token;
          console.log("Found existing access token");
        }
        
        // Send access email even for existing signers
        console.log("Sending access email for existing signer...");
        const { owner } = await storage.getCimWithOwner(cimDoc.id);
        const redirectUrl = accessToken ? `${req.protocol}://${req.get('host')}/cims/${shareSlug}?token=${accessToken}` : null;
        
        let emailSent = false;
        if (redirectUrl) {
          try {
            const { sendNdaAccessEmail } = await import('./email');
            emailSent = await sendNdaAccessEmail(
              signerEmail.trim(),
              owner.email,
              owner.name || owner.email,
              cimDoc.title,
              redirectUrl,
              signerName.trim()
            );
            console.log("Access email sent to existing signer:", emailSent);
          } catch (error) {
            console.error("Failed to send access email to existing signer:", error);
          }
        }

        return res.json({ 
          success: true, 
          message: emailSent ? "Check your email for the document access link" : "NDA already signed",
          signature: existingSignature,
          accessToken: accessToken,
          requiresApproval: cimDoc.ndaApprovalRequired || false,
          redirectUrl: redirectUrl
        });
      }

      // Get NDA template
      console.log("Getting NDA templates for user:", cimDoc.userId);
      const templates = await storage.getNdaTemplates(cimDoc.userId);
      console.log("Found templates:", templates.length);
      
      const ndaTemplate = templates.find(t => t.id === cimDoc.ndaTemplateId);
      console.log("Found matching template:", !!ndaTemplate, ndaTemplate?.name);
      
      if (!ndaTemplate) {
        console.log("ERROR: NDA template not found");
        return res.status(400).json({ error: "NDA template not found" });
      }

      // Create signed NDA
      console.log("Creating signed NDA content...");
      const signedAt = new Date();
      
      try {
        // Enhanced signature processing with field values
        let signedNdaContent: string;
        
        if (ndaTemplate.signatureFields && ndaTemplate.signatureFields.length > 0) {
          console.log("Processing signature using enhanced field-based system");
          const processor = await PdfSignatureProcessor.fromBase64(ndaTemplate.fileContent);
          
          // Prepare field values with signature data
          const processedFieldValues = { ...fieldValues };
          
          // Auto-populate standard fields if not provided
          if (!processedFieldValues.name && ndaTemplate.signatureFields.some((f: any) => f.type === 'name')) {
            const nameField = ndaTemplate.signatureFields.find((f: any) => f.type === 'name');
            if (nameField) processedFieldValues[nameField.id] = signerName;
          }
          
          if (!processedFieldValues.email && ndaTemplate.signatureFields.some((f: any) => f.type === 'email')) {
            const emailField = ndaTemplate.signatureFields.find((f: any) => f.type === 'email');
            if (emailField) processedFieldValues[emailField.id] = signerEmail;
          }
          
          // Process date fields
          ndaTemplate.signatureFields.filter((f: any) => f.type === 'date').forEach((field: any) => {
            if (!processedFieldValues[field.id]) {
              processedFieldValues[field.id] = signedAt.toLocaleDateString();
            }
          });
          
          // Embed fields into PDF
          signedNdaContent = await processor.embedFields(ndaTemplate.signatureFields, processedFieldValues);
          
          // Add completion certificate
          await processor.addCompletionCertificate(signerName, signerEmail, signedAt);
          signedNdaContent = await processor.saveAsBase64();
          
        } else {
          console.log("Using legacy signature processing (no signature fields)");
          signedNdaContent = await addSignatureToNda(
            ndaTemplate.fileContent,
            signerName,
            signedAt,
            signerEmail,
            signerIpAddress
          );
        }
        console.log("Signed NDA content created successfully");

        // Save signature record
        console.log("📝 Preparing signature data...");
        console.log("📊 Signed NDA content size:", signedNdaContent.length, "characters");
        
        const signatureData = {
          cimDocumentId: cimDoc.id,
          signerName,
          signerEmail,
          signerIpAddress,
          signerLocation,
          signedNdaContent,
          fieldValues
        };
        
        console.log("🔍 Signature data structure:", {
          cimDocumentId: signatureData.cimDocumentId,
          signerName: signatureData.signerName,
          signerEmail: signatureData.signerEmail,
          signerIpAddress: signatureData.signerIpAddress,
          signerLocation: signatureData.signerLocation,
          contentLength: signatureData.signedNdaContent.length
        });

        console.log("✅ Validating signature data against schema...");
        const validatedData = insertNdaSignatureSchema.parse(signatureData);
        console.log("✅ Signature data validated successfully");

        console.log("💾 Creating signature record in database...");
        const signature = await storage.createNdaSignature(validatedData);
        console.log("✅ Signature created successfully with ID:", signature.id);
        console.log("📊 Database signature record:", {
          id: signature.id,
          cimDocumentId: signature.cimDocumentId,
          signerName: signature.signerName,
          signerEmail: signature.signerEmail
        });

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
        console.log("Creating access token for NDA-signed user...");
        const accessToken = generateSecureToken();
        const ndaAccessToken = await storage.createNdaAccessToken(
          accessToken,
          cimDoc.id,
          signature.id,
          signerEmail
        );
        console.log("Access token created for NDA signature");

        // Create redirect link
        console.log("Creating redirect link...");
        const redirectId = generateRedirectId();
        const redirectLink = await storage.createNdaRedirectLink(
          redirectId,
          ndaAccessToken.id,
          cimDoc.id,
          signerEmail
        );
        console.log("Redirect link created for NDA access");

        // Check if manual approval is required
        if (cimDoc.ndaApprovalRequired) {
          console.log("Manual approval required - not sending immediate access email");
          
          // Send notification to owner about new signature requiring approval
          const ownerNotificationSent = await sendOwnerApprovalNotification(
            owner.email,
            owner.name || owner.email,
            cimDoc.title,
            signerName,
            signerEmail
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
          
          // Prepare owner profile data for email
          const ownerProfileData = {
            name: owner.name || owner.email,
            email: owner.email,
            phone: ownerProfile?.phoneNumber || undefined,
            title: ownerProfile?.title || undefined,
            businessName: ownerProfile?.businessName || undefined,
            profilePhotoUrl: ownerProfile?.profilePhoto || undefined,
            businessLogoUrl: ownerProfile?.businessLogo || undefined
          };

          // Send immediate access email with separate NDA confirmation and CIM link emails
          console.log("Sending separate NDA confirmation and CIM access emails...");
          const redirectUrl = `${req.protocol}://${req.get('host')}/nda/redirect/${redirectId}`;
          
          // Enhanced email validation and logging
          console.log("=== EMAIL SENDING VALIDATION ===");
          console.log("Signer email (final):", signerEmail);
          console.log("Signer name (final):", signerName);
          console.log("Owner email:", owner.email);
          console.log("CIM title:", cimDoc.title);
          console.log("Redirect URL:", redirectUrl);
          console.log("Signed NDA content size:", signedNdaContent?.length || 0);
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
            ownerProfileData
          );

          if (!finalEmailSent) {
            console.error('Failed to send NDA confirmation emails - check email debug logs above');
          } else {
            console.log('All NDA emails sent successfully');
          }

          console.log("NDA signing completed successfully");
          res.json({ 
            success: true, 
            signature,
            requiresApproval: false,
            message: "NDA signed successfully. Check your email for confirmation and CIM access."
          });
        }

      } catch (innerError) {
        console.error('Inner NDA signing error:', innerError);
        throw innerError;
      }

    } catch (error) {
      console.error('NDA signing error:', error);
      console.log("=== END NDA SIGNING DEBUG ===");
      res.status(500).json({ error: "Failed to process NDA signature" });
    }
  });

  // NDA Redirect handler - stable URL that redirects to current token
  app.get("/api/nda/redirect/:redirectId", async (req, res) => {
    try {
      const { redirectId } = req.params;
      
      console.log("=== NDA REDIRECT DEBUG ===");
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
      
      // Track NDA signer view
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      console.log("Tracking NDA signer view for document:", accessToken.cimDocumentId, "Signer:", accessToken.signerEmail);
      await storage.trackDocumentView(accessToken.cimDocumentId, 'nda_signer', {
        ndaAccessTokenId: accessToken.id,
        signerEmail: accessToken.signerEmail,
        ipAddress: clientIp,
        userAgent: userAgent
      });
      
      // Get CIM document
      const cimDoc = await storage.getCimDocument(accessToken.cimDocumentId);
      if (!cimDoc) {
        console.log("ERROR: CIM document not found");
        return res.status(404).json({ error: "Document not found" });
      }
      
      console.log("Redirecting to document with token:", accessToken.token);
      console.log("=== END NDA REDIRECT DEBUG ===");
      
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
      console.log("Validating NDA access token:", token?.substring(0, 10) + "...");
      
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
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileName = `${timestamp}_${randomSuffix}.${file.originalname.split('.').pop()}`;
        const filePath = path.join(uploadedCimsDir, fileName);

        await fs.writeFile(filePath, file.buffer);

        const uploadedFile = await storage.createUploadedFile({
          cimDocumentId: cimId,
          fileName: file.originalname,
          filePath,
          fileSize: file.size,
          mimeType: file.mimetype
        });

        savedFiles.push(uploadedFile);
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
        const fileBuffer = await fs.readFile(file.filePath);
        
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
        res.send(fileBuffer);
      } catch (fsError) {
        console.error("Error reading file:", fsError);
        res.status(404).json({ error: "File not found on disk" });
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
      
      // Delete file from filesystem
      try {
        await fs.unlink(file.filePath);
      } catch (fsError) {
        console.warn("Could not delete file from filesystem:", fsError);
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
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cimId = parseInt(req.params.id);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Check if CIM belongs to user
      const cim = await storage.getCimDocument(cimId);
      if (!cim || cim.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
      const filePath = path.join(financialFilesDir, uniqueFileName);

      // Save file to secure directory
      await fs.writeFile(filePath, file.buffer);

      // Save file record to database
      const [fileRecord] = await db
        .insert(financialFiles)
        .values({
          cimDocumentId: cimId,
          fileName: uniqueFileName,
          originalName: file.originalname,
          filePath,
          fileSize: file.size,
          mimeType: file.mimetype,
          included: true
        })
        .returning();

      res.json(fileRecord);
    } catch (error) {
      console.error('Error uploading financial file:', error);
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

      // Check if file exists on disk
      const fileExists = await fs.access(file.filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      // Set appropriate headers
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType);

      // Stream the file
      const fileStream = await fs.readFile(file.filePath);
      res.send(fileStream);
    } catch (error) {
      console.error('Error downloading financial file:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Update file inclusion status
  app.patch("/api/cim/:id/financial-files/:fileId", async (req, res) => {
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

      // Update file inclusion
      const [updated] = await db
        .update(financialFiles)
        .set({ included: req.body.included })
        .where(eq(financialFiles.id, fileId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating file inclusion:', error);
      res.status(500).json({ error: "Failed to update file inclusion" });
    }
  });

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
        // Delete physical file
        try {
          await fs.unlink(file.filePath);
        } catch (error) {
          console.error('Error deleting physical file:', error);
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
      
      // Get all included files
      const files = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.cimDocumentId, cimId));

      const includedFiles = files.filter(f => f.included);

      if (includedFiles.length === 0) {
        return res.status(404).json({ error: "No files available for download" });
      }

      // For simplicity, we'll zip the files using a basic approach
      // In production, you might want to use a proper ZIP library
      const zip = new JSZip();

      for (const file of includedFiles) {
        try {
          const fileContent = await fs.readFile(file.filePath);
          zip.file(file.originalName, fileContent);
        } catch (error) {
          console.error(`Error reading file ${file.originalName}:`, error);
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
                signerName: sig.signerName
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
          signerName: ndaSignatures.signerName
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
            documentTitle: doc.documentTitle,
            signedAt: doc.signedAt,
            signerName: doc.signerName
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
      
      const [updated] = await db
        .update(investorContacts)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(
          eq(investorContacts.id, contactId),
          eq(investorContacts.userId, req.user.id)
        ))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating investor contact:', error);
      res.status(500).json({ error: "Failed to update contact" });
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

  const httpServer = createServer(app);
  return httpServer;
}
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript, generateFlexibleCimDocument, type FlexibleCimDocument } from "./perplexity";
import { normalizeUrl, extractLogoFromWebsite, captureWebsiteScreenshot, extractWebsiteImages, downloadSelectedImages } from "./website-analyzer";
import { imageManager } from "./image-manager";
import { insertCimDocumentSchema, subscriptionPlans, users, insertNdaTemplateSchema, insertNdaSignatureSchema, financials, financialFiles, insertFinancialsSchema, insertFinancialFileSchema, insertCollaboratorSchema, uploadedFiles, ndaAccessTokens } from "@shared/schema";
import { searchService, versionService, analyticsService } from "./premium-services";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { createSubscriptionSession, handleStripeWebhook, verifyCheckoutSession, createCustomerPortalSession, getPricing } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { generateWordDocument, generatePDF, generateHtml, formatTextContent, createGoogleDoc } from "./document-export";
import { exportToWordPress, formatWordPressContent, fetchBeaverBuilderTemplates } from "./wordpress-export";
import { getGoogleAuthUrl, handleGoogleCallback } from "./google-auth";
import JSZip from 'jszip';
import sharp from 'sharp';
import { sendNdaSignedEmail, sendEmail } from "./email";
import { addSignatureToNda } from "./pdf-utils";
import { generateSecureToken, generateRedirectId } from "./token-utils";

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

// Function to add rounded corners to images using Sharp
async function addRoundedCorners(imageBuffer: Buffer, radius: number = 30): Promise<Buffer> {
  try {
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    // Create rounded rectangle mask
    const roundedCorners = Buffer.from(
      `<svg width="${metadata.width}" height="${metadata.height}">
        <rect x="0" y="0" width="${metadata.width}" height="${metadata.height}" rx="${radius}" ry="${radius}" fill="white"/>
      </svg>`
    );

    // Apply the mask to create rounded corners with transparent background
    const processedImage = await sharp(imageBuffer)
      .png() // Convert to PNG to support transparency
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
  }
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Public share endpoints (must be before authentication setup)
  app.get("/api/share/:shareSlug", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      console.log("Fetching share data for slug:", shareSlug);
      
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      console.log("Found document:", !!cimDoc, cimDoc?.id);
      
      if (!cimDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!cimDoc.shareEnabled) {
        console.log("Sharing disabled for document:", cimDoc.id);
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        console.log("Document expired:", cimDoc.shareExpiresAt);
        return res.status(410).json({ error: "This shared link has expired" });
      }

      // Increment view count
      console.log("Incrementing view count for document:", cimDoc.id);
      await storage.incrementShareViewCount(cimDoc.id);

      // Get NDA template if required
      let ndaUrl = null;
      if (cimDoc.ndaProtected && cimDoc.ndaTemplateId) {
        console.log("Getting NDA template:", cimDoc.ndaTemplateId);
        try {
          const ndaTemplate = await storage.getNdaTemplate(cimDoc.ndaTemplateId);
          if (ndaTemplate?.fileContent) {
            ndaUrl = `/api/nda-templates/${cimDoc.ndaTemplateId}/download`;
          }
        } catch (ndaError) {
          console.log("Error fetching NDA template:", ndaError);
          // Continue without NDA template
        }
      }

      // Get user profile for contact information
      const userProfile = await storage.getUser(cimDoc.userId);
      
      console.log("Sending share data successfully:", {
        websiteUrl: cimDoc.websiteUrl,
        selectedImages: cimDoc.selectedImages,
        logoUrl: cimDoc.logoUrl,
        hasUserProfile: !!userProfile,
        userProfileData: userProfile ? {
          name: userProfile.name,
          title: userProfile.title,
          email: userProfile.email,
          phoneNumber: userProfile.phoneNumber,
          businessName: userProfile.businessName
        } : null
      });
      
      res.json({
        cim: {
          id: cimDoc.id,
          userId: cimDoc.userId,
          title: cimDoc.title,
          analysis: cimDoc.analysis,
          logoUrl: cimDoc.logoUrl,
          websiteUrl: cimDoc.websiteUrl,
          selectedImages: cimDoc.selectedImages,
          shareEnabled: cimDoc.shareEnabled,
          shareSlug: cimDoc.shareSlug,
          sharePassword: cimDoc.sharePassword,
          shareExpiresAt: cimDoc.shareExpiresAt ? cimDoc.shareExpiresAt.toISOString() : null,
          shareViewCount: cimDoc.shareViewCount,
          ndaProtected: cimDoc.ndaProtected,
          ndaTemplateId: cimDoc.ndaTemplateId,
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
          updatedAt: cimDoc.updatedAt ? cimDoc.updatedAt.toISOString() : null,
          userProfile: userProfile ? {
            name: userProfile.name,
            title: userProfile.title,
            email: userProfile.email,
            phoneNumber: userProfile.phoneNumber,
            businessName: userProfile.businessName,
            businessLogo: userProfile.businessLogo,
            profilePhoto: userProfile.profilePhoto
          } : null
        },
        websiteUrl: cimDoc.websiteUrl || '',
        selectedImages: cimDoc.selectedImages || [],
        logoUrl: cimDoc.logoUrl || null,
        userProfileData: userProfile ? {
          name: userProfile.name,
          title: userProfile.title,
          email: userProfile.email,
          phoneNumber: userProfile.phoneNumber,
          businessName: userProfile.businessName,
          businessLogo: userProfile.businessLogo,
          profilePhoto: userProfile.profilePhoto
        } : null,
        requiresNda: cimDoc.ndaProtected || false,
        ndaUrl
      });
    } catch (error) {
      console.error("Error fetching share data:", error);
      res.status(500).json({ error: "Failed to fetch shared document" });
    }
  });

  // Shared document export endpoints - PDF
  app.post("/api/share/:shareSlug/export/pdf", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      console.log("Shared PDF export request for slug:", shareSlug);
      
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      console.log("Found document for PDF export:", cimDoc ? cimDoc.id : 'null');
      
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

      // Get financial files for the document
      const documentFinancialFiles = await db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, cimDoc.id));

      console.log("Generating PDF with full context:", {
        logoUrl: cimDoc.logoUrl,
        selectedImages: cimDoc.selectedImages?.length || 0,
        websiteUrl: cimDoc.websiteUrl,
        hasUserProfile: !!userProfile,
        financialData: financialData.enabled,
        financialFilesCount: documentFinancialFiles?.length || 0
      });

      // Get custom sections for the shared document
      const customSections = await storage.getCustomSections(cimDoc.id);

      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || 'cimshare.com';
      const baseUrl = `${protocol}://${host}`;

      console.log("About to call generatePDF function...");
      console.log("Parameters being passed to generatePDF:");
      console.log("- analysis:", !!cimDoc.analysis ? "present" : "missing");
      console.log("- logoUrl:", cimDoc.logoUrl);
      console.log("- websiteUrl:", cimDoc.websiteUrl);
      console.log("- selectedImages:", cimDoc.selectedImages);
      console.log("- userProfile:", JSON.stringify(userProfile, null, 2));
      console.log("- financialData:", JSON.stringify(financialData, null, 2));
      console.log("- customSections:", JSON.stringify(customSections, null, 2));
      
      const pdfBuffer = await generatePDF(
        cimDoc.analysis,
        cimDoc.logoUrl,
        cimDoc.websiteUrl,
        cimDoc.selectedImages,
        userProfile,
        financialData,
        documentFinancialFiles,
        baseUrl,
        cimDoc.title,
        customSections
      );
      
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
        cimDoc.logoUrl,
        cimDoc.websiteUrl,
        cimDoc.selectedImages,
        userProfile,
        financialData
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="cim-${cimDoc.id}.docx"`);
      res.send(wordBuffer);
      
    } catch (error) {
      console.error("Shared Word export error:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });



  setupAuth(app);

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

  // API endpoint to fetch dynamic pricing from Stripe
  app.get("/api/pricing", async (req, res) => {
    try {
      console.log("=== PRICING DEBUG ===");
      console.log("Standard Price ID:", process.env.STRIPE_PRICE_ID_STANDARD);
      console.log("Premium Price ID:", process.env.STRIPE_PRICE_ID_PREMIUM);
      
      const [standardPrice, premiumPrice] = await Promise.all([
        stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_STANDARD!),
        stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_PREMIUM!)
      ]);

      console.log("Standard Price from Stripe:", {
        id: standardPrice.id,
        unit_amount: standardPrice.unit_amount,
        currency: standardPrice.currency,
        amount_display: standardPrice.unit_amount! / 100
      });
      
      console.log("Premium Price from Stripe:", {
        id: premiumPrice.id,
        unit_amount: premiumPrice.unit_amount,
        currency: premiumPrice.currency,
        amount_display: premiumPrice.unit_amount! / 100
      });

      const response = {
        standard: {
          amount: standardPrice.unit_amount! / 100, // Convert from cents
          currency: standardPrice.currency,
          priceId: standardPrice.id
        },
        premium: {
          amount: premiumPrice.unit_amount! / 100, // Convert from cents
          currency: premiumPrice.currency,
          priceId: premiumPrice.id
        }
      };
      
      console.log("Response being sent:", response);
      res.json(response);
    } catch (error) {
      console.error("=== DETAILED STRIPE ERROR ===");
      console.error("Error fetching Stripe prices:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Environment variables check:");
      console.error("STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
      console.error("STRIPE_PRICE_ID_STANDARD:", process.env.STRIPE_PRICE_ID_STANDARD);
      console.error("STRIPE_PRICE_ID_PREMIUM:", process.env.STRIPE_PRICE_ID_PREMIUM);
      res.status(500).json({ error: "Failed to fetch pricing", details: error.message });
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const authUrl = getGoogleAuthUrl();
    res.json({ url: authUrl });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { code } = req.query;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Invalid authorization code" });
    }

    try {
      const success = await handleGoogleCallback(code as string, req.user!.id);
      if (success) {
        res.redirect("/");
      } else {
        res.status(500).json({ error: "Failed to authenticate with Google" });
      }
    } catch (error) {
      console.error("Google OAuth error:", error);
      res.status(500).json({ error: "Failed to authenticate with Google" });
    }
  });

  app.get("/api/user/google-status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user!.id);
    res.json({ 
      connected: Boolean(user?.googleAccessToken),
      tokenExpiry: user?.googleTokenExpiry
    });
  });


  // CIM Document Routes with file upload support
  app.post("/api/cim", async (req, res) => {
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
      const docId = req.body.docId; // For regeneration
      const customizations = req.body.customizations || {};
      
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

        // Check regeneration limit
        const plan = subscriptionPlans[req.user!.subscriptionStatus as keyof typeof subscriptionPlans];
        if (existingDoc.regenerationCount >= plan.regenerationLimit) {
          return res.status(403).json({ error: "Regeneration limit reached" });
        }

        // Generate flexible CIM with new directions and customizations
        const purpose = req.body.purpose || 'business_overview';
        const tone = req.body.tone || 'professional';
        const audience = req.body.audience || 'investors';
        
        let analysis = await generateFlexibleCimDocument(
          data.transcript,
          data.directions,
          purpose,
          tone,
          audience,
          req.body.financials,
          null // websiteData - will add later if needed
        );
        
        // If website URL is provided, enhance the analysis with website data
        if (data.websiteUrl) {
          try {
            // Normalize and validate the URL
            const normalizedUrl = normalizeUrl(data.websiteUrl);
            
            // First, capture a screenshot of the website
            let websiteScreenshotUrl = null;
            try {
              console.log("Capturing website screenshot...");
              websiteScreenshotUrl = await captureWebsiteScreenshot(normalizedUrl);
              console.log("Website screenshot captured:", websiteScreenshotUrl);
            } catch (screenshotError) {
              console.error("Website screenshot error:", screenshotError);
              // Continue even if screenshot fails
            }
            
            // Analyze the website
            // Website analysis disabled to fix selected images
            console.log("Website analysis disabled - using transcript data only");
            
            // Add website screenshot URL to be saved with the document
            existingDoc.websiteScreenshotUrl = websiteScreenshotUrl;
          } catch (error) {
            console.error("Website analysis error:", error);
            // Continue with just the transcript analysis, but log the error
          }
        }
        
        const updatedDoc = await storage.updateCimDocument(docId, {
          ...existingDoc,
          directions: data.directions,
          analysis,
          regenerationCount: existingDoc.regenerationCount + 1
        });

        return res.json(updatedDoc);
      }

      // New document generation using flexible CIM system
      const purpose = req.body.purpose || 'business_overview';
      const tone = req.body.tone || 'professional';
      const audience = req.body.audience || 'investors';
      
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
        req.body.financials,
        null // websiteData - will add later if needed
      );
      
      console.log("=== FLEXIBLE CIM ANALYSIS RESULT ===");
      console.log("Analysis type:", typeof analysis);
      console.log("Has sections:", !!analysis.sections);
      console.log("Number of sections:", analysis.sections?.length || 0);
      
      // Handle selected images early in the process for regular route
      let savedImagePaths: string[] = [];
      console.log("Checking for selected images:", {
        hasWebsiteUrl: !!data.websiteUrl,
        hasSelectedImages: !!req.body.selectedImages,
        selectedImagesType: typeof req.body.selectedImages,
        selectedImagesLength: Array.isArray(req.body.selectedImages) ? req.body.selectedImages.length : 'not array'
      });
      
      // Store selectedImages URLs for processing after CIM creation
      let selectedImageUrls: string[] = [];
      if (req.body.selectedImages && Array.isArray(req.body.selectedImages) && req.body.selectedImages.length > 0) {
        selectedImageUrls = req.body.selectedImages;
        console.log(`Will process ${selectedImageUrls.length} selected images after CIM creation`);
      }
      
      // If website URL is provided, enhance the analysis with website data
      let logoUrl = null;
      if (data.websiteUrl) {
        try {
          // Normalize and validate the URL
          const normalizedUrl = normalizeUrl(data.websiteUrl);
          
          // Try to extract logo from the website
          try {
            logoUrl = await extractLogoFromWebsite(normalizedUrl);
            console.log("Extracted logo URL:", logoUrl);
          } catch (logoError) {
            console.error("Logo extraction error:", logoError);
            // Continue without the logo
          }
          
          // Analyze the website
          // Website analysis disabled
          
          // Enhance the CIM with website data
          // Website enhancement disabled
        } catch (error) {
          console.error("Website analysis error:", error);
          // Continue with just the transcript analysis, but log the error
        }
      }
      
      // Extract financial data from request
      const financials = req.body.financials;
      
      // Extract cover image data from request (handling nested object structure)
      const coverImage = req.body.coverImage;
      const coverImageUrl = coverImage?.url || null;
      const coverImagePosition = coverImage?.position ? JSON.stringify(coverImage.position) : null;
      const coverImageAttribution = coverImage?.attribution || null;
      
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
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
        ebitdaIncluded: financials?.ebitdaIncluded || false
      });

      // Process selected images after CIM creation with proper CIM ID
      if (selectedImageUrls.length > 0) {
        try {
          console.log(`Processing ${selectedImageUrls.length} selected images for CIM ${doc.id}...`);
          console.log(`Selected image URLs:`, selectedImageUrls);
          
          const imagePromises = selectedImageUrls.map(async (imageUrl: string, index: number) => {
            try {
              console.log(`Downloading image ${index + 1}/${selectedImageUrls.length}: ${imageUrl}`);
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
          
          console.log(`Download results: ${downloadedImages.length}/${selectedImageUrls.length} images downloaded successfully`);
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
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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
      const metadata = await imageManager.saveUploadedImage(
        req.file.buffer, 
        cimId, 
        req.file.originalname
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

  // File upload endpoint for large text
  app.post("/api/cim/upload", upload.single('transcript'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const transcript = req.file.buffer.toString('utf-8');
      const data = insertCimDocumentSchema.parse({
        ...req.body,
        transcript
      });

      // Debug: Check if selectedImages are present
      console.log("Selected images in request:", req.body.selectedImages);
      
      // Parse customizations from upload form
      const customizations = req.body.customizations ? JSON.parse(req.body.customizations) : {};
      
      // Debug financial data in upload endpoint
      console.log("=== UPLOAD ENDPOINT FINANCIAL DEBUG ===");
      console.log("Raw financials from form:", req.body.financials);
      if (req.body.financials) {
        const parsedFinancials = JSON.parse(req.body.financials);
        console.log("Parsed financials:", parsedFinancials);
      }
      console.log("Customizations from upload:", customizations);

      console.log("Custom directions provided:", data.directions ? "Yes" : "No");
      if (data.directions) {
        console.log("Custom directions content:", data.directions);
      }
      
      // Use flexible CIM system for upload route as well
      const purpose = req.body.purpose || 'business_overview';
      const tone = req.body.tone || 'professional';
      const audience = req.body.audience || 'investors';
      
      let analysis = await generateFlexibleCimDocument(
        transcript,
        data.directions,
        purpose,
        tone,
        audience,
        req.body.financials ? JSON.parse(req.body.financials) : undefined,
        null
      );
      
      // Handle selected images early in the process - always download if provided
      let savedImagePaths: string[] = [];
      if (req.body.selectedImages) {
        try {
          const selectedImages = JSON.parse(req.body.selectedImages);
          if (Array.isArray(selectedImages) && selectedImages.length > 0) {
            const normalizedUrl = data.websiteUrl ? normalizeUrl(data.websiteUrl) : 'unknown-source';
            console.log(`Processing ${selectedImages.length} selected images...`);
            savedImagePaths = await downloadSelectedImages(selectedImages, normalizedUrl);
            console.log(`Successfully downloaded ${savedImagePaths.length} selected images`);
            
            // Add selected images to the analysis object so they show in the CIM
            analysis.selectedImages = savedImagePaths;
          }
        } catch (imageError) {
          console.error("Selected images processing error:", imageError);
        }
      }
      
      // If website URL is provided, enhance the analysis with website data
      let logoUrl = null;
      if (data.websiteUrl) {
        try {
          // Normalize and validate the URL
          const normalizedUrl = normalizeUrl(data.websiteUrl);
          
          // Try to extract logo from the website
          try {
            logoUrl = await extractLogoFromWebsite(normalizedUrl);
            console.log("Extracted logo URL:", logoUrl);
          } catch (logoError) {
            console.error("Logo extraction error:", logoError);
            // Continue without the logo
          }
          
          // Analyze the website
          // Website analysis disabled
          
          // Enhance the CIM with website data
          // Website enhancement disabled
        } catch (error) {
          console.error("Website analysis error:", error);
          // Continue with just the transcript analysis, but log the error
        }
      }
      
      // Extract financial data from request
      const financials = req.body.financials ? JSON.parse(req.body.financials) : undefined;
      
      // Extract cover image data from request
      const coverImageUrl = req.body.coverImageUrl || null;
      const coverImagePosition = req.body.coverImagePosition ? JSON.parse(req.body.coverImagePosition) : null;
      const coverImageAttribution = req.body.coverImageAttribution || null;
      
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
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
        ebitdaIncluded: financials?.ebitdaIncluded || false
      });

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
    console.log("Request user:", req.user);
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
    console.log("User ID:", req.user?.id);
    
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { plan, priceId } = req.body;
    console.log("Plan requested:", plan);
    console.log("Fresh price ID received:", priceId);
    
    if (!subscriptionPlans[plan as keyof typeof subscriptionPlans]) {
      console.log("Invalid plan:", plan);
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    try {
      const hostHeader = req.get('host');
      console.log("Creating Stripe session with host:", hostHeader);
      console.log("Using fresh price ID for checkout:", priceId);
      
      const session = await createSubscriptionSession(
        plan as keyof typeof subscriptionPlans,
        req.user!.id,
        hostHeader,
        priceId // Pass the fresh price ID
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
        const { userId, status, endsAt } = result;
        console.log("Updating subscription:", { userId, status, endsAt });

        await storage.updateSubscription(userId, status, endsAt);
        console.log(`Successfully updated subscription for user ${userId} to ${status}`);

        // Force refresh the user's session if they're currently logged in
        const user = await storage.getUser(userId);
        console.log("Retrieved updated user:", {
          id: user?.id,
          subscriptionStatus: user?.subscriptionStatus,
          subscriptionEndsAt: user?.subscriptionEndsAt,
          stripeCustomerId: user?.stripeCustomerId
        });

        if (req.session && req.user?.id === userId) {
          req.session.passport = req.session.passport || {};
          // @ts-ignore - we know the passport property exists now
          req.session.passport.user = user;
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

      // Check if user has paid subscription for collaboration
      const user = await storage.getUser(userId);
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
        return res.status(403).json({ 
          error: "Collaboration features require a paid subscription",
          upgradeRequired: true 
        });
      }

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

      // Check if user has paid subscription
      const user = await storage.getUser(userId);
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
        return res.status(403).json({ 
          error: "Collaboration features require a paid subscription",
          upgradeRequired: true 
        });
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
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
        return res.status(403).json({ 
          error: "Search features require a premium subscription",
          upgradeRequired: true 
        });
      }

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
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
        return res.status(403).json({ 
          error: "Version history requires a premium subscription",
          upgradeRequired: true 
        });
      }

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
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
        return res.status(403).json({ 
          error: "Analytics require a premium subscription",
          upgradeRequired: true 
        });
      }

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

  // Premium Feature: User Analytics Dashboard
  app.get("/api/analytics/dashboard", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || (user.subscriptionStatus === 'free' && !user.isAdmin)) {
        return res.status(403).json({ 
          error: "Analytics dashboard requires a premium subscription",
          upgradeRequired: true 
        });
      }

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
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.sendStatus(401);
    }
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post("/api/admin/subscription", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.sendStatus(401);
    }

    const { userId, status, months } = req.body;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await storage.updateSubscription(userId, status, endsAt);
    res.sendStatus(200);
  });

  app.post("/api/admin/grant-admin", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
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
        return res.status(403).json({ error: "Premium subscription required" });
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
      
      const buffer = await generateWordDocument(doc.analysis, doc.logoUrl, doc.websiteUrl, doc.selectedImages, userProfile, financialData);
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

      const user = await storage.getUser(req.user!.id);
      console.log(`User subscription status: ${user?.subscriptionStatus}, isAdmin: ${user?.isAdmin}`);
      
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
        console.log("Permission error: User does not have premium/admin access");
        return res.status(403).json({ error: "Premium subscription required" });
      }

      console.log("Generating PDF document with complete data...");
      
      // Get user profile for contact footer (reuse the user object from above)
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

      // Get custom sections for the document
      const customSections = await storage.getCustomSections(docId);
      
      // Pass all document data to the PDF generator
      const buffer = await generatePDF(doc.analysis, doc.logoUrl, doc.websiteUrl, doc.selectedImages, userProfile, financialData, [], undefined, doc.title, customSections);
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
      const html = generateHtml(doc.analysis, doc.logoUrl, userProfile, doc.websiteUrl, doc.selectedImages, financialData, financialFilesList, baseUrl);
      
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

  // Modify the existing Google Docs export endpoint to handle OAuth
  app.post("/api/cim/export/gdocs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const doc = await storage.getCimDocument(parseInt(req.params.id));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
        return res.status(403).json({ error: "Premium subscription required" });
      }

      if (!user.googleAccessToken) {
        return res.status(403).json({ 
          error: "Google account not connected",
          needsAuth: true 
        });
      }

      const url = await createGoogleDoc(user.id, doc.title, doc.analysis);
      res.json({ url });
    } catch (error) {
      console.error("Google Docs export error:", error);
      res.status(500).json({ error: "Failed to export to Google Docs" });
    }
  });

  // Rate limiting storage for broker contact emails
  const contactRateLimit = new Map<string, number[]>();

  // Email sharing endpoint
  app.post("/api/share/email", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

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
      const [sender] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!sender) {
        return res.status(404).json({ error: "User not found" });
      }

      const fromName = senderName || sender.name || sender.email;
      const fromEmail = sender.email;

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
      const emailSent = await sendEmail({
        to: recipientEmail.trim(),
        from: fromEmail,
        subject,
        text: textContent,
        html: htmlContent,
        replyTo: fromEmail
      });

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

      const { isPublic, requireNda, password, expiresAt } = req.body;
      
      // Generate share slug if enabling sharing and no slug exists
      let shareSlug = doc.shareSlug;
      if (isPublic && !shareSlug) {
        shareSlug = Math.random().toString(36).substring(2, 15);
      }

      const updatedDoc = await storage.updateCimShareSettings(docId, {
        shareEnabled: isPublic,
        shareSlug: shareSlug,
        sharePassword: password,
        shareExpiresAt: expiresAt,
        ndaProtected: requireNda,
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
      console.error("Error updating share settings:", error);
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
      const { shareEnabled, shareSlug, sharePassword, shareExpiresAt, ndaProtected, ndaTemplateId } = req.body;
      
      console.log("Share settings update:", { docId, shareEnabled, shareSlug, ndaProtected, ndaTemplateId, userId: req.user!.id });

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
        sharePassword,
        shareExpiresAt,
        ndaProtected,
        ndaTemplateId
      });

      console.log("Share settings updated successfully:", updatedDoc.shareSlug);

      res.json({
        shareEnabled: updatedDoc.shareEnabled,
        shareSlug: updatedDoc.shareSlug,
        viewCount: updatedDoc.shareViewCount
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
        return res.status(403).json({ error: "Premium subscription required" });
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
    
    const user = await storage.getUser(req.user!.id);
    res.json({
      name: user?.name,
      title: user?.title,
      phoneNumber: user?.phoneNumber,
      businessName: user?.businessName,
      businessLogo: user?.businessLogo,
      profilePhoto: user?.profilePhoto,
      email: user?.email
    });
  });

  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { name, title, phoneNumber, businessName, businessLogo, profilePhoto } = req.body;
      
      // Process images with rounded corners if they're provided as base64 data URLs
      let processedBusinessLogo = businessLogo;
      let processedProfilePhoto = profilePhoto;
      
      // Process business logo if it's a new upload (starts with data:)
      if (businessLogo && businessLogo.startsWith('data:image/')) {
        try {
          const base64Data = businessLogo.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const roundedImageBuffer = await addRoundedCorners(imageBuffer, 30);
          processedBusinessLogo = `data:image/png;base64,${roundedImageBuffer.toString('base64')}`;
          console.log('Applied rounded corners to business logo');
        } catch (error) {
          console.error('Error processing business logo:', error);
          // Keep original if processing fails
        }
      }
      
      // Process profile photo if it's a new upload (starts with data:)
      if (profilePhoto && profilePhoto.startsWith('data:image/')) {
        try {
          const base64Data = profilePhoto.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const roundedImageBuffer = await addRoundedCorners(imageBuffer, 30);
          processedProfilePhoto = `data:image/png;base64,${roundedImageBuffer.toString('base64')}`;
          console.log('Applied rounded corners to profile photo');
        } catch (error) {
          console.error('Error processing profile photo:', error);
          // Keep original if processing fails
        }
      }
      
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        name,
        title,
        phoneNumber,
        businessName,
        businessLogo: processedBusinessLogo,
        profilePhoto: processedProfilePhoto
      });
      
      res.json({
        name: updatedUser.name,
        title: updatedUser.title,
        phoneNumber: updatedUser.phoneNumber,
        businessName: updatedUser.businessName,
        businessLogo: updatedUser.businessLogo,
        profilePhoto: updatedUser.profilePhoto,
        email: updatedUser.email
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: "Failed to update profile" });
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
        // In a real app, you'd send an email here
        console.log(`Password reset token for ${email}: ${resetToken}`);
        res.json({ message: "If an account with that email exists, a reset link has been sent." });
      } else {
        // Don't reveal if email exists or not for security
        res.json({ message: "If an account with that email exists, a reset link has been sent." });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to process password reset request" });
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
    try {
      const { populateDefaultNDAForAllUsers } = await import("./populate-default-nda");
      const result = await populateDefaultNDAForAllUsers();
      res.json(result);
    } catch (error) {
      console.error('Error populating default NDA templates:', error);
      res.status(500).json({ error: "Failed to populate default NDA templates" });
    }
  });

  // NDA Template routes
  app.get("/api/nda-templates", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const templates = await storage.getNdaTemplates(req.user.id);
      
      // Check if user has a default NDA template, if not and user is standard or premium, create one
      const hasDefault = templates.some(template => template.isDefault);
      if (!hasDefault && (req.user.subscription === 'standard' || req.user.subscription === 'premium' || req.user.subscription === 'pro')) {
        const { populateDefaultNDAForUser } = await import("./populate-default-nda");
        await populateDefaultNDAForUser(req.user.id);
        // Refetch templates after creating default
        const updatedTemplates = await storage.getNdaTemplates(req.user.id);
        return res.json(updatedTemplates);
      }
      
      res.json(templates);
    } catch (error) {
      console.error('Error fetching NDA templates:', error);
      res.status(500).json({ error: "Failed to fetch NDA templates" });
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
      const signatures = await storage.getNdaSignatures(cimId);
      res.json(signatures);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch NDA signatures" });
    }
  });

  app.post("/api/cim/:shareSlug/sign-nda", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const { signerName, signerEmail } = req.body;
      const signerIpAddress = req.ip || req.connection.remoteAddress || 'unknown';

      console.log("=== NDA SIGNING DEBUG ===");
      console.log("Share slug:", shareSlug);
      console.log("Signer name:", signerName);
      console.log("Signer email:", signerEmail);
      console.log("IP address:", signerIpAddress);

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
        console.log("User already signed, returning existing signature");
        return res.json({ 
          success: true, 
          message: "NDA already signed",
          signature: existingSignature 
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
        const signedNdaContent = await addSignatureToNda(
          ndaTemplate.fileContent,
          signerName,
          signedAt,
          signerEmail,
          signerIpAddress
        );
        console.log("Signed NDA content created successfully");

        // Save signature record
        console.log("📝 Preparing signature data...");
        console.log("📊 Signed NDA content size:", signedNdaContent.length, "characters");
        
        const signatureData = {
          cimDocumentId: cimDoc.id,
          signerName,
          signerEmail,
          signerIpAddress,
          signedNdaContent
        };
        
        console.log("🔍 Signature data structure:", {
          cimDocumentId: signatureData.cimDocumentId,
          signerName: signatureData.signerName,
          signerEmail: signatureData.signerEmail,
          signerIpAddress: signatureData.signerIpAddress,
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
            // Update existing contact with latest activity
            await db
              .update(investorContacts)
              .set({
                totalDocumentViews: existingContact.totalDocumentViews + 1,
                lastSeenAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(investorContacts.id, existingContact.id));
            console.log("Updated existing investor contact:", signerEmail);
          } else {
            // Create new contact
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
                tags: []
              });
            console.log("Created new investor contact:", signerEmail);
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
        console.log("Access token created:", ndaAccessToken.id);

        // Create redirect link
        console.log("Creating redirect link...");
        const redirectId = generateRedirectId();
        const redirectLink = await storage.createNdaRedirectLink(
          redirectId,
          ndaAccessToken.id,
          cimDoc.id,
          signerEmail
        );
        console.log("Redirect link created:", redirectLink.id);

        // Send updated email with redirect link instead of direct share link
        console.log("Sending confirmation emails with redirect link...");
        const redirectUrl = `${req.protocol}://${req.get('host')}/nda/redirect/${redirectId}`;
        const finalEmailSent = await sendNdaSignedEmail(
          signerEmail,
          owner.email,
          owner.name || owner.email,
          cimDoc.title,
          redirectUrl,
          signedNdaContent
        );

        if (!finalEmailSent) {
          console.error('Failed to send NDA confirmation emails');
        }

        console.log("NDA signing completed successfully");
        res.json({ 
          success: true, 
          signature,
          accessToken,
          redirectUrl,
          message: "NDA signed successfully. Check your email for confirmation and CIM access."
        });

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
      
      // Update token last accessed
      await storage.updateTokenLastAccessed(accessToken.token);
      
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
      
      const accessToken = await storage.getNdaAccessToken(token);
      if (!accessToken || !accessToken.isActive) {
        return res.status(401).json({ error: "Invalid or expired token", valid: false });
      }
      
      // Update last accessed
      await storage.updateTokenLastAccessed(token);
      
      // Get CIM document
      const cimDoc = await storage.getCimDocument(accessToken.cimDocumentId);
      if (!cimDoc) {
        return res.status(404).json({ error: "Document not found", valid: false });
      }
      
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

  // Financials API routes
  
  // Get financials for a CIM document
  app.get("/api/cim/:id/financials", async (req, res) => {
    try {
      const cimId = parseInt(req.params.id);
      const [result] = await db.select().from(financials).where(eq(financials.cimDocumentId, cimId));
      
      if (!result) {
        // Return default financials structure if none exists
        return res.json({
          enabled: false,
          askingPrice: null,
          askingPriceIncluded: false,
          revenue: null,
          revenueIncluded: false,
          ebitda: null,
          ebitdaIncluded: false
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching financials:', error);
      res.status(500).json({ error: "Failed to fetch financials" });
    }
  });

  // Update or create financials for a CIM document
  app.put("/api/cim/:id/financials", async (req, res) => {
    console.log("=== FINANCIALS PUT REQUEST ===");
    console.log("Request headers:", req.headers);
    console.log("Request user:", req.user);
    console.log("Request body:", req.body);
    console.log("Request params:", req.params);
    
    if (!req.user) {
      console.log("Authentication failed - no user");
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cimId = parseInt(req.params.id);
      console.log("Parsed CIM ID:", cimId);
      
      // Check if CIM belongs to user
      console.log("Fetching CIM document for ID:", cimId);
      const cim = await storage.getCimDocument(cimId);
      console.log("CIM document found:", cim);
      
      if (!cim || cim.userId !== req.user.id) {
        console.log("Authorization failed:", { cim, userId: req.user.id });
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if financials record exists
      console.log("Checking for existing financials record...");
      const [existing] = await db.select().from(financials).where(eq(financials.cimDocumentId, cimId));
      console.log("Existing financials record:", existing);
      
      if (existing) {
        // Update existing record
        console.log("Updating existing financials record...");
        const updateData = { 
          ...req.body, 
          updatedAt: new Date(),
          cimDocumentId: cimId 
        };
        console.log("Update data:", updateData);
        
        const [updated] = await db
          .update(financials)
          .set(updateData)
          .where(eq(financials.cimDocumentId, cimId))
          .returning();
        
        console.log("Updated financials record:", updated);
        res.json(updated);
      } else {
        // Create new record
        console.log("Creating new financials record...");
        const createData = {
          cimDocumentId: cimId,
          ...req.body
        };
        console.log("Create data:", createData);
        
        const [created] = await db
          .insert(financials)
          .values(createData)
          .returning();
        
        console.log("Created financials record:", created);
        res.json(created);
      }
    } catch (error) {
      console.error('Error updating financials - Full error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      res.status(500).json({ error: "Failed to update financials", details: error instanceof Error ? error.message : String(error) });
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
      console.log("Files data:", files);
      
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

    // Check if user has premium access
    if (req.user.subscriptionStatus === 'free') {
      return res.status(403).json({ error: "Premium subscription required" });
    }

    try {
      const { 
        search, 
        status, 
        sortBy = 'lastSeenAt', 
        sortOrder = 'desc',
        page = '1',
        limit = '20'
      } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      
      // Import investorContacts table
      const { investorContacts } = await import('@shared/schema');
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

    if (req.user.subscriptionStatus === 'free') {
      return res.status(403).json({ error: "Premium subscription required" });
    }

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

    if (req.user.subscriptionStatus === 'free') {
      return res.status(403).json({ error: "Premium subscription required" });
    }

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

  // Export investor contacts to CSV
  app.get("/api/investor-contacts/export", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user.subscriptionStatus === 'free') {
      return res.status(403).json({ error: "Premium subscription required" });
    }

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
      
      // Handle file upload if present
      if (req.file) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        const fileName = `${timestamp}_${randomId}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);
        
        // Save the uploaded file
        await fs.writeFile(filePath, req.file.buffer);
        finalCoverImageUrl = `/uploads/${fileName}`;
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
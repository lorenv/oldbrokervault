import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { normalizeUrl, extractLogoFromWebsite, captureWebsiteScreenshot, extractWebsiteImages, downloadSelectedImages } from "./website-analyzer";
import { insertCimDocumentSchema, subscriptionPlans, users, insertNdaTemplateSchema, insertNdaSignatureSchema } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { createSubscriptionSession, handleStripeWebhook, verifyCheckoutSession, createCustomerPortalSession, getPricing } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { generateWordDocument, generatePDF, generateHtml, formatTextContent, createGoogleDoc } from "./document-export";
import { exportToWordPress, formatWordPressContent, fetchBeaverBuilderTemplates } from "./wordpress-export";
import { getGoogleAuthUrl, handleGoogleCallback } from "./google-auth";
import sharp from 'sharp';
import { sendNdaSignedEmail } from "./email";
import { addSignatureToNda } from "./pdf-utils";

// Setup upload directory
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);


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
  setupAuth(app);

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
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Debug: Check EVERYTHING in the request
      console.log("=== CIM REQUEST DEBUG START ===");
      console.log("Request body keys:", Object.keys(req.body));
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      console.log("SelectedImages specifically:", req.body.selectedImages);
      console.log("=== CIM REQUEST DEBUG END ===");
      
      const data = insertCimDocumentSchema.parse(req.body);
      const docId = req.body.docId; // For regeneration
      
      // Debug: Check if selectedImages are present in regular route
      console.log("Selected images in regular route:", req.body.selectedImages);
      console.log("Selected images type:", typeof req.body.selectedImages);

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

        // Analyze with new directions
        let analysis = await analyzeCimTranscript(data.transcript, data.directions);
        
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

      // New document generation
      let analysis = await analyzeCimTranscript(data.transcript, data.directions);
      
      // Handle selected images early in the process for regular route
      let savedImagePaths: string[] = [];
      if (data.websiteUrl && req.body.selectedImages) {
        try {
          const selectedImages = req.body.selectedImages;
          if (Array.isArray(selectedImages) && selectedImages.length > 0) {
            const normalizedUrl = normalizeUrl(data.websiteUrl);
            console.log(`Processing ${selectedImages.length} selected images in regular route...`);
            savedImagePaths = await downloadSelectedImages(selectedImages, normalizedUrl);
            console.log(`Successfully downloaded ${savedImagePaths.length} selected images in regular route`);
            
            // Add selected images to the analysis object so they show in the CIM
            analysis.selectedImages = savedImagePaths;
          }
        } catch (imageError) {
          console.error("Selected images processing error in regular route:", imageError);
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
      
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        websiteUrl: data.websiteUrl,
        logoUrl,
        analysis,
        selectedImages: savedImagePaths,
        regenerationCount: 0
      });

      res.json(doc);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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

      console.log("Custom directions provided:", data.directions ? "Yes" : "No");
      if (data.directions) {
        console.log("Custom directions content:", data.directions);
      }
      let analysis = await analyzeCimTranscript(transcript, data.directions);
      
      // Handle selected images early in the process
      let savedImagePaths: string[] = [];
      if (data.websiteUrl && req.body.selectedImages) {
        try {
          const selectedImages = JSON.parse(req.body.selectedImages);
          if (Array.isArray(selectedImages) && selectedImages.length > 0) {
            const normalizedUrl = normalizeUrl(data.websiteUrl);
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
      
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        websiteUrl: data.websiteUrl,
        logoUrl,
        analysis,
        selectedImages: savedImagePaths,
        regenerationCount: 0
      });

      res.json(doc);
    } catch (error) {
      console.error("File upload error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const docs = await storage.getCimDocuments(req.user!.id);
    res.json(docs);
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
        content: content || '<p>Click to edit text...</p>',
        insertAfterSection: afterSection
      });

      res.json(section);
    } catch (error) {
      console.error("Error creating text section:", error);
      res.status(500).json({ message: "Failed to create text section" });
    }
  });

  app.post("/api/cim/:id/custom-section/image", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cimId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(cimId);
      
      if (!cim || cim.userId !== req.user.id) {
        return res.sendStatus(404);
      }

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { afterSection } = req.body;
      
      // Process and save the image
      const filename = `custom-section-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const imagePath = path.join(uploadsDir, filename);
      
      await sharp(req.file.buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(imagePath);

      const imageUrl = `/uploads/${filename}`;
      
      const section = await storage.createCustomSection({
        cimDocumentId: cimId,
        type: 'image',
        imageUrl,
        insertAfterSection: afterSection
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
      const { content } = req.body;
      
      await storage.updateCustomSection(sectionId, content);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating custom section:", error);
      res.status(500).json({ message: "Failed to update custom section" });
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
      
      const buffer = await generateWordDocument(doc.analysis, doc.logoUrl, doc.websiteUrl, doc.selectedImages, userProfile);
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
      
      // Pass all document data to the PDF generator
      const buffer = await generatePDF(doc.analysis, doc.title, doc.logoUrl, doc.websiteUrl, doc.selectedImages, userProfile);
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
      
      // Include logo URL and user profile
      const html = generateHtml(doc.analysis, doc.logoUrl, userProfile);
      
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

  // Share settings endpoint
  app.post("/api/cim/:id/share", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Share endpoint: User not authenticated");
      return res.sendStatus(401);
    }

    try {
      const docId = parseInt(req.params.id);
      const { shareEnabled, shareSlug, sharePassword, shareExpiresAt } = req.body;
      
      console.log("Share settings update:", { docId, shareEnabled, shareSlug, userId: req.user!.id });

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
        shareExpiresAt
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

  // Public share endpoint - serves shared CIMs
  app.get("/cims/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      console.log("Public share request for slug:", slug);
      
      const doc = await storage.getCimByShareSlug(slug);
      console.log("Document found:", !!doc, doc?.shareEnabled);
      
      if (!doc) {
        console.log("No document found for slug:", slug);
        return res.status(404).send("CIM not found");
      }
      
      if (!doc.shareEnabled) {
        console.log("Sharing disabled for document:", doc.id);
        return res.status(404).send("Sharing is disabled for this CIM");
      }

      // Check expiration
      if (doc.shareExpiresAt && new Date() > doc.shareExpiresAt) {
        console.log("Document expired:", doc.shareExpiresAt);
        return res.status(410).send("This shared link has expired");
      }

      // Increment view count
      await storage.incrementShareViewCount(doc.id);

      // Get user profile for branding
      const user = await storage.getUser(doc.userId);
      
      // Check if password protection is required
      const password = req.query.password as string;
      if (doc.sharePassword && password !== doc.sharePassword) {
        // Return password form HTML
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Protected CIM - ${doc.title}</title>
            <meta name="robots" content="noindex, nofollow">
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px 20px; background: #f8fafc; }
              .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              h1 { margin: 0 0 20px 0; color: #1f2937; }
              input { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; margin: 10px 0; }
              button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; }
              button:hover { background: #2563eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Password Required</h1>
              <p>This CIM is password protected. Please enter the password to continue.</p>
              <form method="get">
                <input type="password" name="password" placeholder="Enter password" required>
                <button type="submit">Access CIM</button>
              </form>
            </div>
          </body>
          </html>
        `);
      }

      // Get the document owner's info
      const docOwner = await storage.getUser(doc.userId);
      
      // Generate the shared CIM page
      const analysis = doc.editedContent || doc.analysis;
      const businessName = doc.title || analysis?.story?.businessSummary || "Business Overview";
      
      const sharedCimHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${businessName} - Confidential Information Memorandum</title>
          <meta name="robots" content="noindex, nofollow">
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 0; padding: 0; background: #ffffff; }
            .header { background: #1f2937; color: white; padding: 20px 0; margin-bottom: 40px; }
            .header-content { max-width: 800px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; gap: 20px; }
            .logo { width: 60px; height: 60px; border-radius: 30px; object-fit: cover; }
            .header-text h1 { margin: 0; font-size: 28px; }
            .header-text p { margin: 5px 0 0 0; opacity: 0.8; }
            .container { max-width: 800px; margin: 0 auto; padding: 0 20px 40px 20px; }
            .section { margin-bottom: 40px; }
            .section h2 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
            .section h3 { color: #374151; margin-top: 25px; margin-bottom: 15px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
            .highlight { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 15px 0; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
            .contact-footer { margin-top: 60px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
            .contact-info { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
            .contact-photo { width: 60px; height: 60px; border-radius: 30px; object-fit: cover; }
            .contact-details h3 { margin: 0; font-size: 18px; color: #1f2937; }
            .contact-details p { margin: 2px 0; color: #6b7280; font-size: 14px; }
            .business-logo { width: 60px; height: 60px; border-radius: 30px; object-fit: contain; margin-left: auto; }
            .footer { margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-content">
              ${doc.logoUrl ? `<img src="${doc.logoUrl}" alt="${businessName}" class="logo">` : (docOwner?.businessLogo ? `<img src="${docOwner.businessLogo}" alt="${businessName}" class="logo">` : '')}
              <div class="header-text">
                <h1>${businessName}</h1>
                <p>Confidential Information Memorandum</p>
              </div>
            </div>
          </div>
          
          <div class="container">
            ${generateHtml(analysis, docOwner?.businessLogo, docOwner)}
            
            ${docOwner ? `
            <div class="contact-footer">
              <div class="contact-info">
                ${docOwner.profilePhoto ? `<img src="${docOwner.profilePhoto}" alt="Profile" class="contact-photo">` : ''}
                <div class="contact-details">
                  <h3>${docOwner.name || docOwner.email}</h3>
                  ${docOwner.title ? `<p>${docOwner.title}</p>` : ''}
                  ${docOwner.businessName ? `<p><strong>${docOwner.businessName}</strong></p>` : ''}
                  ${docOwner.phoneNumber ? `<p>${docOwner.phoneNumber}</p>` : ''}
                  <p>${docOwner.email}</p>
                </div>
                ${docOwner.businessLogo ? `<img src="${docOwner.businessLogo}" alt="Business Logo" class="business-logo">` : ''}
              </div>
            </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>This document contains confidential and proprietary information.</p>
          </div>
        </body>
        </html>
      `;

      res.send(sharedCimHtml);
    } catch (error) {
      console.error("Error serving shared CIM:", error);
      res.status(500).send("Error loading CIM");
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
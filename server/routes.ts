import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { insertCimDocumentSchema, subscriptionPlans, users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { createSubscriptionSession, handleStripeWebhook, verifyCheckoutSession, createCustomerPortalSession } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { generateWordDocument, generatePDF, generateHtml, formatTextContent, createGoogleDoc } from "./document-export";
import { exportToWordPress, formatWordPressContent, fetchBeaverBuilderTemplates } from "./wordpress-export";
import { getGoogleAuthUrl, handleGoogleCallback } from "./google-auth";
// Using our new AI-powered analyzer with no HTML parsing:
import { enhanceCimWithWebsite } from "./ai-website-analyzer";


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

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
      const data = insertCimDocumentSchema.parse(req.body);
      const docId = req.body.docId; // For regeneration

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
        let analysis = await analyzeCimTranscript(data.transcript);

        // If website URL is provided, enhance with website data safely
        if (data.websiteUrl) {
          try {
            console.log(`Starting website enhancement for URL: ${data.websiteUrl}`);
            console.log('ENHANCEMENT DEBUG: Starting website enhancement');
            
            // Add extensive error handling and validation
            try {
              // Make a deep clone of the analysis to avoid mutation issues
              const analysisCopy = JSON.parse(JSON.stringify(analysis));
              console.log('ENHANCEMENT DEBUG: Successfully cloned analysis');
              
              // Use our NEW AI-powered website analyzer that doesn't parse HTML
              console.log('ENHANCEMENT DEBUG: Calling enhanceCimWithWebsite');
              const enhancedAnalysis = await enhanceCimWithWebsite(analysisCopy, data.websiteUrl);
              console.log('ENHANCEMENT DEBUG: enhanceCimWithWebsite completed');
              
              // Verify the enhanced analysis is valid JSON
              try {
                console.log('ENHANCEMENT DEBUG: Validating enhanced analysis JSON');
                const testJson = JSON.stringify(enhancedAnalysis);
                console.log('ENHANCEMENT DEBUG: Enhanced analysis JSON is valid, length:', testJson.length);
                analysis = enhancedAnalysis;
              } catch (jsonError) {
                console.error('ENHANCEMENT DEBUG: JSON serialization error:', jsonError);
                // Keep original analysis
              }
            } catch (enhancementError) {
              console.error('ENHANCEMENT DEBUG: Top-level enhancement error:', enhancementError);
              console.error('ENHANCEMENT DEBUG: Error type:', typeof enhancementError);
              console.error('ENHANCEMENT DEBUG: Error message:', 
                enhancementError instanceof Error ? enhancementError.message : String(enhancementError));
              console.error('ENHANCEMENT DEBUG: Error stack:', 
                enhancementError instanceof Error ? enhancementError.stack : 'No stack available');
              // Continue with original analysis
            }
          } catch (websiteError) {
            console.error("Website enhancement outer error:", websiteError);
            // Continue with original analysis
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
      let analysis = await analyzeCimTranscript(data.transcript);

      // If website URL is provided, enhance with website data safely
      if (data.websiteUrl) {
        try {
          console.log(`Starting website enhancement for URL: ${data.websiteUrl}`);
          console.log('ENHANCEMENT DEBUG: Starting website enhancement (new doc)');
          
          // Add extensive error handling and validation
          try {
            // Make a deep clone of the analysis to avoid mutation issues
            const analysisCopy = JSON.parse(JSON.stringify(analysis));
            console.log('ENHANCEMENT DEBUG: Successfully cloned analysis (new doc)');
            
            // Use our NEW AI-powered website analyzer that doesn't parse HTML
            console.log('ENHANCEMENT DEBUG: Calling enhanceCimWithWebsite (new doc)');
            const enhancedAnalysis = await enhanceCimWithWebsite(analysisCopy, data.websiteUrl);
            console.log('ENHANCEMENT DEBUG: enhanceCimWithWebsite completed (new doc)');
            
            // Verify the enhanced analysis is valid JSON
            try {
              console.log('ENHANCEMENT DEBUG: Validating enhanced analysis JSON (new doc)');
              const testJson = JSON.stringify(enhancedAnalysis);
              console.log('ENHANCEMENT DEBUG: Enhanced analysis JSON is valid, length:', testJson.length);
              analysis = enhancedAnalysis;
            } catch (jsonError) {
              console.error('ENHANCEMENT DEBUG: JSON serialization error (new doc):', jsonError);
              // Keep original analysis
            }
          } catch (enhancementError) {
            console.error('ENHANCEMENT DEBUG: Top-level enhancement error (new doc):', enhancementError);
            console.error('ENHANCEMENT DEBUG: Error type (new doc):', typeof enhancementError);
            console.error('ENHANCEMENT DEBUG: Error message (new doc):', 
              enhancementError instanceof Error ? enhancementError.message : String(enhancementError));
            console.error('ENHANCEMENT DEBUG: Error stack (new doc):', 
              enhancementError instanceof Error ? enhancementError.stack : 'No stack available');
            // Continue with original analysis
          }
        } catch (websiteError) {
          console.error("Website enhancement outer error (new doc):", websiteError);
          // Continue with original analysis
        }
      }

      // Add validation before database storage
      try {
        console.log("Validating final analysis object...");
        const finalJson = JSON.stringify(analysis);
        console.log("Analysis is valid JSON with length:", finalJson.length);
      } catch (validateError) {
        console.error("Final JSON validation error:", validateError);
        return res.status(400).json({ 
          error: "Invalid data structure in analysis. Please try again or omit the website URL.",
          details: validateError instanceof Error ? validateError.message : String(validateError)
        });
      }

      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        analysis,
        regenerationCount: 0
      });

      res.json(doc);
    } catch (error) {
      console.error("CIM creation error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const documents = await storage.getCimDocuments(req.user!.id);
      res.json(documents);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/cim/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.deleteCimDocument(docId);
      res.sendStatus(204);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Document export routes
  app.get("/api/cim/:id/word", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.subscriptionStatus === "free") {
      return res.status(403).json({ error: "Word export requires a paid subscription" });
    }

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Track usage
      await storage.updateUserUsage(user.id);

      // Check if user has reached their limit
      const limitReached = await storage.checkUserLimit(user.id);
      if (limitReached) {
        return res.status(403).json({ error: "Monthly usage limit reached" });
      }

      const buffer = await generateWordDocument(document.analysis);
      const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim/:id/pdf", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.subscriptionStatus === "free") {
      return res.status(403).json({ error: "PDF export requires a paid subscription" });
    }

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Track usage
      await storage.updateUserUsage(user.id);

      // Check if user has reached their limit
      const limitReached = await storage.checkUserLimit(user.id);
      if (limitReached) {
        return res.status(403).json({ error: "Monthly usage limit reached" });
      }

      const buffer = await generatePDF(document.analysis);
      const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim/:id/html", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Track usage
      await storage.updateUserUsage(req.user!.id);

      // Check if user has reached their limit
      const limitReached = await storage.checkUserLimit(req.user!.id);
      if (limitReached) {
        return res.status(403).json({ error: "Monthly usage limit reached" });
      }

      const html = generateHtml(document.analysis);
      res.json({ html });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim/:id/text", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Track usage
      await storage.updateUserUsage(req.user!.id);

      // Check if user has reached their limit
      const limitReached = await storage.checkUserLimit(req.user!.id);
      if (limitReached) {
        return res.status(403).json({ error: "Monthly usage limit reached" });
      }

      const text = formatTextContent(document.analysis);
      res.json({ text });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/cim/:id/google-doc", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.subscriptionStatus !== "premium" && user.subscriptionStatus !== "admin") {
      return res.status(403).json({ error: "Google Docs export requires a premium subscription" });
    }

    if (!user.googleAccessToken) {
      return res.status(403).json({ error: "Google account not connected" });
    }

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Track usage
      await storage.updateUserUsage(user.id);

      // Check if user has reached their limit
      const limitReached = await storage.checkUserLimit(user.id);
      if (limitReached) {
        return res.status(403).json({ error: "Monthly usage limit reached" });
      }

      const docUrl = await createGoogleDoc(user.id, document.title, document.analysis);
      res.json({ url: docUrl });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // WordPress export
  app.post("/api/cim/:id/wordpress", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.subscriptionStatus === "free") {
      return res.status(403).json({ error: "WordPress export requires a paid subscription" });
    }

    try {
      const docId = parseInt(req.params.id);
      const document = await storage.getCimDocument(docId);

      if (!document || document.userId !== user.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Track usage
      await storage.updateUserUsage(user.id);

      // Check if user has reached their limit
      const limitReached = await storage.checkUserLimit(user.id);
      if (limitReached) {
        return res.status(403).json({ error: "Monthly usage limit reached" });
      }

      const { wpUrl, username, password, postId, status, postType, useToolsetFields, customFields } = req.body;

      // Validate required fields
      if (!wpUrl || !username || !password) {
        return res.status(400).json({ error: "WordPress URL, username, and password are required" });
      }

      const result = await exportToWordPress({
        wpUrl,
        username,
        password,
        postId: postId || undefined,
        title: document.title,
        content: useToolsetFields ? '' : formatWordPressContent(document.analysis),
        status: status || 'draft',
        postType: postType || 'listing',
        useToolsetFields: Boolean(useToolsetFields),
        customFields: customFields || {}
      });

      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Endpoint to fetch Beaver Builder templates
  app.post("/api/wordpress/templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { wpUrl, username, password } = req.body;

      // Validate required fields
      if (!wpUrl || !username || !password) {
        return res.status(400).json({ error: "WordPress URL, username, and password are required" });
      }

      const templates = await fetchBeaverBuilderTemplates(wpUrl, username, password);
      res.json({ templates });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Subscription Routes
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ error: "Price ID is required" });
      }

      const sessionUrl = await createSubscriptionSession(
        priceId as keyof typeof subscriptionPlans,
        req.user!.id
      );

      res.json({ url: sessionUrl });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const portalUrl = await createCustomerPortalSession(req.user!.id);
      res.json({ url: portalUrl });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Test endpoint for isolated website analysis
  app.post('/api/test/website-analysis', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      console.log("TEST ENDPOINT: Starting website analysis test for URL:", url);
      
      // Create a minimal analysis object for testing
      const testAnalysis = {
        story: {
          yearStarted: "2020",
          businessIdea: "Test business idea",
          businessModel: "Test business model"
        },
        marketAnalysis: {
          competitors: ["Competitor 1", "Competitor 2"],
          strengths: ["Strength 1", "Strength 2"],
          customerProfile: "Test customer profile"
        }
      };
      
      try {
        console.log("TEST ENDPOINT: Calling enhanceCimWithWebsite");
        const enhancedAnalysis = await enhanceCimWithWebsite(testAnalysis, url);
        console.log("TEST ENDPOINT: Website analysis complete");
        
        // Test if we can serialize the result
        const jsonResult = JSON.stringify(enhancedAnalysis);
        console.log("TEST ENDPOINT: Result serialization successful, length:", jsonResult.length);
        
        res.json({ 
          success: true, 
          message: "Website analysis successful",
          hasWebsiteData: !!enhancedAnalysis.website,
          hasLogo: !!enhancedAnalysis.website?.logo,
          imageCount: enhancedAnalysis.website?.images?.length || 0
        });
      } catch (error) {
        console.error("TEST ENDPOINT: Analysis error:", error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          errorType: typeof error,
          errorStack: error instanceof Error ? error.stack : 'No stack available'
        });
      }
    } catch (outerError) {
      console.error("TEST ENDPOINT: Outer error:", outerError);
      res.status(500).json({ error: "Test endpoint error" });
    }
  });

  app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    let event;

    try {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).send('Webhook signature missing');
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      // Handle the event
      await handleStripeWebhook(event);

      res.status(200).send();
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  app.get("/api/verify-session", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { session_id } = req.query;

      if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ error: "Session ID is required" });
      }

      await verifyCheckoutSession(session_id);

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Admin routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Only admin users can access
    if (req.user!.isAdmin !== true) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/admin/reset-usage/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Only admin users can access
    if (req.user!.isAdmin !== true) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const userId = parseInt(req.params.id);
      await storage.resetMonthlyUsage(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
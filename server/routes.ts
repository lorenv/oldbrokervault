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
        const analysis = await analyzeCimTranscript(data.transcript);
        const updatedDoc = await storage.updateCimDocument(docId, {
          ...existingDoc,
          directions: data.directions,
          analysis,
          regenerationCount: existingDoc.regenerationCount + 1
        });

        return res.json(updatedDoc);
      }

      // New document generation
      const analysis = await analyzeCimTranscript(data.transcript);
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        analysis,
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

      const analysis = await analyzeCimTranscript(transcript);
      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        analysis,
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
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { plan } = req.body;
    if (!subscriptionPlans[plan as keyof typeof subscriptionPlans]) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    try {
      const session = await createSubscriptionSession(
        plan as keyof typeof subscriptionPlans,
        req.user!.id
      );
      res.json({ url: session.url });
    } catch (error) {
      console.error('Stripe session creation error:', error);
      res.status(400).json({ error: "Failed to create checkout session" });
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

      const buffer = await generateWordDocument(doc.analysis);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=cim-${doc.id}.docx`);
      res.send(buffer);
    } catch (error) {
      console.error("Word export error:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  app.post("/api/cim/export/pdf/:id", async (req, res) => {
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

      const buffer = await generatePDF(doc.analysis);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=cim-${doc.id}.pdf`);
      res.send(buffer);
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
      
      const html = generateHtml(doc.analysis);
      
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

  const httpServer = createServer(app);
  return httpServer;
}
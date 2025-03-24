import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { insertCimDocumentSchema, subscriptionPlans } from "@shared/schema";
import { createSubscriptionSession, handleStripeWebhook, verifyCheckoutSession, createCustomerPortalSession } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { generateWordDocument, generatePDF, exportToGoogleDocs, createGoogleDoc, getGoogleAuthUrl, handleGoogleCallback } from "./document-export";


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
        if (req.session.passport?.user === userId) {
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

        if (req.session.passport?.user === userId) {
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

    await storage.db.update(storage.users).set({ isAdmin: true }).where(storage.db.where(storage.users.id, user.id));
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
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium") {
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
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium") {
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

  // Modify the existing Google Docs export endpoint to handle OAuth
  app.post("/api/cim/export/gdocs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const doc = await storage.getCimDocument(parseInt(req.params.id));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium") {
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

  const httpServer = createServer(app);
  return httpServer;
}
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { insertCimDocumentSchema, subscriptionPlans } from "@shared/schema";
import { createSubscriptionSession, handleStripeWebhook } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';

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
  app.post("/api/webhook/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.sendStatus(400);

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      const userId = await handleStripeWebhook(event);
      if (userId) {
        // Update the user's subscription
        const session = event.data.object as Stripe.Checkout.Session;
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const planName = lineItems.data[0]?.price?.id === process.env.STRIPE_PRICE_ID_PREMIUM
          ? 'premium'
          : 'standard';

        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);

        await storage.updateSubscription(userId, planName, endsAt);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(400).json({ error: "Webhook signature verification failed" });
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

  const httpServer = createServer(app);
  return httpServer;
}
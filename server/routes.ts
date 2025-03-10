import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { insertCimDocumentSchema, subscriptionPlans } from "@shared/schema";
import { createSubscriptionSession, handleStripeWebhook } from "./stripe";
import Stripe from "stripe";
import * as express from 'express';
import { sendSupportEmail } from "./email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // CIM Document Routes
  app.post("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertCimDocumentSchema.parse(req.body);

      // If docId is provided, this is a regeneration request
      if (req.body.docId) {
        const doc = await storage.getCimDocument(req.body.docId);
        if (!doc || doc.userId !== req.user!.id) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Check regeneration limits
        const plan = subscriptionPlans[req.user!.subscriptionStatus as keyof typeof subscriptionPlans];
        if (doc.regenerationCount >= plan.regenLimit) {
          return res.status(400).json({ error: "Regeneration limit reached for this document" });
        }

        // Generate new analysis with updated directions
        const analysis = await analyzeCimTranscript(data.transcript, req.body.directions);
        const updatedDoc = await storage.updateCimDocument(doc.id, {
          ...doc,
          directions: req.body.directions,
          analysis,
          regenerationCount: (doc.regenerationCount || 0) + 1
        });

        return res.json(updatedDoc);
      }

      // For new documents
      try {
        const analysis = await analyzeCimTranscript(data.transcript, req.body.directions);
        const doc = await storage.createCimDocument(req.user!.id, {
          ...data,
          directions: req.body.directions,
          analysis,
          regenerationCount: 0
        });

        res.json(doc);
      } catch (analyzeError) {
        console.error("Error analyzing transcript:", analyzeError);
        res.status(400).json({ 
          error: "Failed to analyze transcript. Please try again or contact support.",
          details: analyzeError instanceof Error ? analyzeError.message : String(analyzeError)
        });
      }
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const docs = await storage.getCimDocuments(req.user!.id);
    res.json(docs);
  });

  // Support Route
  app.post("/api/support", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { subject, message } = req.body;
      await sendSupportEmail(
        subject,
        message,
        req.user!.username
      );
      res.sendStatus(200);
    } catch (error) {
      console.error('Support email error:', error);
      res.status(500).json({ error: "Failed to send support message" });
    }
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

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('ERROR: Missing STRIPE_WEBHOOK_SECRET environment variable');
      return res.status(500).json({ error: "Missing Stripe webhook secret configuration" });
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
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

    const { userId, status, months, additionalCims } = req.body;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await storage.updateSubscription(userId, status, endsAt);

    // If additional CIMs are provided, update the user's monthly limit
    if (additionalCims) {
      const user = await storage.getUser(userId);
      if (user) {
        const plan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans];
        const newLimit = plan.limit + additionalCims;
        await storage.updateUserLimit(userId, newLimit);
      }
    }

    res.sendStatus(200);
  });

  const httpServer = createServer(app);
  return httpServer;
}
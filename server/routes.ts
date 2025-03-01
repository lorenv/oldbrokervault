import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { insertCimDocumentSchema, subscriptionPlans } from "@shared/schema";
import { createSubscriptionSession, handleStripeWebhook } from "./stripe";
import type Stripe from "stripe";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // CIM Document Routes
  app.post("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertCimDocumentSchema.parse(req.body);
      const analysis = await analyzeCimTranscript(data.transcript);

      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        analysis,
      });

      res.json(doc);
    } catch (error) {
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
      res.status(400).json({ error: "Failed to create checkout session" });
    }
  });

  // Stripe webhook endpoint
  app.post("/api/webhook/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.sendStatus(400);

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      const userId = await handleStripeWebhook(event as Stripe.Event);
      if (userId) {
        // Update the user's subscription
        const session = event.data.object as Stripe.Checkout.Session;
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const planName = lineItems.data[0]?.description?.toLowerCase().includes('premium') 
          ? 'premium' 
          : 'standard';

        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);

        await storage.updateSubscription(userId, planName, endsAt);
      }

      res.json({ received: true });
    } catch (error) {
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
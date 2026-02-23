import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { subscriptionPlans, users } from "@shared/schema";
import {
  createSubscriptionSessionDirect,
  verifyCheckoutSession,
  createCustomerPortalSession,
  addSubscriptionSeats,
  getSubscriptionQuantity,
} from "../stripe";
import Stripe from "stripe";
import { invalidateUserCache } from "../auth";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function registerSubscriptionRoutes(app: Express) {
  // Public checkout verification (no auth required)
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
          req.user = updatedUser as any;
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
      const { getPriceIdForPlan } = await import('../stripe');
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
}

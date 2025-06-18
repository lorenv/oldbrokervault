import Stripe from "stripe";
import { subscriptionPlans } from "@shared/schema";
import { storage } from "./storage";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Function to get dynamic pricing from Stripe
export async function getPricing() {
  console.log("=== RETRIEVING PRICES FROM STRIPE ===");
  console.log("Standard Price ID:", process.env.STRIPE_PRICE_ID_STANDARD);
  
  try {
    const standardPrice = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_STANDARD!);
    console.log("Standard price retrieved successfully:", {
      id: standardPrice.id,
      active: standardPrice.active,
      unit_amount: standardPrice.unit_amount
    });
    
    return {
      standard: {
        amount: standardPrice.unit_amount! / 100,
        currency: standardPrice.currency,
        priceId: standardPrice.id
      }
    };
  } catch (error) {
    console.error("Failed to retrieve standard price:", error);
    throw error;
  }
}

async function getOrCreateCustomer(userId: number, email: string) {
  const user = await storage.getUser(userId);

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId: userId.toString()
    }
  });

  // Note: Customer ID is stored in Stripe and linked via email
  console.log("Customer created successfully:", customer.id);

  return customer.id;
}

export async function createSubscriptionSession(planId: keyof typeof subscriptionPlans, userId: number, requestHost?: string, freshPriceId?: string) {
  console.log("=== ENVIRONMENT PRICE IDS ===");
  console.log("STRIPE_PRICE_ID_STANDARD:", process.env.STRIPE_PRICE_ID_STANDARD);
  console.log("STRIPE_PRICE_ID_PREMIUM:", process.env.STRIPE_PRICE_ID_PREMIUM);
  
  // Use fresh price ID if provided, otherwise get dynamic pricing data
  let priceId = freshPriceId;
  if (!priceId) {
    const pricing = await getPricing();
    priceId = planId === 'premium' 
      ? pricing.premium.priceId
      : pricing.standard.priceId;
  }

  console.log("=== STRIPE SESSION CREATION START ===");
  console.log("Creating subscription session for user:", userId, "plan:", planId);
  console.log("Fresh price ID from frontend:", freshPriceId);
  console.log("Final price ID being used:", priceId);
  console.log("Request host:", requestHost);

  const user = await storage.getUser(userId);
  const customerId = await getOrCreateCustomer(userId, user.email);

  // Use the actual request host if provided, otherwise fallback to production domain
  const baseUrl = requestHost ? `https://${requestHost}` : `https://cimshare.com`;
  console.log("Using base URL for redirects:", baseUrl);

  try {
    console.log("Creating Stripe checkout session with config:", {
      mode: 'subscription',
      customer: customerId,
      priceId,
      success_url: `${baseUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      userId
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      client_reference_id: userId.toString(),
      subscription_data: {
        metadata: {
          userId: userId.toString(),
        },
      },
    });

    console.log("Successfully created subscription session:", session.id);
    console.log("Session URL:", session.url);
    return session;
  } catch (error) {
    console.error("=== STRIPE CHECKOUT SESSION ERROR ===");
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error code:", (error as any)?.code);
    console.error("Error type from Stripe:", (error as any)?.type);
    console.error("Error param:", (error as any)?.param);
    console.error("Full error object:", error);
    console.error("Configuration used:", {
      mode: 'subscription',
      customer: customerId,
      priceId,
      baseUrl,
      userId
    });
    throw error;
  }
}

export async function createCustomerPortalSession(userId: number) {
  const user = await storage.getUser(userId);

  if (!user?.stripeCustomerId) {
    throw new Error("No Stripe customer ID found");
  }

  return stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `https://${process.env.REPL_SLUG}.replit.dev/account`,
  });
}

export async function verifyCheckoutSession(sessionId: string) {
  try {
    console.log("Verifying session:", sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const userId = parseInt(session.client_reference_id!);
      const priceId = subscription.items.data[0].price.id;
      const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';

      // Important: Both active AND trialing are valid statuses
      if (!['active', 'trialing'].includes(subscription.status)) {
        console.log(`Subscription status ${subscription.status} not valid for upgrade`);
        return null;
      }

      const endsAt = new Date(subscription.current_period_end * 1000);

      console.log("Subscription details:", { 
        userId, 
        status, 
        endsAt, 
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id,
        customer: subscription.customer
      });
      return { userId, status, endsAt };
    }
  } catch (error) {
    console.error('Error verifying checkout session:', error);
  }
  return null;
}

export async function handleStripeWebhook(event: Stripe.Event) {
  try {
    console.log("Processing webhook event:", event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.client_reference_id!);

        console.log("Processing completed checkout session for user:", userId);

        if (!session.subscription) {
          console.log("No subscription found in session");
          return null;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Important: Both active AND trialing are valid statuses for upgrading
        if (!['active', 'trialing'].includes(subscription.status)) {
          console.log(`Subscription status ${subscription.status} not valid for upgrade`);
          return null;
        }

        const priceId = subscription.items.data[0].price.id;
        const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';
        const endsAt = new Date(subscription.current_period_end * 1000);

        console.log("Subscription details:", { 
          userId, 
          status, 
          endsAt, 
          priceId, 
          subscriptionStatus: subscription.status,
          subscriptionId: subscription.id,
          customer: subscription.customer
        });
        return { userId, status, endsAt, subscriptionId: subscription.id };
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseInt(subscription.metadata.userId);

        console.log("Processing subscription event for user:", userId);

        if (!userId) {
          console.error('No userId found in subscription metadata');
          return null;
        }

        // Important: Both active AND trialing are valid statuses
        if (!['active', 'trialing'].includes(subscription.status)) {
          console.log(`Subscription status ${subscription.status} not valid for upgrade`);
          return null;
        }

        const priceId = subscription.items.data[0].price.id;
        const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';
        const endsAt = new Date(subscription.current_period_end * 1000);

        console.log("Updated subscription details:", { 
          userId, 
          status, 
          endsAt, 
          priceId,
          subscriptionStatus: subscription.status,
          subscriptionId: subscription.id,
          customer: subscription.customer
        });
        return { userId, status, endsAt, subscriptionId: subscription.id };
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseInt(subscription.metadata.userId);

        if (!userId) {
          console.error('No userId found in subscription metadata');
          return null;
        }

        console.log("Subscription ended, reverting to free plan:", userId);
        return { userId, status: 'free', endsAt: new Date() };
      }

      default:
        console.log("Unhandled event type:", event.type);
        return null;
    }
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    throw error;
  }
}
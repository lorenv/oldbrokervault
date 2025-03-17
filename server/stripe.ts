import Stripe from "stripe";
import { subscriptionPlans } from "@shared/schema";
import { storage } from "./storage";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function getOrCreateCustomer(userId: number, email: string) {
  const user = await storage.getUser(userId);

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId: userId.toString()
    }
  });

  // Update user with Stripe customer ID
  await storage.updateUser(userId, {
    stripeCustomerId: customer.id
  });

  return customer.id;
}

export async function createSubscriptionSession(planId: keyof typeof subscriptionPlans, userId: number) {
  const priceId = planId === 'premium' 
    ? process.env.STRIPE_PRICE_ID_PREMIUM
    : process.env.STRIPE_PRICE_ID_STANDARD;

  console.log("Creating subscription session for user:", userId, "plan:", planId);

  const user = await storage.getUser(userId);
  const customerId = await getOrCreateCustomer(userId, user.email);

  // Construct absolute URLs for success and cancel
  const baseUrl = `https://${process.env.REPL_SLUG}.replit.dev`;

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
    subscription_data: {
      metadata: {
        userId: userId.toString(),
      },
    },
  });

  console.log("Created subscription session:", session.id);
  return session;
}

export async function createCustomerPortalSession(userId: number) {
  const user = await storage.getUser(userId);

  if (!user.stripeCustomerId) {
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

      // Set end date based on current period end
      const endsAt = new Date(subscription.current_period_end * 1000);

      console.log("Verified session details:", { userId, status, endsAt, subscriptionStatus: subscription.status });
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
        return { userId, status, endsAt };
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'invoice.paid': {
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
        return { userId, status, endsAt };
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
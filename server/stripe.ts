import Stripe from "stripe";
import { subscriptionPlans, users } from "@shared/schema";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { invalidateUserCache } from "./auth";

// Validate required environment variables
function validateStripeConfig() {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY', 
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID_STARTER',
    'STRIPE_PRICE_ID_STANDARD'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('=== STRIPE CONFIGURATION ERROR ===');
    console.error('Missing required environment variables:', missing);
    console.error('Please ensure all Stripe environment variables are configured');
    throw new Error(`Missing Stripe environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ All required Stripe environment variables are configured');
}

// Initialize Stripe with error handling
let stripe: Stripe;
try {
  validateStripeConfig();
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  console.log('✅ Stripe initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error instanceof Error ? error.message : String(error));
  // In development, we might want to continue without Stripe
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Running in development mode without Stripe - payment features will be disabled');
  } else {
    // In production, Stripe is required
    throw error;
  }
}

// Function to get price ID based on plan
export function getPriceIdForPlan(planId: string): string {
  switch (planId) {
    case 'starter':
      return process.env.STRIPE_PRICE_ID_STARTER!;
    case 'standard':
      return process.env.STRIPE_PRICE_ID_STANDARD!;
    default:
      throw new Error(`No price ID configured for plan: ${planId}`);
  }
}

// Function to get dynamic pricing from Stripe
export async function getPricing() {
  if (!stripe) {
    throw new Error('Stripe is not initialized - payment features are unavailable');
  }
  
  console.log("=== RETRIEVING PRICING FROM STRIPE ===");
  console.log("Starter Price ID:", process.env.STRIPE_PRICE_ID_STARTER);
  console.log("Standard Price ID:", process.env.STRIPE_PRICE_ID_STANDARD);
  
  try {
    const [starterPrice, standardPrice] = await Promise.all([
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_STARTER!),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_STANDARD!)
    ]);
    
    console.log("Prices retrieved successfully:", {
      starter: { id: starterPrice.id, active: starterPrice.active, unit_amount: starterPrice.unit_amount },
      standard: { id: standardPrice.id, active: standardPrice.active, unit_amount: standardPrice.unit_amount }
    });
    
    return {
      starter: {
        amount: starterPrice.unit_amount! / 100,
        currency: starterPrice.currency,
        priceId: starterPrice.id
      },
      standard: {
        amount: standardPrice.unit_amount! / 100,
        currency: standardPrice.currency,
        priceId: standardPrice.id
      }
    };
  } catch (error) {
    console.error('Failed to retrieve pricing from Stripe:', error);
    throw new Error('Unable to fetch pricing information');
  }
}

async function getOrCreateCustomer(userId: number, email: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized - cannot create customer');
  }

  try {
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
  } catch (error) {
    console.error('Failed to create or retrieve Stripe customer:', error);
    throw new Error('Unable to process customer information');
  }
}

export async function createSubscriptionSessionDirect(planId: keyof typeof subscriptionPlans, priceId: string, email: string, userId?: number, requestHost?: string) {
  if (!stripe) {
    throw new Error('Stripe is not initialized - cannot create subscription session');
  }

  console.log("=== DIRECT STRIPE SESSION CREATION START ===");
  console.log("Creating subscription session - plan:", planId, "userId:", userId, "email:", email);
  console.log("Price ID:", priceId);
  console.log("Request host:", requestHost);

  // Determine the correct base URL for redirects
  let baseUrl = `https://cimshare.com`; // Default to production domain
  
  // Use request host if it's the production domain
  if (requestHost && requestHost.includes('cimshare.com')) {
    baseUrl = `https://${requestHost}`;
  } 
  // Only use Replit domain for development/testing
  else if (requestHost && requestHost.includes('replit')) {
    baseUrl = `https://${requestHost}`;
    console.log("🔧 Replit development environment: Using Replit domain for testing");
  }
  // Fallback check if no requestHost but we're clearly in Replit dev
  else if (!requestHost && process.env.REPLIT_DOMAINS && process.env.NODE_ENV === 'development') {
    const replitDomain = process.env.REPLIT_DOMAINS.split(',')[0];
    baseUrl = `https://${replitDomain}`;
    console.log("🔧 Replit dev environment detected: Using Replit domain");
  }
  
  console.log("Using base URL for redirects:", baseUrl);
  console.log("Request host provided:", requestHost);

  try {
    const sessionConfig: any = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      customer_email: email,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          email: email,
        },
      },
    };

    // If user is authenticated, add user ID to metadata
    if (userId) {
      sessionConfig.client_reference_id = userId.toString();
      sessionConfig.subscription_data.metadata.userId = userId.toString();
      
      // Try to get existing customer if user is authenticated
      const user = await storage.getUser(userId);
      if (user?.stripeCustomerId) {
        sessionConfig.customer = user.stripeCustomerId;
        delete sessionConfig.customer_email; // Remove email if we have customer ID
      }
    }

    console.log("Creating Stripe checkout session with config:", sessionConfig);

    const session = await stripe.checkout.sessions.create(sessionConfig);

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
      priceId,
      email,
      userId,
      baseUrl
    });
    throw error;
  }
}

export async function createSubscriptionSession(planId: keyof typeof subscriptionPlans, userId: number, requestHost?: string, freshPriceId?: string) {
  console.log("=== ENVIRONMENT PRICE IDS ===");
  console.log("STRIPE_PRICE_ID_STANDARD:", process.env.STRIPE_PRICE_ID_STANDARD);

  
  // Use fresh price ID if provided, otherwise get dynamic pricing data
  let priceId = freshPriceId;
  if (!priceId) {
    const pricing = await getPricing();
    priceId = pricing.standard.priceId;
  }

  console.log("=== STRIPE SESSION CREATION START ===");
  console.log("Creating subscription session for user:", userId, "plan:", planId);
  console.log("Fresh price ID from frontend:", freshPriceId);
  console.log("Final price ID being used:", priceId);
  console.log("Request host:", requestHost);

  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const customerId = await getOrCreateCustomer(userId, user.email);

  // Determine the correct base URL for redirects
  let baseUrl = `https://cimshare.com`; // Default to production domain
  
  // Use request host if it's the production domain
  if (requestHost && requestHost.includes('cimshare.com')) {
    baseUrl = `https://${requestHost}`;
  } 
  // Only use Replit domain for development/testing
  else if (requestHost && requestHost.includes('replit')) {
    baseUrl = `https://${requestHost}`;
    console.log("🔧 Replit development environment: Using Replit domain for testing");
  }
  // Fallback check if no requestHost but we're clearly in Replit dev
  else if (!requestHost && process.env.REPLIT_DOMAINS && process.env.NODE_ENV === 'development') {
    const replitDomain = process.env.REPLIT_DOMAINS.split(',')[0];
    baseUrl = `https://${replitDomain}`;
    console.log("🔧 Replit dev environment detected: Using Replit domain");
  }
  
  console.log("Using base URL for redirects:", baseUrl);
  console.log("Request host provided:", requestHost);

  try {
    console.log("Creating Stripe checkout session with config:", {
      mode: 'subscription',
      customer: customerId,
      priceId,
      success_url: `${baseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
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
      success_url: `${baseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      client_reference_id: userId.toString(),
      allow_promotion_codes: true,
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

  // Use production domain or development domain based on environment
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://cimshare.com' 
    : `https://${process.env.REPL_SLUG}.replit.dev`;

  return stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/account?tab=billing`,
  });
}

export async function verifyCheckoutSession(sessionId: string) {
  try {
    console.log("=== STRIPE SESSION VERIFICATION START ===");
    console.log("Session ID:", sessionId);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Session retrieved:", {
      id: session.id,
      payment_status: session.payment_status,
      subscription: session.subscription,
      client_reference_id: session.client_reference_id,
      customer_email: session.customer_email,
      customer_details: session.customer_details
    });
    
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      console.log("Subscription retrieved:", {
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        customer: subscription.customer,
        items: subscription.items.data[0]?.price?.id
      });
      
      const userId = session.client_reference_id ? parseInt(session.client_reference_id) : null;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const priceId = subscription.items.data[0].price.id;
      const status = 'standard';

      console.log("Parsed session data:", { userId, customerEmail, priceId, status });

      // Important: Both active AND trialing are valid statuses
      if (!['active', 'trialing'].includes(subscription.status)) {
        console.log(`❌ Subscription status ${subscription.status} not valid for upgrade`);
        return null;
      }

      const endsAt = new Date(subscription.current_period_end * 1000);

      // Find the actual user ID if we don't have it from the session
      let actualUserId = userId;
      if (!actualUserId && customerEmail) {
        console.log("Looking up user by email:", customerEmail);
        const user = await storage.getUserByEmail(customerEmail);
        if (user) {
          actualUserId = user.id;
          console.log("Found user by email:", { id: user.id, email: user.email });
        } else {
          console.log("❌ No user found with email:", customerEmail);
        }
      }

      console.log("Final verification result:", { 
        userId: actualUserId, 
        customerEmail,
        status, 
        endsAt, 
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id
      });
      
      if (!actualUserId) {
        console.error('❌ No user ID found for session verification');
        return null;
      }
      
      console.log("=== STRIPE SESSION VERIFICATION SUCCESS ===");
      return { 
        userId: actualUserId, 
        status, 
        endsAt, 
        subscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string
      };
    } else {
      console.log("❌ No subscription found in session");
      return null;
    }
  } catch (error) {
    console.error('❌ Error verifying checkout session:', error);
    return null;
  }
}

export async function handleStripeWebhook(req: any, res: any, stripeInstance: Stripe) {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    const sig = req.headers['stripe-signature'];
    const body = req.body;
    
    console.log('🔐 Verifying Stripe webhook signature...');
    event = stripeInstance.webhooks.constructEvent(body, sig, endpointSecret);
    console.log('✅ Webhook signature verified');
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    const result = await processStripeWebhookEvent(event);
    if (result) {
      console.log('✅ Webhook processed successfully');
      res.status(200).json({ received: true });
    } else {
      console.log('ℹ️ Webhook event not processed (no action required)');
      res.status(200).json({ received: true, message: 'Event not processed' });
    }
  } catch (error) {
    console.error('❌ Error processing webhook event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function processStripeWebhookEvent(event: Stripe.Event) {
  try {
    console.log("Processing webhook event:", event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ? parseInt(session.client_reference_id) : null;
        const customerEmail = session.customer_details?.email || session.customer_email;

        console.log("Processing completed checkout session:", {
          userId,
          customerEmail,
          hasSubscription: !!session.subscription
        });

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
        const status = 'standard';
        const endsAt = new Date(subscription.current_period_end * 1000);

        console.log("Subscription details:", { 
          userId, 
          customerEmail,
          status, 
          endsAt, 
          priceId, 
          subscriptionStatus: subscription.status,
          subscriptionId: subscription.id,
          customer: subscription.customer
        });

        // Handle both authenticated and non-authenticated user subscriptions
        let updatedUser;
        
        if (userId) {
          // Authenticated user - update existing user
          console.log('💾 Updating authenticated user subscription in database...');
          [updatedUser] = await db.update(users)
            .set({
              subscriptionStatus: status,
              subscriptionEndsAt: endsAt,
              subscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string
            })
            .where(eq(users.id, userId))
            .returning();
        } else if (customerEmail) {
          // Non-authenticated user - find user by email and update
          console.log('💾 Finding and updating user by email:', customerEmail);
          [updatedUser] = await db.update(users)
            .set({
              subscriptionStatus: status,
              subscriptionEndsAt: endsAt,
              subscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string
            })
            .where(eq(users.email, customerEmail))
            .returning();
            
          if (!updatedUser) {
            console.error('❌ No user found with email:', customerEmail);
            return null;
          }
        } else {
          console.error('❌ No user ID or email found in session');
          return null;
        }

        if (updatedUser) {
          console.log('✅ User subscription updated successfully:', {
            userId: updatedUser.id,
            email: updatedUser.email,
            subscriptionStatus: updatedUser.subscriptionStatus,
            subscriptionEndsAt: updatedUser.subscriptionEndsAt
          });
          
          // Invalidate user cache to ensure fresh data on next request
          invalidateUserCache(updatedUser.id);
          console.log('✅ User cache invalidated for user:', updatedUser.id);
        } else {
          console.error('❌ Failed to update user subscription - user not found');
        }

        return { userId: updatedUser?.id, status, endsAt, subscriptionId: subscription.id };
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseInt(subscription.metadata.userId);

        console.log("Processing subscription update for user:", userId);
        console.log("Subscription status:", subscription.status);
        console.log("Cancel at period end:", subscription.cancel_at_period_end);

        if (!userId) {
          console.error('No userId found in subscription metadata');
          return null;
        }

        // Handle cancellation scenarios
        if (subscription.cancel_at_period_end && subscription.status === 'active') {
          console.log("Subscription set to cancel at period end - maintaining access until:", new Date(subscription.current_period_end * 1000));
          
          // Update user to show canceled status but maintain access until end date
          const [updatedUser] = await db.update(users)
            .set({
              subscriptionStatus: 'canceled', // Status to indicate pending cancellation
              subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
              subscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string
            })
            .where(eq(users.id, userId))
            .returning();
          
          if (updatedUser) {
            console.log('✅ Updated user with pending cancellation:', {
              userId: updatedUser.id,
              email: updatedUser.email,
              subscriptionStatus: updatedUser.subscriptionStatus,
              subscriptionEndsAt: updatedUser.subscriptionEndsAt
            });
            invalidateUserCache(userId);
            return { userId, status: 'canceled', endsAt: new Date(subscription.current_period_end * 1000), subscriptionId: subscription.id };
          } else {
            console.error('❌ Failed to update user with pending cancellation');
            return null;
          }
        }

        // Check if subscription was reactivated (un-canceled)
        if (!subscription.cancel_at_period_end && subscription.status === 'active') {
          // User has reactivated their subscription before it ended
          const currentUser = await storage.getUser(userId);
          if (currentUser?.subscriptionStatus === 'canceled') {
            console.log("Subscription reactivated - removing cancellation status");
            // Will be handled by the standard active subscription logic below
          }
        }

        // Handle immediate cancellation (subscription status becomes 'canceled')
        if (subscription.status === 'canceled') {
          console.log("Subscription status is canceled - reverting to free plan immediately");
          
          const [updatedUser] = await db.update(users)
            .set({
              subscriptionStatus: 'free',
              subscriptionEndsAt: new Date(),
              subscriptionId: null
            })
            .where(eq(users.id, userId))
            .returning();
          
          if (updatedUser) {
            console.log('✅ User reverted to free plan due to canceled status:', {
              userId: updatedUser.id,
              email: updatedUser.email,
              subscriptionStatus: updatedUser.subscriptionStatus
            });
            invalidateUserCache(userId);
            return { userId, status: 'free', endsAt: new Date() };
          } else {
            console.error('❌ Failed to revert user to free plan after cancellation');
            return null;
          }
        }

        // Important: Both active AND trialing are valid statuses for active subscriptions
        if (!['active', 'trialing'].includes(subscription.status)) {
          console.log(`Subscription status ${subscription.status} not valid for active subscription`);
          return null;
        }

        const priceId = subscription.items.data[0].price.id;
        const status = 'standard';
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

        // CRITICAL: Update user in database
        console.log('💾 Updating user subscription in database...');
        const [updatedUser] = await db.update(users)
          .set({
            subscriptionStatus: status,
            subscriptionEndsAt: endsAt,
            subscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string
          })
          .where(eq(users.id, userId))
          .returning();

        if (updatedUser) {
          console.log('✅ User subscription updated successfully:', {
            userId: updatedUser.id,
            email: updatedUser.email,
            subscriptionStatus: updatedUser.subscriptionStatus,
            subscriptionEndsAt: updatedUser.subscriptionEndsAt
          });
          
          // Invalidate user cache to ensure fresh data on next request
          invalidateUserCache(updatedUser.id);
          console.log('✅ User cache invalidated for user:', updatedUser.id);
        } else {
          console.error('❌ Failed to update user subscription - user not found');
        }

        return { userId, status, endsAt, subscriptionId: subscription.id };
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseInt(subscription.metadata.userId);

        if (!userId) {
          console.error('No userId found in subscription metadata');
          return null;
        }

        console.log("Subscription deleted/ended, reverting to free plan:", userId);
        
        // CRITICAL: Update user in database to free plan
        console.log('💾 Reverting user to free plan in database...');
        const [updatedUser] = await db.update(users)
          .set({
            subscriptionStatus: 'free',
            subscriptionEndsAt: new Date(),
            subscriptionId: null
          })
          .where(eq(users.id, userId))
          .returning();

        if (updatedUser) {
          console.log('✅ User reverted to free plan successfully:', {
            userId: updatedUser.id,
            email: updatedUser.email,
            subscriptionStatus: updatedUser.subscriptionStatus
          });
          
          // Invalidate user cache to ensure fresh data on next request
          invalidateUserCache(updatedUser.id);
          console.log('✅ User cache invalidated for user:', updatedUser.id);
        } else {
          console.error('❌ Failed to revert user to free plan - user not found');
        }
        
        return { userId, status: 'free', endsAt: new Date() };
      }

      case 'customer.subscription.updated': {
        // Handle subscription cancellation through updates
        const subscription = event.data.object as Stripe.Subscription;
        
        // Skip if this isn't a cancellation event
        if (subscription.status !== 'canceled') {
          console.log('Subscription update but not canceled, skipping');
          return null;
        }
        const userId = parseInt(subscription.metadata.userId);

        if (!userId) {
          console.error('No userId found in subscription metadata for cancellation');
          return null;
        }

        console.log("Subscription canceled immediately, reverting to free plan:", userId);
        
        // CRITICAL: Update user in database to free plan immediately
        console.log('💾 Reverting user to free plan due to immediate cancellation...');
        const [updatedUser] = await db.update(users)
          .set({
            subscriptionStatus: 'free',
            subscriptionEndsAt: new Date(),
            subscriptionId: null
          })
          .where(eq(users.id, userId))
          .returning();

        if (updatedUser) {
          console.log('✅ User reverted to free plan after immediate cancellation:', {
            userId: updatedUser.id,
            email: updatedUser.email,
            subscriptionStatus: updatedUser.subscriptionStatus
          });
          
          // Invalidate user cache to ensure fresh data on next request
          invalidateUserCache(updatedUser.id);
          console.log('✅ User cache invalidated for user:', updatedUser.id);
        } else {
          console.error('❌ Failed to revert user to free plan after cancellation - user not found');
        }
        
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
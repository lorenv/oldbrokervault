import Stripe from "stripe";
import { subscriptionPlans } from "@shared/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createSubscriptionSession(planId: keyof typeof subscriptionPlans, userId: number) {
  const priceId = planId === 'premium' 
    ? process.env.STRIPE_PRICE_ID_PREMIUM
    : process.env.STRIPE_PRICE_ID_STANDARD;

  console.log("Creating subscription session for user:", userId, "plan:", planId);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.REPL_SLUG}.repl.co/account?success=true`,
    cancel_url: `${process.env.REPL_SLUG}.repl.co/pricing?canceled=true`,
    client_reference_id: userId.toString(),
    subscription_data: {
      metadata: {
        userId: userId.toString(),
      },
    },
  });

  console.log("Created subscription session:", session.id);
  return session;
}

export async function handleStripeWebhook(event: Stripe.Event) {
  try {
    console.log("Processing webhook event:", event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.client_reference_id!);

        console.log("Processing completed checkout session for user:", userId);

        // Get subscription details to determine the plan
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0].price.id;

        // Set subscription status based on price ID
        const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';

        // Set subscription end date to one month from now
        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);

        console.log("Subscription details:", { userId, status, endsAt, priceId });
        return { userId, status, endsAt };
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'invoice.paid':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseInt(subscription.metadata.userId);

        console.log("Processing subscription event for user:", userId);

        if (!userId) {
          console.error('No userId found in subscription metadata');
          return null;
        }

        // For cancelled/deleted subscriptions, revert to free
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          console.log("Subscription canceled or unpaid, reverting to free plan");
          return { userId, status: 'free', endsAt: new Date() };
        }

        // For active subscriptions, update status based on price
        const priceId = subscription.items.data[0].price.id;
        const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';

        // Set end date based on current period end
        const endsAt = new Date(subscription.current_period_end * 1000);

        console.log("Updated subscription details:", { userId, status, endsAt, priceId });
        return { userId, status, endsAt };
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
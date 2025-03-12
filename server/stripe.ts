import Stripe from "stripe";
import { subscriptionPlans } from "@shared/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createSubscriptionSession(planId: keyof typeof subscriptionPlans, userId: number) {
  const priceId = planId === 'premium' 
    ? process.env.STRIPE_PRICE_ID_PREMIUM
    : process.env.STRIPE_PRICE_ID_STANDARD;

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

  return session;
}

export async function handleStripeWebhook(event: Stripe.Event) {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.client_reference_id!);

        // Get subscription details to determine the plan
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0].price.id;

        // Set subscription status based on price ID
        const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';

        // Set subscription end date to one month from now
        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);

        return { userId, status, endsAt };
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = parseInt(subscription.metadata.userId);

        if (!userId) {
          console.error('No userId found in subscription metadata');
          return null;
        }

        // For cancelled/deleted subscriptions, revert to free
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          return { userId, status: 'free', endsAt: new Date() };
        }

        // For active subscriptions, update status based on price
        const priceId = subscription.items.data[0].price.id;
        const status = priceId === process.env.STRIPE_PRICE_ID_PREMIUM ? 'premium' : 'standard';

        // Set end date based on current period end
        const endsAt = new Date(subscription.current_period_end * 1000);

        return { userId, status, endsAt };
      }
    }
    return null;
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    throw error;
  }
}
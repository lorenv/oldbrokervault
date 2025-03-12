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
    success_url: `${process.env.REPL_SLUG}.repl.co/?success=true`,
    cancel_url: `${process.env.REPL_SLUG}.repl.co/?canceled=true`,
    client_reference_id: userId.toString(),
  });

  return session;
}

export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = parseInt(session.client_reference_id!);
      return userId;
    }
  }
}
import Stripe from "stripe";
import { subscriptionPlans } from "@shared/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Convert plan duration to Stripe's interval
const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;

export async function createSubscriptionSession(planId: keyof typeof subscriptionPlans, userId: number) {
  // Create or get customer
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          product_data: {
            name: `${subscriptionPlans[planId].name} Plan`,
            description: `Up to ${subscriptionPlans[planId].limit} CIMs per month`,
          },
          unit_amount: subscriptionPlans[planId].price * 100, // Stripe expects amounts in cents
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.REPL_SLUG}.repl.co/?success=true&session_id={CHECKOUT_SESSION_ID}`,
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

      // Update user's subscription based on the successful payment
      // This will be implemented in the storage layer
      return userId;
    }
  }
}
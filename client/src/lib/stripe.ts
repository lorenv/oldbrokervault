import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key from backend
let stripePromise: Promise<any> | null = null;

const getStripe = async () => {
  if (!stripePromise) {
    // Fetch the publishable key from the backend
    const response = await fetch('/api/stripe-config');
    const { publishableKey } = await response.json();
    
    if (!publishableKey) {
      throw new Error('Stripe publishable key not found');
    }
    
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export default getStripe;
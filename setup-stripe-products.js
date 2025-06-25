import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  try {
    console.log('Creating CIM Share Standard Plan product and price...');
    
    // Create the product
    const product = await stripe.products.create({
      name: 'CIM Share Standard Plan',
      description: 'Professional CIM generation with advanced features',
      type: 'service'
    });
    
    console.log('Product created:', product.id);
    
    // Create the price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 9900, // $99.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      nickname: 'Standard Monthly'
    });
    
    console.log('Price created:', price.id);
    console.log('\nAdd this to your environment variables:');
    console.log(`STRIPE_PRICE_ID_STANDARD=${price.id}`);
    
    return price.id;
    
  } catch (error) {
    console.error('Error creating Stripe product/price:', error);
    throw error;
  }
}

setupStripeProducts()
  .then((priceId) => {
    console.log('\nStripe setup completed successfully!');
    console.log('Price ID:', priceId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
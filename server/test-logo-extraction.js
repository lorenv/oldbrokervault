/**
 * Test script for website logo extraction
 * This script can be run to test the logo extraction functionality for any website
 */
const { extractLogoFromWebsite, normalizeUrl } = require('./website-analyzer');

// Default test URL if none provided
const TEST_URL = process.argv[2] || 'https://www.example.com';

async function testLogoExtraction() {
  console.log('========================================');
  console.log(`Testing logo extraction for: ${TEST_URL}`);
  console.log('========================================');
  
  try {
    // Normalize the URL
    const normalizedUrl = normalizeUrl(TEST_URL);
    console.log(`Normalized URL: ${normalizedUrl}`);
    
    // Extract the logo
    console.log('Extracting logo...');
    const logoUrl = await extractLogoFromWebsite(normalizedUrl);
    
    if (logoUrl) {
      console.log('\n✅ SUCCESS: Logo extracted successfully!');
      console.log(`Logo URL: ${logoUrl}`);
      
      // Determine if it's a local file or remote URL
      if (logoUrl.startsWith('/')) {
        console.log('Type: Local file (saved in public directory)');
        console.log(`Path: public${logoUrl}`);
      } else {
        console.log('Type: Remote URL');
      }
    } else {
      console.log('\n❌ FAILED: No logo could be extracted');
    }
  } catch (error) {
    console.error('\n❌ ERROR during logo extraction:');
    console.error(error);
  }
  
  console.log('\nTest completed.');
}

// Run the test
testLogoExtraction()
  .then(() => {
    console.log('Exiting...');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
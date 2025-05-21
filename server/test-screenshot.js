/**
 * Test script for website screenshot functionality
 * This script can be run separately to test screenshot capture
 */
const { db } = require('./db');
const { captureWebsiteScreenshot, normalizeUrl } = require('./website-analyzer');
const { cimDocuments } = require('../shared/schema');
const { eq } = require('drizzle-orm');

// Test URL to capture
const TEST_URL = 'https://example.com';

async function testScreenshotCapture() {
  console.log('Starting screenshot capture test...');
  
  try {
    console.log(`Testing screenshot capture for URL: ${TEST_URL}`);
    const screenshot = await captureWebsiteScreenshot(TEST_URL);
    
    if (screenshot) {
      console.log('Screenshot captured successfully!');
      console.log('Screenshot URL:', screenshot);
      return true;
    } else {
      console.log('Screenshot capture failed');
      return false;
    }
  } catch (error) {
    console.error('Error during screenshot test:', error);
    return false;
  }
}

// Update a specific CIM document with a test screenshot
async function updateDocumentWithScreenshot(docId) {
  console.log(`Updating document ${docId} with test screenshot...`);
  
  try {
    // Get the document
    const [doc] = await db.select().from(cimDocuments).where(eq(cimDocuments.id, docId));
    
    if (!doc) {
      console.log(`Document with ID ${docId} not found`);
      return false;
    }
    
    console.log('Document found:', doc.title);
    
    // Use the document's website URL if available, otherwise use test URL
    const websiteUrl = doc.websiteUrl || TEST_URL;
    console.log(`Using website URL: ${websiteUrl}`);
    
    // Capture screenshot
    const screenshot = await captureWebsiteScreenshot(normalizeUrl(websiteUrl));
    
    if (!screenshot) {
      console.log('Failed to capture screenshot');
      return false;
    }
    
    // Update the document with the screenshot URL
    await db.update(cimDocuments)
      .set({ websiteScreenshotUrl: screenshot })
      .where(eq(cimDocuments.id, docId));
    
    console.log(`Document ${docId} updated with screenshot URL: ${screenshot}`);
    return true;
  } catch (error) {
    console.error('Error updating document with screenshot:', error);
    return false;
  }
}

// Run both tests
async function runTests() {
  // First test basic screenshot functionality
  const screenshotResult = await testScreenshotCapture();
  console.log('Basic screenshot test result:', screenshotResult ? 'PASSED' : 'FAILED');
  
  // If we have a document ID as argument, update that document
  const docId = process.argv[2];
  if (docId) {
    const updateResult = await updateDocumentWithScreenshot(parseInt(docId));
    console.log('Document update test result:', updateResult ? 'PASSED' : 'FAILED');
  } else {
    console.log('No document ID provided. To update a document, run with: node test-screenshot.js [document_id]');
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('Tests completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
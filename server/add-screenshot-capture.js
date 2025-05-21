/**
 * A test script to verify website screenshot capturing
 * This will add website screenshots to existing CIM documents that have website URLs
 */
const { db } = require('./db');
const { cimDocuments } = require('../shared/schema');
const { eq } = require('drizzle-orm');
const { captureWebsiteScreenshot, normalizeUrl } = require('./website-analyzer');

async function updateDocumentsWithScreenshots() {
  console.log('Starting to update documents with screenshots...');
  
  try {
    // Get all CIM documents with website URLs but no screenshots
    const docs = await db.query.cimDocuments.findMany({
      where: (fields, { isNotNull, isNull }) => 
        isNotNull(fields.websiteUrl) && isNull(fields.websiteScreenshotUrl)
    });
    
    console.log(`Found ${docs.length} documents that need screenshots`);
    
    for (const doc of docs) {
      try {
        if (!doc.websiteUrl) continue;
        
        console.log(`Processing document ${doc.id} with website: ${doc.websiteUrl}`);
        
        // Normalize URL
        const normalizedUrl = normalizeUrl(doc.websiteUrl);
        
        // Capture screenshot
        console.log(`Capturing screenshot for ${normalizedUrl}`);
        const screenshotUrl = await captureWebsiteScreenshot(normalizedUrl);
        
        if (screenshotUrl) {
          console.log(`Screenshot captured: ${screenshotUrl}`);
          
          // Update the document with the screenshot URL
          await db.update(cimDocuments)
            .set({ websiteScreenshotUrl: screenshotUrl })
            .where(eq(cimDocuments.id, doc.id));
          
          console.log(`Updated document ${doc.id} with screenshot URL`);
        } else {
          console.log(`Failed to capture screenshot for document ${doc.id}`);
        }
      } catch (err) {
        console.error(`Error processing document ${doc.id}:`, err);
      }
    }
    
    console.log('Finished updating documents with screenshots');
  } catch (err) {
    console.error('Script error:', err);
  }
}

// Run the function
updateDocumentsWithScreenshots()
  .then(() => console.log('Script completed'))
  .catch(err => console.error('Script failed:', err));
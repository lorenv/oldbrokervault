const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function captureScreenshot(url) {
  console.log(`Starting test screenshot capture for: ${url}`);
  
  try {
    // Generate a unique filename
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const screenshotFilename = `test-screenshot-${urlHash}.png`;
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
    console.log(`Checking if directory exists: ${screenshotsDir}`);
    
    if (!fs.existsSync(screenshotsDir)) {
      console.log(`Creating directory: ${screenshotsDir}`);
      fs.mkdirSync(screenshotsDir, { recursive: true });
    } else {
      console.log(`Directory already exists`);
    }
    
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    console.log(`Screenshot will be saved at: ${screenshotPath}`);
    
    // Launch puppeteer
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    try {
      // Open page
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1
      });
      
      // Navigate to URL
      console.log(`Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take screenshot
      console.log('Taking screenshot...');
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: 1280,
          height: 720
        }
      });
      
      console.log('Screenshot saved successfully');
      console.log(`Check ${screenshotPath} to verify the image`);
      
      // Check if file exists
      if (fs.existsSync(screenshotPath)) {
        const stats = fs.statSync(screenshotPath);
        console.log(`File size: ${stats.size} bytes`);
        if (stats.size > 0) {
          console.log('Screenshot file exists and has content');
        } else {
          console.log('WARNING: Screenshot file exists but is empty');
        }
      } else {
        console.log('ERROR: Screenshot file was not created');
      }
      
      return screenshotPath;
    } finally {
      await browser.close();
      console.log('Browser closed');
    }
  } catch (error) {
    console.error('Error capturing screenshot:');
    console.error(error);
    return null;
  }
}

// Test with a sample website
captureScreenshot('https://example.com')
  .then(result => {
    console.log('Test completed with result:', result);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
  });
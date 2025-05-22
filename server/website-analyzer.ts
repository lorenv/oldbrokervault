/**
 * Website analyzer utility for CIM generation
 * This module provides functions to analyze a business website and extract relevant information
 * using Perplexity's browsing API to enhance the CIM with website content
 */
import { PERPLEXITY_API_URL } from './perplexity';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Define the Perplexity API response type
interface PerplexityResponse {
  id?: string;
  model?: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }>;
  citations?: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Normalizes and validates a URL for website analysis
 * Performs thorough validation to ensure the URL is legitimate and properly formatted
 * @param urlString Raw URL string input from user
 * @returns Normalized URL with protocol
 * @throws Error with descriptive message if URL is invalid
 */
export function normalizeUrl(urlString: string): string {
  // Basic existence check
  if (!urlString || urlString.trim() === '') {
    throw new Error('URL is required for website analysis');
  }

  // Remove leading/trailing whitespace and convert to lowercase
  urlString = urlString.trim().toLowerCase();
  
  // Remove any markdown-style formatting that might have been copied
  urlString = urlString.replace(/[[\]()]/g, '');
  
  // Handle common URL entry mistakes
  if (urlString.includes(' ')) {
    throw new Error('Website URL cannot contain spaces');
  }

  // Remove multiple forward slashes except after protocol
  urlString = urlString.replace(/([^:])\/+/g, '$1/');
  
  // Remove any 'mailto:' or other protocols that might be prefixed
  urlString = urlString.replace(/^(mailto:|tel:|ftp:)*/i, '');

  // Strip existing protocol to normalize
  urlString = urlString.replace(/^(https?:\/\/)/i, '');
  
  // Remove www. if present since we'll normalize with it
  urlString = urlString.replace(/^www\./i, '');
  
  // Construct final URL with https and www
  urlString = `https://www.${urlString}`;

  try {
    const url = new URL(urlString);
    
    // Ensure hostname part exists and is reasonable
    if (!url.hostname) {
      throw new Error('Missing hostname in URL');
    }
    
    // Validate domain has at least one dot (e.g., example.com)
    if (!url.hostname.includes('.')) {
      throw new Error('Invalid domain format - missing top-level domain (e.g., .com)');
    }
    
    // Check for reasonable domain length
    if (url.hostname.length < 3) {
      throw new Error('Domain name is too short');
    }
    
    // Check for excessively long domains (potential error)
    if (url.hostname.length > 100) {
      throw new Error('Domain name is unusually long - please check for errors');
    }
    
    // Return normalized URL
    return url.toString();
  } catch (error) {
    // Provide more specific error messages based on the error
    if (error instanceof Error) {
      if (error.message.includes('Invalid URL')) {
        throw new Error('Invalid website URL format. Please use format: example.com');
      }
      // Pass through our custom validation errors
      if (error.message.includes('domain') || 
          error.message.includes('hostname') || 
          error.message.includes('spaces')) {
        throw error;
      }
    }
    
    // Generic fallback error
    throw new Error('Invalid website URL format. Please check the URL and try again.');
  }
}

/**
 * Captures a screenshot of the website
 * @param websiteUrl The URL of the website to capture
 * @returns Promise resolving to the local path of the saved screenshot, or null if failed
 */
export async function captureWebsiteScreenshot(websiteUrl: string): Promise<string | null> {
  console.log(`Starting website screenshot capture for: ${websiteUrl}`);
  
  try {
    // Normalize and validate URL
    const normalizedUrl = normalizeUrl(websiteUrl);
    console.log(`Taking screenshot of normalized URL: ${normalizedUrl}`);
    
    // Generate a unique filename based on the URL
    const urlHash = crypto.createHash('md5').update(normalizedUrl).digest('hex');
    const screenshotFilename = `website-screenshot-${urlHash}.png`;
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
    console.log(`Ensuring screenshots directory exists: ${screenshotsDir}`);
    if (!fs.existsSync(screenshotsDir)) {
      console.log(`Creating screenshots directory: ${screenshotsDir}`);
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotsDir, screenshotFilename);
    const publicPath = `/screenshots/${screenshotFilename}`;
    
    console.log(`Screenshot will be saved at: ${screenshotPath}`);
    
    // Check if screenshot already exists - if so, return the path
    if (fs.existsSync(screenshotPath)) {
      console.log(`Screenshot already exists, reusing: ${screenshotPath}`);
      return publicPath;
    }
    
    // Launch puppeteer with explicit options for production environment
    console.log('Launching headless browser...');
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process'
      ],
      // Use Chromium in Replit environment
      executablePath: process.env.CHROME_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
    };
    
    console.log('Browser launch options:', JSON.stringify(launchOptions, null, 2));
    const browser = await puppeteer.launch(launchOptions);
    
    try {
      // Open a new page with timeout
      console.log('Opening browser page...');
      const page = await browser.newPage();
      
      // Set viewport size - wider aspect ratio for a nice rectangular shape
      await page.setViewport({
        width: 1280,
        height: 720, // 16:9 aspect ratio for a standard rectangular shape
        deviceScaleFactor: 1
      });
      
      // Set a reasonable timeout for navigation
      console.log(`Navigating to URL: ${normalizedUrl}`);
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 45000 // 45 second timeout
      });
      
      // Wait for content to load and render
      console.log('Waiting for page to render completely...');
      await page.waitForTimeout(3000);
      
      // Take screenshot with rectangular dimensions
      console.log(`Taking screenshot and saving to: ${screenshotPath}`);
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
      
      // Verify the screenshot was created
      if (fs.existsSync(screenshotPath)) {
        const stats = fs.statSync(screenshotPath);
        console.log(`Screenshot created successfully. File size: ${stats.size} bytes`);
        
        if (stats.size === 0) {
          console.error('Screenshot file exists but is empty, something went wrong');
          return null;
        }
      } else {
        console.error('Screenshot file was not created');
        return null;
      }
      
      console.log('Screenshot captured successfully');
      return publicPath;
    } finally {
      // Always close the browser
      await browser.close();
      console.log('Browser closed');
    }
  } catch (error) {
    console.error('Failed to capture website screenshot:');
    if (error instanceof Error) {
      console.error(`Error type: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    } else {
      console.error('Unknown error type:', error);
    }
    
    // Return null on failure
    return null;
  }
}

/**
 * Extracts a company logo from a website
 * @param websiteUrl The URL of the website to extract the logo from
 * @returns Promise resolving to the URL of the logo image, or null if not found
 */
export async function extractLogoFromWebsite(websiteUrl: string): Promise<string | null> {
  console.log(`Starting enhanced logo extraction for website: ${websiteUrl}`);
  
  try {
    // Normalize and validate URL
    const normalizedUrl = normalizeUrl(websiteUrl);
    console.log(`Using normalized URL: ${normalizedUrl}`);
    
    // Extract the base URL for resolving relative paths
    const urlObj = new URL(normalizedUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    console.log(`Base URL: ${baseUrl}`);
    
    // Generate a unique filename for the logo
    const urlHash = crypto.createHash('md5').update(normalizedUrl).digest('hex');
    const logoFilename = `logo-${urlHash}.png`;
    
    // Create logos directory if it doesn't exist
    const logosDir = path.join(process.cwd(), 'public', 'logos');
    if (!fs.existsSync(logosDir)) {
      console.log(`Creating logos directory: ${logosDir}`);
      fs.mkdirSync(logosDir, { recursive: true });
    }
    
    const logoPath = path.join(logosDir, logoFilename);
    const publicPath = `/logos/${logoFilename}`;
    
    // Check if we've already extracted this logo
    if (fs.existsSync(logoPath)) {
      console.log(`Logo already extracted, reusing: ${logoPath}`);
      return publicPath;
    }
    
    // Launch puppeteer to extract the logo
    console.log('Launching headless browser for logo extraction...');
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process'
      ],
      executablePath: process.env.CHROME_PATH || undefined
    };
    
    console.log('Browser launch options:', JSON.stringify(launchOptions, null, 2));
    const browser = await puppeteer.launch(launchOptions);
    
    try {
      // Open a new page
      console.log('Opening browser page...');
      const page = await browser.newPage();
      
      // Set a reasonable timeout for navigation
      console.log(`Navigating to website: ${normalizedUrl}`);
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000 // 30 second timeout
      });
      
      // Wait for content to load - use setTimeout instead of waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Searching for logo elements on the page...');
      
      // Extract logo using DOM selectors - a more robust approach than regex
      const logoUrl = await page.evaluate(({ baseUrl }) => {
        // Function to convert relative URLs to absolute
        const resolveUrl = (url) => {
          if (url.startsWith('//')) return window.location.protocol + url;
          if (url.startsWith('/')) return baseUrl + url;
          if (!url.startsWith('http')) return baseUrl + '/' + url;
          return url;
        };
        
        // Array of logo selectors in order of preference
        const logoSelectors = [
          // Common logo classes and IDs
          'img.logo', '.logo img', '#logo', '.logo', 'img.brand-logo', '.brand-logo',
          // Header and navigation logos
          'header .logo img', 'header img.logo', 'nav .logo img', '.navbar-brand img',
          // Logo in link
          'a.logo img', 'a.brand img',
          // Alt text containing "logo"
          'img[alt*="logo" i]', 'img[alt*="brand" i]',
          // Common parent containers
          '.site-logo img', '.header-logo img', '.main-header img'
        ];
        
        // Try each selector
        for (const selector of logoSelectors) {
          const logoElement = document.querySelector(selector);
          if (logoElement && logoElement.src) {
            return resolveUrl(logoElement.src);
          }
        }
        
        // If no dedicated logo class/id, try to find logos by filename patterns
        const allImages = Array.from(document.querySelectorAll('img'));
        for (const img of allImages) {
          if (img.src) {
            const src = img.src.toLowerCase();
            if (src.includes('logo') || src.includes('brand') || (img.alt && img.alt.toLowerCase().includes('logo'))) {
              // Found a potential logo by filename or alt text
              return resolveUrl(img.src);
            }
          }
        }
        
        // Try SVG logos directly in the HTML
        const svgLogo = document.querySelector('svg.logo, .logo svg, svg[id*="logo"]');
        if (svgLogo) {
          // For SVG logos, we need to return a marker so we know to take a screenshot of this element
          // We can't directly access the SVG source easily
          return 'SVG_LOGO_FOUND';
        }
        
        // If no logo found in standard elements, try favicon
        const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        if (favicon && favicon.href) {
          return resolveUrl(favicon.href);
        }
        
        // As a last resort, check for default favicon
        return baseUrl + '/favicon.ico';
      }, { baseUrl });
      
      console.log('Logo URL or marker found:', logoUrl);
      
      // Handle special case for inline SVG logos
      if (logoUrl === 'SVG_LOGO_FOUND') {
        console.log('Inline SVG logo detected, taking screenshot of logo element...');
        
        // Try to find and screenshot the logo SVG
        const logoElement = await page.$('svg.logo, .logo svg, svg[id*="logo"], .logo, #logo, header .logo');
        if (logoElement) {
          await logoElement.screenshot({
            path: logoPath,
            omitBackground: true
          });
          
          console.log(`Captured SVG logo screenshot to: ${logoPath}`);
          return publicPath;
        } else {
          console.log('Failed to find SVG logo element for screenshot');
        }
      } else if (logoUrl) {
        // For image-based logos, download the image
        try {
          console.log(`Attempting to download logo from: ${logoUrl}`);
          
          // Use page context to fetch the image to handle cookies & sessions properly
          const imageBuffer = await page.goto(logoUrl, { timeout: 10000 })
            .then(response => {
              if (!response.ok()) throw new Error(`Failed to fetch logo: ${response.status()}`);
              return response.buffer();
            });
          
          // Save the image
          fs.writeFileSync(logoPath, imageBuffer);
          console.log(`Successfully saved logo to: ${logoPath}`);
          
          return publicPath;
        } catch (imgError) {
          console.error('Error downloading logo image:', imgError);
          
          // If fetching directly fails, take screenshot of logo element as fallback
          console.log('Attempting to screenshot logo element as fallback...');
          const logoImgElement = await page.$('img.logo, .logo img, #logo img, header .logo img, .navbar-brand img');
          if (logoImgElement) {
            await logoImgElement.screenshot({
              path: logoPath,
              omitBackground: true
            });
            console.log(`Captured logo element screenshot to: ${logoPath}`);
            return publicPath;
          }
        }
      }
      
      // If we get here, try getting the favicon as a last resort
      try {
        console.log('Attempting to get favicon as fallback...');
        const faviconUrl = await page.evaluate(() => {
          const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
          return favicon ? favicon.href : window.location.origin + '/favicon.ico';
        });
        
        if (faviconUrl) {
          console.log(`Downloading favicon from: ${faviconUrl}`);
          const faviconBuffer = await page.goto(faviconUrl, { timeout: 5000 })
            .then(response => response.ok() ? response.buffer() : null);
          
          if (faviconBuffer) {
            fs.writeFileSync(logoPath, faviconBuffer);
            console.log(`Saved favicon as logo: ${logoPath}`);
            return publicPath;
          }
        }
      } catch (faviconError) {
        console.error('Error getting favicon:', faviconError);
      }
      
      console.log('No logo could be found or extracted');
      return null;
    } finally {
      // Always close the browser
      await browser.close();
      console.log('Browser closed after logo extraction');
    }
  } catch (error) {
    console.error('Error during logo extraction:');
    if (error instanceof Error) {
      console.error(`${error.name}: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
    } else {
      console.error('Unknown error:', error);
    }
    return null;
  }
}

/**
 * Analyzes a website using Perplexity's browsing API
 * This function extracts key information from the website to enhance the CIM
 * @param websiteUrl Normalized website URL
 * @returns Website analysis data
 */
export async function analyzeWebsite(websiteUrl: string): Promise<any> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is required for website analysis');
  }
  
  // Validate URL before proceeding
  if (!websiteUrl || websiteUrl.trim() === '') {
    throw new Error('A valid website URL is required for website analysis');
  }

  try {
    // Analyze with Perplexity's browsing API
    const systemMessage = `
      You are an expert business analyst extracting information from a company website.
      Your task is to gather key business information that would be relevant for a Confidential Information Memorandum (CIM).
      Focus on:
      1. Company overview and history
      2. Products/services offered with descriptions
      3. Team information and company structure
      4. Customer testimonials and case studies
      5. Market positioning and unique selling points
      6. Any information about distribution channels or sales strategies
      7. Technology or proprietary assets mentioned
      8. Company culture and values
      9. Awards, certifications, or other credibility indicators
      10. Locations, facilities, and operational footprint
      
      Organize this information into structured data without making assumptions.
      If certain information is not available, mark those fields as "Not available on website".
      Provide factual, verifiable information only - do not invent details.
    `;

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: `Analyze this business website: ${websiteUrl}. Extract all relevant information for a CIM (Confidential Information Memorandum) and structure it in JSON format.`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 4000,
        search_domain_filter: [],
        return_images: false,
        return_related_questions: false,
        stream: false,
        frequency_penalty: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      // Try to get more detailed error information
      try {
        const errorData = await response.json();
        console.error('Perplexity API error details:', errorData);
        throw new Error(`Website analysis failed with status: ${response.status} - ${errorData.error || 'Unknown error'}`);
      } catch (e) {
        // If we can't parse the error JSON, use the status text
        throw new Error(`Website analysis failed with status: ${response.status} - ${response.statusText}`);
      }
    }

    const result = await response.json() as PerplexityResponse;
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response format from Perplexity API');
    }
    
    if (result.citations) {
      console.log('Website analysis citations:', result.citations);
    }
    
    // Parse the content from the API response
    let websiteData;
    try {
      const content = result.choices[0].message.content;
      if (!content) {
        throw new Error('No content in API response');
      }
      websiteData = JSON.parse(content);
    } catch (error) {
      console.error('Error parsing website analysis JSON:', error);
      throw new Error('Failed to parse website analysis results');
    }
    
    return websiteData;
  } catch (error) {
    console.error('Website analysis error:', error);
    
    // Provide more specific error messages to improve user experience
    if (error instanceof Error) {
      // Check for specific error types to provide better feedback
      if (error.message.includes('fetch')) {
        throw new Error('Unable to connect to the website. Please check the URL and try again.');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('could not be resolved')) {
        throw new Error('Website could not be found. Please check the URL and try again.');
      } else if (error.message.includes('timed out')) {
        throw new Error('Website analysis timed out. The website may be too slow to respond.');
      } else if (error.message.includes('PERPLEXITY_API_KEY')) {
        throw new Error('Website analysis requires API configuration. Please contact support.');
      } else if (error.message.includes('Invalid URL')) {
        throw new Error('The website URL format is invalid. Please enter a valid website address (e.g., example.com).');
      } else if (error.message.includes('status: 429')) {
        throw new Error('Website analysis service is currently busy. Please try again in a few minutes.');
      } else if (error.message.includes('content') || error.message.includes('parse')) {
        throw new Error('Unable to analyze website content. The website may not be compatible with our analyzer.');
      }
    }
    
    // Generic fallback message for other errors
    throw new Error('An error occurred during website analysis. Please try again or use only the transcript.');
  }
}

/**
 * Combines transcript analysis with website analysis to create an enhanced CIM
 * This function prioritizes transcript data but supplements with website data where needed
 * @param transcriptAnalysis Original CIM analysis based on transcript
 * @param websiteAnalysis Website analysis data
 * @returns Enhanced CIM analysis
 */
export function enhanceCimWithWebsiteData(transcriptAnalysis: any, websiteAnalysis: any): any {
  // Validate inputs
  if (!transcriptAnalysis) {
    throw new Error('Transcript analysis is required');
  }
  
  if (!websiteAnalysis) {
    // If website analysis failed but we have transcript analysis, just return transcript analysis
    console.warn('Website analysis data missing, returning transcript analysis only');
    
    // Add a note to the analysis about the website issue
    if (transcriptAnalysis && transcriptAnalysis.story) {
      transcriptAnalysis.story.websiteAnalysisNote = "Website analysis could not be completed. The CIM is based on transcript data only.";
    }
    
    return transcriptAnalysis;
  }
  
  try {
    // Create a deep copy of the transcript analysis to avoid mutations
    const enhancedAnalysis = JSON.parse(JSON.stringify(transcriptAnalysis));
    
    // Ensure all required objects exist
    if (!enhancedAnalysis.story) enhancedAnalysis.story = {};
    if (!enhancedAnalysis.marketAnalysis) enhancedAnalysis.marketAnalysis = {};
    if (!enhancedAnalysis.executiveSummary) enhancedAnalysis.executiveSummary = {};
    if (!enhancedAnalysis.assets) enhancedAnalysis.assets = {};
    if (!enhancedAnalysis.marketing) enhancedAnalysis.marketing = {};
    if (!enhancedAnalysis.team) enhancedAnalysis.team = {};
    
    // Helper function to merge data, prioritizing transcript data
    const mergeData = (target: any, source: any, field: string, isArray = false) => {
      if (!source || !source[field]) return;
      
      if (!target[field] || target[field] === "N/A" || target[field] === "Not provided") {
        if (isArray) {
          target[field] = Array.isArray(source[field]) ? source[field] : [source[field]];
        } else {
          target[field] = source[field];
        }
      } else if (isArray && Array.isArray(target[field]) && Array.isArray(source[field])) {
        // For arrays, add unique items from source that don't exist in target
        const existingItems = new Set(target[field].map((item: any) => 
          typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item)
        ));
        
        source[field].forEach((item: any) => {
          const normalizedItem = typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item);
          if (!existingItems.has(normalizedItem)) {
            target[field].push(item);
          }
        });
      }
    };
    
    // Business Story & Background
    if (websiteAnalysis.companyOverview) {
      if (!enhancedAnalysis.story.businessSummary || enhancedAnalysis.story.businessSummary === "N/A") {
        enhancedAnalysis.story.businessSummary = websiteAnalysis.companyOverview.summary || websiteAnalysis.companyOverview.description;
      }
      
      if (!enhancedAnalysis.story.yearStarted || enhancedAnalysis.story.yearStarted === "N/A") {
        enhancedAnalysis.story.yearStarted = websiteAnalysis.companyOverview.foundedYear || websiteAnalysis.companyOverview.yearEstablished;
      }
      
      if (websiteAnalysis.companyOverview.history && (!enhancedAnalysis.story.growthHistory || enhancedAnalysis.story.growthHistory === "N/A")) {
        enhancedAnalysis.story.growthHistory = websiteAnalysis.companyOverview.history;
      }
    }
    
    // Market Analysis & Positioning
    if (websiteAnalysis.marketPosition) {
      mergeData(enhancedAnalysis.marketAnalysis, websiteAnalysis.marketPosition, 'customerProfile');
      mergeData(enhancedAnalysis.marketAnalysis, websiteAnalysis.marketPosition, 'uniqueFeatures', true);
      mergeData(enhancedAnalysis.marketAnalysis, websiteAnalysis.marketPosition, 'strengths', true);
      
      // Add any unique selling points to key attractions
      if (websiteAnalysis.marketPosition.uniqueSellingPoints && Array.isArray(websiteAnalysis.marketPosition.uniqueSellingPoints)) {
        if (!enhancedAnalysis.story.keyAttractions) {
          enhancedAnalysis.story.keyAttractions = [];
        }
        
        const existingAttractions = new Set(enhancedAnalysis.story.keyAttractions.map((item: string) => item.toLowerCase()));
        
        websiteAnalysis.marketPosition.uniqueSellingPoints.forEach((point: string) => {
          if (!existingAttractions.has(point.toLowerCase())) {
            enhancedAnalysis.story.keyAttractions.push(point);
          }
        });
      }
    }
    
    // Products & Services
    if (websiteAnalysis.productsServices) {
      // Add product information to business summary if needed
      if ((!enhancedAnalysis.story.businessModel || enhancedAnalysis.story.businessModel === "N/A") && 
          websiteAnalysis.productsServices.description) {
        enhancedAnalysis.story.businessModel = websiteAnalysis.productsServices.description;
      }
      
      // Add products to inventory if available
      if (websiteAnalysis.productsServices.items && Array.isArray(websiteAnalysis.productsServices.items)) {
        if (!enhancedAnalysis.inventory) enhancedAnalysis.inventory = {};
        if (!enhancedAnalysis.inventory.topProducts || 
            !Array.isArray(enhancedAnalysis.inventory.topProducts) || 
            enhancedAnalysis.inventory.topProducts.length === 0) {
          enhancedAnalysis.inventory.topProducts = websiteAnalysis.productsServices.items
            .map((item: any) => item.name || item)
            .filter(Boolean)
            .slice(0, 5); // Limit to top 5
        }
      }
    }
    
    // Team & Leadership
    if (websiteAnalysis.team) {
      // Enhance team summary if needed
      if ((!enhancedAnalysis.team.employeeSummary || enhancedAnalysis.team.employeeSummary === "N/A") &&
          websiteAnalysis.team.summary) {
        enhancedAnalysis.team.employeeSummary = websiteAnalysis.team.summary;
      }
      
      // Add key employees if available
      if (websiteAnalysis.team.leadership && Array.isArray(websiteAnalysis.team.leadership)) {
        if (!enhancedAnalysis.team.keyEmployees || !Array.isArray(enhancedAnalysis.team.keyEmployees)) {
          enhancedAnalysis.team.keyEmployees = [];
        }
        
        const existingEmployees = new Set(enhancedAnalysis.team.keyEmployees.map((item: string) => 
          typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item)
        ));
        
        websiteAnalysis.team.leadership.forEach((member: any) => {
          const leaderText = typeof member === 'string' ? member : `${member.name || ''} - ${member.role || ''}`.trim();
          if (leaderText && !existingEmployees.has(leaderText.toLowerCase())) {
            enhancedAnalysis.team.keyEmployees.push(leaderText);
          }
        });
      }
    }
    
    // Assets & Facilities
    if (websiteAnalysis.assets || websiteAnalysis.locations) {
      const assetSource = websiteAnalysis.assets || {};
      const locationSource = websiteAnalysis.locations || {};
      
      // Enhance digital assets
      if (assetSource.digital && Array.isArray(assetSource.digital)) {
        if (!enhancedAnalysis.assets.digitalAssets) {
          enhancedAnalysis.assets.digitalAssets = [];
        }
        
        const existingAssets = new Set(enhancedAnalysis.assets.digitalAssets.map((item: string) => item.toLowerCase()));
        
        assetSource.digital.forEach((asset: string) => {
          if (!existingAssets.has(asset.toLowerCase())) {
            enhancedAnalysis.assets.digitalAssets.push(asset);
          }
        });
      }
      
      // Add location information
      if (locationSource.description && (!enhancedAnalysis.assets.location || enhancedAnalysis.assets.location === "N/A")) {
        enhancedAnalysis.assets.location = locationSource.description;
      } else if (locationSource.addresses && Array.isArray(locationSource.addresses) && locationSource.addresses.length > 0) {
        if (!enhancedAnalysis.assets.location || enhancedAnalysis.assets.location === "N/A") {
          enhancedAnalysis.assets.location = locationSource.addresses.join("; ");
        }
      }
      
      // Add facility information
      if (locationSource.facilities && (!enhancedAnalysis.facility || !enhancedAnalysis.facility.size)) {
        if (!enhancedAnalysis.facility) enhancedAnalysis.facility = {};
        if (!enhancedAnalysis.facility.size || enhancedAnalysis.facility.size === "N/A") {
          enhancedAnalysis.facility.size = locationSource.facilities;
        }
      }
    }
    
    // Marketing & Sales
    if (websiteAnalysis.marketing) {
      if (!enhancedAnalysis.marketing.strategies) enhancedAnalysis.marketing.strategies = [];
      if (websiteAnalysis.marketing.strategies && Array.isArray(websiteAnalysis.marketing.strategies)) {
        const existingStrategies = new Set(enhancedAnalysis.marketing.strategies.map((item: string) => item.toLowerCase()));
        
        websiteAnalysis.marketing.strategies.forEach((strategy: string) => {
          if (!existingStrategies.has(strategy.toLowerCase())) {
            enhancedAnalysis.marketing.strategies.push(strategy);
          }
        });
      }
      
      // Add channels to sales data
      if (websiteAnalysis.marketing.channels && Array.isArray(websiteAnalysis.marketing.channels)) {
        if (!enhancedAnalysis.sales) enhancedAnalysis.sales = {};
        if (!enhancedAnalysis.sales.channels) enhancedAnalysis.sales.channels = {};
        
        websiteAnalysis.marketing.channels.forEach((channel: string) => {
          if (!enhancedAnalysis.sales.channels[channel]) {
            enhancedAnalysis.sales.channels[channel] = "Website mentioned";
          }
        });
      }
    }
    
    // Growth Opportunities
    if (websiteAnalysis.growthOpportunities && Array.isArray(websiteAnalysis.growthOpportunities)) {
      if (!enhancedAnalysis.executiveSummary.growthOpportunities) {
        enhancedAnalysis.executiveSummary.growthOpportunities = [];
      }
      
      const existingOpportunities = new Set(enhancedAnalysis.executiveSummary.growthOpportunities.map((item: string) => item.toLowerCase()));
      
      websiteAnalysis.growthOpportunities.forEach((opportunity: string) => {
        if (!existingOpportunities.has(opportunity.toLowerCase())) {
          enhancedAnalysis.executiveSummary.growthOpportunities.push(opportunity);
        }
      });
    }
    
    // Enhance buyer attractions with testimonials if available
    if (websiteAnalysis.testimonials && Array.isArray(websiteAnalysis.testimonials) && websiteAnalysis.testimonials.length > 0) {
      if (!enhancedAnalysis.executiveSummary.buyerAttractions) {
        enhancedAnalysis.executiveSummary.buyerAttractions = [];
      }
      
      if (enhancedAnalysis.executiveSummary.buyerAttractions.length === 0) {
        enhancedAnalysis.executiveSummary.buyerAttractions.push("Strong customer testimonials on website");
      }
    }
    
    return enhancedAnalysis;
    
  } catch (error) {
    console.error('Error enhancing CIM with website data:', error);
    // If we encounter any error during enhancement, fall back to the original transcript analysis
    return transcriptAnalysis;
  }
}
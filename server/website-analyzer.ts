/**
 * Website analyzer utility for CIM generation
 * This module provides functions to analyze a business website and extract relevant information
 * using Perplexity's browsing API to enhance the CIM with website content
 */
import { PERPLEXITY_API_URL } from './perplexity';
import fetch from 'node-fetch';



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
 * Extracts image URLs from a website using lightweight HTML parsing
 * @param websiteUrl The URL of the website to extract images from
 * @returns Promise resolving to an array of image URLs
 */
export async function extractWebsiteImages(websiteUrl: string): Promise<string[]> {
  try {
    console.log(`Starting image extraction for: ${websiteUrl}`);
    
    // Try different URL variations to handle certificate issues
    const urlsToTry = [];
    
    // Add original URL (clean it up first)
    let cleanUrl = websiteUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    urlsToTry.push(cleanUrl);
    
    // Add alternative without www if original has it, or with www if it doesn't
    try {
      const urlObj = new URL(cleanUrl);
      if (urlObj.hostname.startsWith('www.')) {
        const noWwwUrl = `${urlObj.protocol}//${urlObj.hostname.substring(4)}${urlObj.pathname}${urlObj.search}`;
        urlsToTry.push(noWwwUrl);
      } else {
        const wwwUrl = `${urlObj.protocol}//www.${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;
        urlsToTry.push(wwwUrl);
      }
    } catch (e) {
      // Invalid URL, skip alternatives
    }
    
    let html = '';
    let baseUrl = '';
    let successfulUrl = '';
    
    // Try each URL variation
    for (const tryUrl of urlsToTry) {
      try {
        console.log(`Trying URL: ${tryUrl}`);
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000,
          // Add TLS options to handle certificate issues
          agent: false,
          redirect: 'follow'
        });
        
        if (response.ok) {
          html = await response.text();
          const urlObj = new URL(tryUrl);
          baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          successfulUrl = tryUrl;
          console.log(`Successfully fetched HTML from: ${tryUrl}, length: ${html.length} bytes`);
          break;
        }
      } catch (error) {
        console.log(`Failed to fetch ${tryUrl}: ${error.message}`);
        continue;
      }
    }
    
    if (!html) {
      console.error('Failed to fetch website content from any URL variation');
      return [];
    }
    
    // Extract image URLs using multiple patterns
    const imageUrls: string[] = [];
    const patterns = [
      // Standard img tags
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      // Background images in style attributes
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      // CSS background properties
      /background:\s*url\(["']?([^"')]+)["']?\)/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && imageUrls.length < 15) {
        let imageUrl = match[1];
        
        // Skip obviously non-content images but be less restrictive
        const lowercaseUrl = imageUrl.toLowerCase();
        if (lowercaseUrl.includes('spacer.') ||
            lowercaseUrl.includes('blank.') ||
            lowercaseUrl.includes('1x1.') ||
            lowercaseUrl.includes('transparent.') ||
            lowercaseUrl.includes('loading.gif') ||
            lowercaseUrl.includes('spinner.gif') ||
            imageUrl.length < 10 ||
            imageUrl.includes('data:image/svg')) {
          continue;
        }
        
        // Resolve relative URLs
        if (imageUrl.startsWith('//')) {
          imageUrl = new URL(successfulUrl).protocol + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = baseUrl + imageUrl;
        } else if (!imageUrl.startsWith('http')) {
          imageUrl = baseUrl + '/' + imageUrl;
        }
        
        // Skip duplicates
        if (imageUrls.includes(imageUrl)) {
          continue;
        }
        
        // Quick validation - check if it's a reasonable image URL
        if (imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)) {
          imageUrls.push(imageUrl);
        } else {
          // For URLs without clear extensions, do a quick HEAD request
          try {
            const imgResponse = await fetch(imageUrl, { 
              method: 'HEAD', 
              timeout: 2000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            const contentType = imgResponse.headers.get('content-type');
            if (imgResponse.ok && contentType && contentType.startsWith('image/')) {
              imageUrls.push(imageUrl);
            }
          } catch (error) {
            // Skip this image if not accessible
            continue;
          }
        }
      }
    }
    
    console.log(`Extracted ${imageUrls.length} images from website`);
    return imageUrls;
    
  } catch (error) {
    console.error('Failed to extract website images:', error);
    return [];
  }
}

/**
 * Downloads selected images from website and saves them locally
 * @param imageUrls Array of image URLs to download
 * @param websiteUrl The website URL for context
 * @returns Promise resolving to array of local image paths
 */
export async function downloadSelectedImages(imageUrls: string[], websiteUrl: string, userId: number = 1): Promise<string[]> {
  console.log(`Downloading ${imageUrls.length} selected images from ${websiteUrl} for user ${userId}`);
  const savedPaths: string[] = [];
  
  const { imageManager } = await import('./image-manager');
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    try {
      console.log(`Downloading image ${i + 1}/${imageUrls.length}: ${imageUrl}`);
      
      // Use imageManager to download and save the image
      const metadata = await imageManager.saveImageFromUrl(imageUrl, userId, 'business-images', { 
        optimize: true, 
        maxWidth: 1200, 
        maxHeight: 800 
      });
      savedPaths.push(metadata.publicPath);
      
      console.log(`Successfully saved image ${i + 1}: ${metadata.publicPath}`);
    } catch (error) {
      console.error(`Failed to download image ${imageUrl}:`, error);
      // Continue with other images even if one fails
    }
  }
  
  console.log(`Downloaded ${savedPaths.length}/${imageUrls.length} images successfully`);
  return savedPaths;
}

/**
 * Website screenshot functionality disabled to improve generation speed
 * @param websiteUrl The URL of the website to capture
 * @returns Promise resolving to null (screenshots disabled)
 */
export async function captureWebsiteScreenshot(websiteUrl: string): Promise<string | null> {
  console.log('Website screenshot functionality disabled for faster generation');
  return null;
}

/**
 * Downloads and saves a remote logo as a local file
 * @param logoUrl The URL of the logo to download
 * @param websiteUrl The website URL (used for naming)
 * @returns Promise resolving to the local path of the saved logo, or null if failed
 */
async function downloadAndSaveLogo(logoUrl: string, websiteUrl: string, userId: number = 1): Promise<string | null> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const crypto = await import('crypto');
    
    // Create logos directory if it doesn't exist
    const logosDir = path.join(process.cwd(), 'public', 'logos');
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }
    
    // Generate filename based on website - always use PNG for better compatibility
    const websiteHash = crypto.createHash('md5').update(websiteUrl).digest('hex').substring(0, 8);
    const filename = `logo_${websiteHash}.png`;
    const filepath = path.join(logosDir, filename);
    const publicPath = `/logos/${filename}`;
    
    // Check if converted logo already exists
    if (fs.existsSync(filepath)) {
      console.log(`Converted logo already exists: ${publicPath}`);
      return publicPath;
    }
    
    // Download the logo
    const response = await fetch(logoUrl);
    if (!response.ok) {
      console.error(`Failed to download logo: ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // If it's an SVG, convert to PNG for better document compatibility
    if (logoUrl.includes('.svg') || logoUrl.includes('svg')) {
      try {
        console.log('Converting SVG logo to PNG for document compatibility...');
        const puppeteer = await import('puppeteer');
        
        const browser = await puppeteer.launch({
          headless: true,
          executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 400, height: 400 });
        
        // Create SVG data URL
        const svgContent = buffer.toString('utf8');
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
        
        await page.goto(dataUrl);
        
        // Take screenshot as PNG with transparent background
        const pngBuffer = await page.screenshot({
          type: 'png',
          omitBackground: true,
          clip: { x: 0, y: 0, width: 400, height: 400 }
        });
        
        await browser.close();
        
        // Save the converted PNG
        fs.writeFileSync(filepath, pngBuffer);
        console.log(`Successfully converted SVG to PNG: ${publicPath}`);
        
      } catch (conversionError) {
        console.error('SVG conversion failed:', conversionError);
        // Fallback: save as original file with different name
        const fallbackFilename = `logo_${websiteHash}.svg`;
        const fallbackPath = path.join(logosDir, fallbackFilename);
        fs.writeFileSync(fallbackPath, buffer);
        return `/logos/${fallbackFilename}`;
      }
    } else {
      // Save non-SVG logos directly
      fs.writeFileSync(filepath, buffer);
      console.log(`Downloaded and saved logo: ${publicPath}`);
    }
    
    return publicPath;
    
  } catch (error) {
    console.error('Error downloading logo:', error);
    return null;
  }
}

/**
 * Extracts a company logo from a website
 * @param websiteUrl The URL of the website to extract the logo from
 * @returns Promise resolving to the local path of the downloaded logo, or null if not found
 */
export async function extractLogoFromWebsite(websiteUrl: string, userId: number = 1): Promise<string | null> {
  try {
    console.log(`Attempting to extract logo from website: ${websiteUrl}`);
    const normalizedUrl = normalizeUrl(websiteUrl);
    console.log(`Normalized URL: ${normalizedUrl}`);
    
    // Fetch the website HTML
    console.log(`Fetching website HTML...`);
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch website: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`Fetched HTML content, length: ${html.length} bytes`);
    
    // Extract the base URL for resolving relative paths
    const urlObj = new URL(normalizedUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    console.log(`Base URL: ${baseUrl}`);
    
    // Common logo patterns to search for
    const logoPatterns = [
      // Common logo class and ID patterns
      /<img[^>]*(?:class|id)="[^"]*(?:logo|brand)[^"]*"[^>]*src="([^"]+)"[^>]*>/i,
      /<img[^>]*src="([^"]+)"[^>]*(?:class|id)="[^"]*(?:logo|brand)[^"]*"[^>]*>/i,
      // Alt text containing "logo"
      /<img[^>]*alt="[^"]*(?:logo|brand)[^"]*"[^>]*src="([^"]+)"[^>]*>/i,
      /<img[^>]*src="([^"]+)"[^>]*alt="[^"]*(?:logo|brand)[^"]*"[^>]*>/i,
      // Common logo filenames
      /<img[^>]*src="([^"]*(?:logo|brand|header-logo)[^"]*\.(?:png|jpg|jpeg|svg|webp))"[^>]*>/i,
      // Logo in header or navigation
      /<header[^>]*>(?:(?!<\/header>).)*?<img[^>]*src="([^"]+)"[^>]*>(?:(?!<\/header>).)*?<\/header>/is,
      /<nav[^>]*>(?:(?!<\/nav>).)*?<img[^>]*src="([^"]+)"[^>]*>(?:(?!<\/nav>).)*?<\/nav>/is,
      // Link with logo class containing an image
      /<a[^>]*(?:class|id)="[^"]*(?:logo|brand)[^"]*"[^>]*>(?:(?!<\/a>).)*?<img[^>]*src="([^"]+)"[^>]*>(?:(?!<\/a>).)*?<\/a>/is
    ];
    
    console.log(`Searching for logo using ${logoPatterns.length} different patterns...`);
    
    // Try each pattern until we find a match
    for (let i = 0; i < logoPatterns.length; i++) {
      console.log(`Trying pattern ${i+1}...`);
      const pattern = logoPatterns[i];
      const match = html.match(pattern);
      if (match && match[1]) {
        let logoUrl = match[1];
        console.log(`Pattern ${i+1} matched! Raw logo URL: ${logoUrl}`);
        
        // Resolve relative URLs
        if (logoUrl.startsWith('//')) {
          logoUrl = urlObj.protocol + logoUrl;
          console.log(`Converted protocol-relative URL to: ${logoUrl}`);
        } else if (logoUrl.startsWith('/')) {
          logoUrl = baseUrl + logoUrl;
          console.log(`Converted root-relative URL to: ${logoUrl}`);
        } else if (!logoUrl.startsWith('http')) {
          logoUrl = baseUrl + '/' + logoUrl;
          console.log(`Converted relative URL to: ${logoUrl}`);
        }
        
        // Verify the logo URL is accessible
        try {
          console.log(`Checking if logo URL is accessible: ${logoUrl}`);
          const logoResponse = await fetch(logoUrl, { method: 'HEAD' });
          if (!logoResponse.ok) {
            console.log(`Logo URL returned status ${logoResponse.status}: ${logoResponse.statusText}`);
            continue; // Try next pattern
          }
          console.log(`Logo URL is accessible`);
          // Download and save the logo locally
          const localLogoPath = await downloadAndSaveLogo(logoUrl, websiteUrl, userId);
          return localLogoPath || logoUrl; // Fallback to remote URL if download fails
        } catch (logoError) {
          console.error(`Error checking logo URL: ${logoError}`);
          continue; // Try next pattern
        }
      }
    }
    
    // If we couldn't find a logo, try one last pattern for favicon
    const faviconMatch = html.match(/<link[^>]*rel="(?:icon|shortcut icon)"[^>]*href="([^"]+)"[^>]*>/i);
    if (faviconMatch && faviconMatch[1]) {
      let faviconUrl = faviconMatch[1];
      
      // Resolve relative URLs
      if (faviconUrl.startsWith('//')) {
        faviconUrl = urlObj.protocol + faviconUrl;
      } else if (faviconUrl.startsWith('/')) {
        faviconUrl = baseUrl + faviconUrl;
      } else if (!faviconUrl.startsWith('http')) {
        faviconUrl = baseUrl + '/' + faviconUrl;
      }
      
      console.log(`Found favicon as fallback: ${faviconUrl}`);
      return faviconUrl;
    }
    
    // Default favicon location as last resort
    const defaultFavicon = `${baseUrl}/favicon.ico`;
    
    // Check if default favicon exists
    try {
      const faviconResponse = await fetch(defaultFavicon, { method: 'HEAD' });
      if (faviconResponse.ok) {
        console.log(`Using default favicon location: ${defaultFavicon}`);
        return defaultFavicon;
      }
    } catch (error) {
      console.error(`Error checking default favicon: ${error.message}`);
    }
    
    console.log("No logo found on website");
    return null;
  } catch (error) {
    console.error(`Error extracting logo: ${error.message}`);
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
        model: "sonar-pro",
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
        frequency_penalty: 0
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
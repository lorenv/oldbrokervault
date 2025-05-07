/**
 * Website analyzer module for the CIM Generator
 * 
 * This module extracts and analyzes website content to integrate with the CIM.
 * It handles:
 * - Website screenshots
 * - Logo extraction
 * - Image gallery extraction
 * - Content analysis with AI
 */

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { load } from 'cheerio';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface WebsiteData {
  companyName: string;
  logo: string | null; // Base64 encoded image
  screenshot: string | null; // Base64 encoded image
  websiteUrl: string;
  images: string[]; // Array of Base64 encoded images (1-3)
  content: {
    businessDescription: string;
    teamInfo: string;
    servicesInfo: string;
  };
}

/**
 * Takes a screenshot of a website URL
 * @param url Website URL to capture
 * @returns Base64 encoded screenshot
 */
async function captureScreenshot(url: string): Promise<string | null> {
  try {
    // Use puppeteer or a screenshot service API to take a full page screenshot
    // For simplicity, we'll use a placeholder implementation
    const tempFilePath = path.join(process.cwd(), 'temp-screenshot.png');
    
    // For a real implementation, you'd use:
    // await page.goto(url);
    // await page.screenshot({path: tempFilePath, fullPage: true});
    
    // Read the screenshot and convert to base64
    // const screenshotBuffer = await fs.promises.readFile(tempFilePath);
    // return screenshotBuffer.toString('base64');
    
    // Placeholder return
    return null;
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    return null;
  }
}

/**
 * Extracts the logo from a website
 * @param url Website URL
 * @returns Base64 encoded logo image
 */
async function extractLogo(url: string): Promise<string | null> {
  try {
    // Fetch the website HTML
    const response = await fetch(url);
    const html = await response.text();
    
    // Use cheerio to parse the HTML and find the logo
    const $ = load(html);
    
    // Common logo selectors
    const logoSelectors = [
      'img[src*="logo"]',
      '.logo img',
      '#logo img',
      'header img',
      '.header img',
      '.navbar-brand img',
      '.brand img',
      'a[class*="logo"] img'
    ];
    
    // Try each selector to find a logo
    let logoSrc = null;
    for (const selector of logoSelectors) {
      const $logo = $(selector).first();
      if ($logo.length) {
        logoSrc = $logo.attr('src');
        break;
      }
    }
    
    if (!logoSrc) {
      return null;
    }
    
    // Resolve relative URLs to absolute
    if (logoSrc.startsWith('/')) {
      const urlObj = new URL(url);
      logoSrc = `${urlObj.origin}${logoSrc}`;
    } else if (!logoSrc.startsWith('http')) {
      logoSrc = new URL(logoSrc, url).href;
    }
    
    // Fetch the logo image
    const logoResponse = await fetch(logoSrc);
    const logoBuffer = await logoResponse.buffer();
    
    // Convert to base64
    return logoBuffer.toString('base64');
  } catch (error) {
    console.error("Error extracting logo:", error);
    return null;
  }
}

/**
 * Extracts 1-3 significant images from the website
 * @param url Website URL
 * @returns Array of Base64 encoded images
 */
async function extractImages(url: string): Promise<string[]> {
  try {
    // Fetch the website HTML
    const response = await fetch(url);
    const html = await response.text();
    
    // Use cheerio to parse the HTML and find images
    const $ = load(html);
    
    // Find significant images - look for hero images, large content images
    const imageSelectors = [
      '.hero img',
      '.banner img',
      '.carousel img',
      '.slider img',
      '.featured img',
      'section img',
      'article img',
      '.content img',
      'img[width][height]' // Images with explicit dimensions
    ];
    
    // Collect image sources
    const imageSources: string[] = [];
    
    for (const selector of imageSelectors) {
      $(selector).each((_, img) => {
        const src = $(img).attr('src');
        if (src && !src.includes('logo') && !src.includes('icon')) {
          // Resolve relative URLs to absolute
          if (src.startsWith('/')) {
            const urlObj = new URL(url);
            imageSources.push(`${urlObj.origin}${src}`);
          } else if (!src.startsWith('http')) {
            imageSources.push(new URL(src, url).href);
          } else {
            imageSources.push(src);
          }
        }
      });
      
      // Limit to 3 images
      if (imageSources.length >= 3) {
        break;
      }
    }
    
    // Fetch each image and convert to base64
    const base64Images: string[] = [];
    for (const src of imageSources.slice(0, 3)) {
      try {
        const imgResponse = await fetch(src);
        const imgBuffer = await imgResponse.buffer();
        base64Images.push(imgBuffer.toString('base64'));
      } catch (error) {
        console.error(`Error fetching image ${src}:`, error);
      }
    }
    
    return base64Images;
  } catch (error) {
    console.error("Error extracting images:", error);
    return [];
  }
}

/**
 * Extracts company name from the website
 * @param url Website URL
 * @returns Company name or domain name as fallback
 */
async function extractCompanyName(url: string): Promise<string> {
  try {
    // Fetch the website HTML
    const response = await fetch(url);
    const html = await response.text();
    
    // Use cheerio to parse the HTML
    const $ = load(html);
    
    // Try common places for company name
    const titleText = $('title').text();
    const h1Text = $('h1').first().text();
    const brandText = $('.brand, .logo, .company-name').first().text();
    
    // Look for items with "logo" class or id that might contain alt text with company name
    const logoAlt = $('img[class*="logo"], #logo img, .logo img').attr('alt');
    
    // Extract domain name as fallback
    const domain = new URL(url).hostname.replace('www.', '');
    
    // Choose the best source for company name
    if (brandText && brandText.length > 1) {
      return brandText.trim();
    } else if (logoAlt && logoAlt.length > 1) {
      return logoAlt.trim();
    } else if (h1Text && h1Text.length > 1 && h1Text.split(' ').length <= 5) {
      return h1Text.trim();
    } else if (titleText) {
      // Clean up title (often includes " - Home" or similar)
      return titleText.split('|')[0].split('-')[0].trim();
    }
    
    // Fallback to domain name, converting "example-store.com" to "Example Store"
    return domain
      .split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch (error) {
    console.error("Error extracting company name:", error);
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.split('.')[0];
  }
}

/**
 * Extracts website content for analysis
 * @param url Website URL
 * @returns Text content from the website
 */
async function extractContent(url: string): Promise<string> {
  try {
    // Fetch the website HTML
    const response = await fetch(url);
    const html = await response.text();
    
    // Use JSDOM to parse HTML and extract readable content
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, noscript, iframe');
    scripts.forEach(el => el.remove());
    
    // Extract text from main content areas
    const contentSelectors = [
      'main',
      'article',
      '#content',
      '.content',
      '.main',
      'section',
      '.about',
      '.about-us',
      '.company',
      '.services',
      '.products',
      '.team',
      '.mission',
      '.values'
    ];
    
    let contentText = '';
    
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        contentText += el.textContent + '\n\n';
      });
    }
    
    // If no content was found using selectors, fall back to body text
    if (!contentText.trim()) {
      contentText = document.body.textContent || '';
    }
    
    // Clean up the text (remove excess whitespace, etc.)
    contentText = contentText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    return contentText;
  } catch (error) {
    console.error("Error extracting website content:", error);
    return '';
  }
}

/**
 * Analyzes website content using AI to extract relevant business information
 * @param websiteContent The text content from the website
 * @returns Structured business information
 */
async function analyzeWebsiteContent(websiteContent: string): Promise<{
  businessDescription: string;
  teamInfo: string;
  servicesInfo: string;
}> {
  try {
    // For a real implementation, you would send this to OpenAI or Perplexity API
    // with a prompt asking to extract business description, team info, and services
    
    // Placeholder implementation - in a real app this would call the AI service
    return {
      businessDescription: "Business description extracted from website",
      teamInfo: "Team information extracted from website",
      servicesInfo: "Services information extracted from website"
    };
  } catch (error) {
    console.error("Error analyzing website content:", error);
    return {
      businessDescription: "",
      teamInfo: "",
      servicesInfo: ""
    };
  }
}

/**
 * Main function to extract all website data
 * @param websiteUrl URL of the business website
 * @returns Structured website data for the CIM
 */
export async function analyzeWebsite(websiteUrl: string): Promise<WebsiteData> {
  console.log(`Analyzing website: ${websiteUrl}`);
  
  try {
    // Validate and normalize URL
    if (!websiteUrl.startsWith('http')) {
      websiteUrl = `https://${websiteUrl}`;
    }
    
    // Run all extraction processes in parallel
    const [
      companyName,
      logo,
      screenshot,
      images,
      content
    ] = await Promise.all([
      extractCompanyName(websiteUrl),
      extractLogo(websiteUrl),
      captureScreenshot(websiteUrl),
      extractImages(websiteUrl),
      extractContent(websiteUrl)
    ]);
    
    // Analyze the extracted content with AI
    const contentAnalysis = await analyzeWebsiteContent(content);
    
    return {
      companyName,
      logo,
      screenshot,
      websiteUrl,
      images,
      content: contentAnalysis
    };
  } catch (error) {
    console.error("Error analyzing website:", error);
    // Return a partially complete object with the URL
    return {
      companyName: new URL(websiteUrl).hostname.replace('www.', ''),
      logo: null,
      screenshot: null,
      websiteUrl,
      images: [],
      content: {
        businessDescription: "",
        teamInfo: "",
        servicesInfo: ""
      }
    };
  }
}
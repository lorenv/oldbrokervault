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
import { analyzeWebsiteContent as aiAnalyzeWebsiteContent, WebsiteAnalysis } from './openai';

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
    // For now, since we can't use headless browsers in this environment,
    // we'll need to skip the actual capturing part
    console.log(`Would capture screenshot for ${url} in a production environment`);
    return null;
    
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
    scripts.forEach((el: Element) => el.remove());
    
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
      elements.forEach((el: Element) => {
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
 * Main function to extract all website data
 * @param websiteUrl URL of the business website
 * @returns Structured website data for the CIM
 */
export async function analyzeWebsite(websiteUrl: string): Promise<WebsiteData> {
  console.log(`Analyzing website: ${websiteUrl}`);
  
  try {
    // Validate and normalize URL
    if (!websiteUrl) {
      throw new Error("Website URL is required");
    }
    
    // Clean the URL (remove extra spaces)
    websiteUrl = websiteUrl.trim();
    
    // First try the URL as provided
    let urlsToTry = [websiteUrl];
    
    // Extract domain without protocol and www
    let domain = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/i, '');
    
    // Create variations to try
    const variations = [
      websiteUrl,              // Original input
      `https://${domain}`,     // https without www
      `https://www.${domain}`, // https with www
      `http://${domain}`,      // http without www
      `http://www.${domain}`   // http with www
    ];
    
    // Filter out duplicates manually
    urlsToTry = [];
    for (const url of variations) {
      if (!urlsToTry.includes(url)) {
        urlsToTry.push(url);
      }
    }
    
    console.log(`Will try the following URLs in order: ${urlsToTry.join(', ')}`);
    
    // Start with the first URL format
    websiteUrl = urlsToTry[0];
    
    // Try each URL format until one works
    let companyName = "";
    let logo = null;
    let screenshot = null;
    let images: string[] = [];
    let content = "";
    let success = false;
    
    // Try each URL format in order
    for (const urlToTry of urlsToTry) {
      try {
        console.log(`Trying URL: ${urlToTry}`);
        
        // Try to extract content with this URL format
        [companyName, logo, screenshot, images, content] = await Promise.all([
          extractCompanyName(urlToTry),
          extractLogo(urlToTry),
          captureScreenshot(urlToTry),
          extractImages(urlToTry),
          extractContent(urlToTry)
        ]);
        
        // If we got here without error, use this URL
        websiteUrl = urlToTry;
        success = true;
        console.log(`Successfully extracted content from ${urlToTry}`);
        break;
      } catch (urlError) {
        console.log(`Failed to extract from ${urlToTry}: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
        // Continue to the next URL format
      }
    }
    
    if (!success) {
      throw new Error("Failed to extract website content from all URL variations");
    }
    
    // Analyze the extracted content with AI
    const contentAnalysis = await aiAnalyzeWebsiteContent(content);
    
    return {
      companyName: contentAnalysis.companyName || companyName,
      logo,
      screenshot,
      websiteUrl,
      images,
      content: {
        businessDescription: contentAnalysis.businessDescription,
        teamInfo: contentAnalysis.teamInfo,
        servicesInfo: contentAnalysis.servicesInfo,
      }
    };
  } catch (error) {
    console.error("Error analyzing website:", error instanceof Error ? error.message : String(error));
    
    // Return a partially complete object with the URL
    try {
      // Try to extract a domain name for the company name
      let companyName = "Unknown";
      try {
        companyName = new URL(websiteUrl).hostname.replace('www.', '');
      } catch (urlError) {
        // If URL parsing fails, just use the raw input as the company name
        companyName = websiteUrl.replace(/^https?:\/\//i, '').replace('www.', '');
      }
      
      return {
        companyName,
        logo: null,
        screenshot: null,
        websiteUrl,
        images: [],
        content: {
          businessDescription: "Unable to extract content from website.",
          teamInfo: "",
          servicesInfo: ""
        }
      };
    } catch (fallbackError) {
      // If even the fallback fails, return truly minimal data
      console.error("Failed to create fallback website data:", fallbackError);
      return {
        companyName: "Website Analysis Failed",
        logo: null,
        screenshot: null,
        websiteUrl: websiteUrl || "",
        images: [],
        content: {
          businessDescription: "",
          teamInfo: "",
          servicesInfo: ""
        }
      };
    }
  }
}
/**
 * Minimal Website Analyzer
 * 
 * This is a simplified version of the website analyzer that focuses exclusively on 
 * extracting the absolute minimum data needed, with extensive error handling.
 */

import * as https from 'https';
import * as http from 'http';
import cheerio from 'cheerio';
import fetch from 'node-fetch';

// Simple data structure for website data
export interface MinimalWebsiteData {
  title: string;
  description: string;
  logo: string | null;
  imageUrls: string[];
}

// Default empty response
const EMPTY_RESULT: MinimalWebsiteData = {
  title: '',
  description: '',
  logo: null,
  imageUrls: []
};

/**
 * Extract minimal data from website with maximum reliability
 */
export async function getMinimalWebsiteData(url: string): Promise<MinimalWebsiteData> {
  console.log(`Analyzing website with minimal approach: ${url}`);
  
  // Input validation
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    console.error('Invalid URL provided');
    return EMPTY_RESULT;
  }
  
  try {
    // Fetch with timeout
    const html = await fetchWithTimeout(url, 10000);
    
    if (!html) {
      console.error('Failed to fetch website content');
      return EMPTY_RESULT;
    }
    
    // Use cheerio for safe HTML parsing
    const $ = cheerio.load(html);
    
    // Extract basic website data
    let result = { ...EMPTY_RESULT };
    
    // Get title safely
    try {
      result.title = $('title').text().trim() || $('h1').first().text().trim() || '';
    } catch (e) {
      console.error('Error extracting title:', e);
    }
    
    // Get description safely
    try {
      result.description = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || 
                          $('p').first().text().trim().substring(0, 200) || '';
    } catch (e) {
      console.error('Error extracting description:', e);
    }
    
    // Extract logo URL
    try {
      // Check common logo locations
      const logoSelectors = [
        'img[src*="logo"]',
        '.logo img',
        'header img',
        '.navbar-brand img'
      ];
      
      for (const selector of logoSelectors) {
        const logo = $(selector).first();
        if (logo.length) {
          const src = $(logo).attr('src');
          if (src) {
            // Convert to absolute URL if needed
            result.logo = src.startsWith('http') ? src : new URL(src, url).href;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error extracting logo:', e);
    }
    
    // Extract image URLs (max 3)
    try {
      const images: string[] = [];
      const imageSet = new Set<string>();
      
      $('img').each((_, img) => {
        if (images.length >= 3) return false;
        
        try {
          const src = $(img).attr('src');
          if (!src) return true;
          
          // Skip small images, icons, data URLs
          if (src.includes('icon') || src.includes('logo') || 
              src.startsWith('data:') || src.endsWith('.svg')) {
            return true;
          }
          
          // Convert to absolute URL if needed
          const imageUrl = src.startsWith('http') ? src : new URL(src, url).href;
          
          // Skip duplicates
          if (imageSet.has(imageUrl)) return true;
          
          imageSet.add(imageUrl);
          images.push(imageUrl);
        } catch (imgErr) {
          // Continue to next image
        }
        
        return true;
      });
      
      result.imageUrls = images;
    } catch (e) {
      console.error('Error extracting images:', e);
    }
    
    console.log('Successfully extracted minimal website data');
    return result;
    
  } catch (error) {
    console.error('Error in minimal website analysis:', error);
    return EMPTY_RESULT;
  }
}

/**
 * Safely fetch a URL with timeout
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { timeout }, (res) => {
      if (res.statusCode! >= 300 && res.statusCode! < 400 && res.headers.location) {
        // Follow redirect
        fetchWithTimeout(res.headers.location, timeout)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (res.statusCode! !== 200) {
        reject(new Error(`HTTP error: ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.setEncoding('utf8');
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });
    
    req.on('error', reject);
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    req.end();
  });
}

/**
 * Enhance the CIM analysis with minimal website data
 * This function adds website data directly, without complex transformations
 */
export function enhanceAnalysisWithMinimalWebsiteData(
  analysis: any, 
  websiteData: MinimalWebsiteData
): any {
  if (!analysis || typeof analysis !== 'object') {
    console.error('Invalid analysis object');
    return analysis;
  }
  
  try {
    // Create a deep clone to avoid mutations
    const result = JSON.parse(JSON.stringify(analysis));
    
    // Add website data section
    result.website = {
      title: websiteData.title || '',
      description: websiteData.description || '',
      logoUrl: websiteData.logo || null,
      imageUrls: websiteData.imageUrls || []
    };
    
    // Attempt to enhance some fields (safely)
    try {
      // Add website title to business name if missing
      if (websiteData.title && (!result.story || !result.story.businessSummary)) {
        if (!result.story) result.story = {};
        if (!result.story.businessSummary) {
          result.story.businessSummary = `Business website title: ${websiteData.title}`;
        }
      }
      
      // Add website description to market analysis if missing
      if (websiteData.description && (!result.marketAnalysis || !result.marketAnalysis.customerProfile)) {
        if (!result.marketAnalysis) result.marketAnalysis = {};
        if (!result.marketAnalysis.customerProfile) {
          result.marketAnalysis.customerProfile = `From website: ${websiteData.description}`;
        }
      }
    } catch (enhanceError) {
      console.error('Error enhancing analysis with website data:', enhanceError);
      // Continue with the base result
    }
    
    return result;
  } catch (error) {
    console.error('Error in enhanceAnalysisWithMinimalWebsiteData:', error);
    return analysis; // Return original if anything fails
  }
}
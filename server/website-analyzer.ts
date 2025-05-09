/**
 * Website analyzer utility for CIM generation
 * This module provides functions to analyze a business website and extract relevant information
 * using Perplexity's browsing API to enhance the CIM with website content
 */
import { PERPLEXITY_API_URL } from './perplexity';
import fetch from 'node-fetch';

/**
 * Normalizes and validates a URL
 * @param urlString Raw URL string input
 * @returns Normalized URL with protocol and www if needed
 * @throws Error if URL is invalid
 */
export function normalizeUrl(urlString: string): string {
  if (!urlString) {
    throw new Error('URL is required');
  }

  // Add protocol if missing
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    urlString = 'https://' + urlString;
  }

  try {
    const url = new URL(urlString);
    
    // Ensure hostname part exists
    if (!url.hostname || url.hostname.length < 3) {
      throw new Error('Invalid URL hostname');
    }
    
    // Return normalized URL
    return url.toString();
  } catch (error) {
    throw new Error('Invalid URL format');
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
      throw new Error(`Website analysis failed with status: ${response.status}`);
    }

    const result = await response.json() as {
      choices?: Array<{
        message?: {
          content: string;
        };
      }>;
      citations?: string[];
    };
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response format from Perplexity API');
    }
    
    if (result.citations) {
      console.log('Website analysis citations:', result.citations);
    }
    
    // Parse the content from the API response
    let websiteData;
    try {
      const content = result.choices[0].message?.content;
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
    throw error;
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
}
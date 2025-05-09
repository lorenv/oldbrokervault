/**
 * Website analyzer utility for CIM generation
 * This module provides functions to analyze a business website and extract relevant information
 * using Perplexity's browsing API to enhance the CIM with website content
 */

import { PERPLEXITY_API_URL } from "./perplexity";
import { URL } from "url";

/**
 * Normalizes and validates a URL
 * @param urlString Raw URL string input
 * @returns Normalized URL with protocol and www if needed
 * @throws Error if URL is invalid
 */
export function normalizeUrl(urlString: string): string {
  let processedUrl = urlString.trim();
  
  // Add protocol if missing
  if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
    processedUrl = 'https://' + processedUrl;
  }
  
  try {
    const urlObj = new URL(processedUrl);
    
    // Ensure hostname is valid
    if (!urlObj.hostname || urlObj.hostname.length < 3) {
      throw new Error("Invalid hostname");
    }
    
    // Add www. if it's not a subdomain and doesn't already have www
    if (!urlObj.hostname.startsWith('www.') && 
        urlObj.hostname.split('.').length === 2) {
      urlObj.hostname = 'www.' + urlObj.hostname;
    }
    
    return urlObj.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }

  try {
    console.log(`Analyzing website: ${websiteUrl}`);
    
    // Define the key pages to analyze (limit to 3-5 pages)
    const pagesToAnalyze = [
      websiteUrl, // Homepage
      `${websiteUrl.replace(/\/$/, '')}/about`, // About page
      `${websiteUrl.replace(/\/$/, '')}/services` // Services page
    ];
    
    // Format as a browsing request for Perplexity
    const messages = [
      {
        role: "system",
        content: `You are a professional business analyst. Analyze the given business website and extract key information that would be valuable for a Confidential Information Memorandum (CIM). Focus on:
1. Business overview and value proposition
2. Products and services offered
3. Unique selling points and competitive advantages
4. Target market and customer profiles
5. Company history and milestones
6. Team structure and key team members
7. Business model and revenue streams
8. Industry positioning and market differentiators

Provide this information in a structured JSON format. Only include factual information that is explicitly present on the website.`
      },
      {
        role: "user",
        content: `Analyze this business website: ${websiteUrl}

Focus on the homepage, about page, services/products pages, and any other key pages that provide insights into the business. Limit your analysis to 3-5 main pages.

Respond with ONLY a JSON object with the following structure:

{
  "businessOverview": "Comprehensive description of what the business does, its value proposition, and core offerings",
  "valueProposition": "The main value proposition and unique selling points",
  "productsServices": ["Detailed list of products/services offered"],
  "targetMarket": "Description of the target customer segments",
  "companyHistory": "Overview of company history and key milestones",
  "teamStructure": "Information about the team structure and key team members",
  "businessModel": "Insights into the business model and revenue streams",
  "marketDifferentiators": ["List of competitive advantages and market differentiators"],
  "customerTestimonials": ["Notable customer testimonials or success stories"],
  "contactInformation": "Business contact details, location, service area",
  "technologiesUsed": ["Technologies, platforms, or methodologies used by the business"]
}`
      }
    ];

    // Make the request to Perplexity API
    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages,
        temperature: 0.2,
        search_domain_filter: [websiteUrl],
        search_recency_filter: "month",
        return_images: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    try {
      // Extract the content and parse it as JSON
      const contentStr = data.choices[0].message.content;
      const matches = contentStr.match(/\{[\s\S]*\}/);
      if (!matches) {
        throw new Error("No JSON object found in response");
      }

      const websiteAnalysis = JSON.parse(matches[0]);
      
      // Validate the response has the required fields
      if (!websiteAnalysis.businessOverview || !websiteAnalysis.valueProposition) {
        throw new Error("Invalid response format from Perplexity API");
      }

      console.log("Successfully analyzed website");
      return websiteAnalysis;
    } catch (error) {
      console.error("Failed to parse Perplexity website analysis response:", data.choices[0].message.content);
      throw new Error("Failed to parse website analysis response");
    }
  } catch (error) {
    console.error("Website analysis error:", error);
    throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : String(error)}`);
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
  // Create a deep copy of transcript analysis to avoid modifying the original
  const enhancedAnalysis = JSON.parse(JSON.stringify(transcriptAnalysis));
  
  // Business Summary Enhancement
  if (enhancedAnalysis.story && websiteAnalysis.businessOverview) {
    // If business summary is empty or minimal, use website data
    if (!enhancedAnalysis.story.businessSummary || 
        enhancedAnalysis.story.businessSummary.length < 50) {
      enhancedAnalysis.story.businessSummary = websiteAnalysis.businessOverview;
    } 
    // Otherwise, enhance it with additional details if available
    else {
      // Look for gaps in the transcript analysis that website data could fill
      if (!enhancedAnalysis.story.businessSummary.includes(websiteAnalysis.valueProposition)) {
        enhancedAnalysis.story.businessSummary += `\n\nAdditional information from website: ${websiteAnalysis.valueProposition}`;
      }
    }
  }
  
  // Products/Services Enhancement
  if (enhancedAnalysis.story && websiteAnalysis.productsServices) {
    if (!enhancedAnalysis.story.businessModel || 
        enhancedAnalysis.story.businessModel.length < 50) {
      enhancedAnalysis.story.businessModel = `The business offers the following products/services: ${websiteAnalysis.productsServices.join(", ")}`;
    }
  }
  
  // Market Analysis Enhancement
  if (enhancedAnalysis.marketAnalysis && websiteAnalysis.targetMarket) {
    if (!enhancedAnalysis.marketAnalysis.customerProfile || 
        enhancedAnalysis.marketAnalysis.customerProfile.length < 50) {
      enhancedAnalysis.marketAnalysis.customerProfile = websiteAnalysis.targetMarket;
    }
  }
  
  // Business Strengths Enhancement
  if (enhancedAnalysis.marketAnalysis && websiteAnalysis.marketDifferentiators) {
    if (!enhancedAnalysis.marketAnalysis.strengths || 
        enhancedAnalysis.marketAnalysis.strengths.length === 0) {
      enhancedAnalysis.marketAnalysis.strengths = websiteAnalysis.marketDifferentiators;
    } 
    else {
      // Add unique differentiators not already included
      websiteAnalysis.marketDifferentiators.forEach((differentiator: string) => {
        if (!enhancedAnalysis.marketAnalysis.strengths.some((s: string) => 
            s.toLowerCase().includes(differentiator.toLowerCase()))) {
          enhancedAnalysis.marketAnalysis.strengths.push(differentiator);
        }
      });
    }
  }
  
  // Team Structure Enhancement
  if (enhancedAnalysis.team && websiteAnalysis.teamStructure) {
    if (!enhancedAnalysis.team.employeeSummary || 
        enhancedAnalysis.team.employeeSummary.length < 50) {
      enhancedAnalysis.team.employeeSummary = websiteAnalysis.teamStructure;
    }
  }
  
  // Company History Enhancement
  if (enhancedAnalysis.story && websiteAnalysis.companyHistory) {
    if (!enhancedAnalysis.story.growthHistory || 
        enhancedAnalysis.story.growthHistory.length < 50) {
      enhancedAnalysis.story.growthHistory = websiteAnalysis.companyHistory;
    }
  }
  
  // Technologies Used (Add to assets or unique features)
  if (websiteAnalysis.technologiesUsed && websiteAnalysis.technologiesUsed.length > 0) {
    if (enhancedAnalysis.marketAnalysis && enhancedAnalysis.marketAnalysis.uniqueFeatures) {
      websiteAnalysis.technologiesUsed.forEach((tech: string) => {
        if (!enhancedAnalysis.marketAnalysis.uniqueFeatures.some((f: string) => 
            f.toLowerCase().includes(tech.toLowerCase()))) {
          enhancedAnalysis.marketAnalysis.uniqueFeatures.push(`Uses advanced technology: ${tech}`);
        }
      });
    }
    
    if (enhancedAnalysis.assets && enhancedAnalysis.assets.digitalAssets) {
      websiteAnalysis.technologiesUsed.forEach((tech: string) => {
        if (!enhancedAnalysis.assets.digitalAssets.some((a: string) => 
            a.toLowerCase().includes(tech.toLowerCase()))) {
          enhancedAnalysis.assets.digitalAssets.push(tech);
        }
      });
    }
  }
  
  return enhancedAnalysis;
}
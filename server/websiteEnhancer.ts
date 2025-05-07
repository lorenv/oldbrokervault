/**
 * Website enhancer module for CIM generator
 * 
 * Adds robust website data processing and error handling
 */

import { analyzeWebsite } from "./website-analyzer";

/**
 * Process and enhance CIM analysis with website data
 * Returns the enhanced analysis with detailed error handling
 */
export async function enhanceWithWebsiteData(analysis: any, websiteUrl: string): Promise<any> {
  console.log(`Enhancing CIM with website data from: ${websiteUrl}`);
  
  if (!analysis || typeof analysis !== 'object') {
    console.error("Cannot enhance invalid analysis object");
    throw new Error("Invalid analysis object provided");
  }
  
  if (!websiteUrl || websiteUrl.trim() === '') {
    console.error("Empty website URL provided");
    return analysis; // Return unmodified analysis
  }
  
  try {
    // Analyze website and get structured data
    console.log(`Starting website analysis for ${websiteUrl}`);
    const websiteData = await analyzeWebsite(websiteUrl);
    console.log("Website analysis completed successfully");
    
    // Create a deep clone of the analysis to avoid mutation issues
    // First, ensure the analysis can be serialized
    try {
      // First attempt to stringify to validate
      JSON.stringify(analysis);
      
      // If successful, create a deep clone
      const enhancedAnalysis = JSON.parse(JSON.stringify(analysis));
      
      // Add website data to the enhanced analysis
      enhancedAnalysis.website = websiteData;
      
      // Validate that the resulting object can be properly serialized
      try {
        JSON.stringify(enhancedAnalysis);
        console.log("Enhanced analysis successfully validated");
        return enhancedAnalysis;
      } catch (jsonError) {
        console.error("JSON validation failed for enhanced analysis:", jsonError);
        throw new Error("Enhanced analysis failed JSON validation");
      }
    } catch (cloneError) {
      console.error("Error cloning analysis:", cloneError);
      throw new Error("Failed to serialize the analysis object");
    }
  } catch (error) {
    console.error("Website enhancement error:", error instanceof Error ? error.message : String(error));
    // Return the original analysis if enhancement fails
    return analysis;
  }
}
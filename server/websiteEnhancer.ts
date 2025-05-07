/**
 * Website enhancer module for CIM generator
 * 
 * Uses AI to analyze website content and integrate it with transcript information
 * to create a more comprehensive CIM document
 * 
 * IMPORTANT: This module uses ONLY AI (Perplexity) to analyze websites,
 * avoiding any HTML parsing or scraping that could cause JSON parsing errors.
 */

import fetch from 'node-fetch';

// Remove the import to website-analyzer.ts completely!

/**
 * Analyze website content with Perplexity AI
 */
async function analyzeWebsiteWithAI(websiteUrl: string) {
  try {
    console.log(`Analyzing website with AI: ${websiteUrl}`);
    
    // Verify API key is present
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("Missing PERPLEXITY_API_KEY environment variable");
      throw new Error("Perplexity API key is missing");
    }
    
    // Make the API request to Perplexity
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You analyze websites and extract business information. Return a structured JSON response with the following fields: companyName, businessDescription, teamInfo, servicesInfo. For any field where you can't find information, return an empty string."
          },
          {
            role: "user",
            content: `Please analyze this website URL: ${websiteUrl}. Extract the company name, business description, team information, and services offered. Respond with a JSON object containing only these fields.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });
    
    // Parse the response
    const responseData = await response.json() as any;
    console.log("AI analysis response received");
    
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error("Invalid response from Perplexity API", responseData);
      throw new Error("Invalid AI response format");
    }

    // Extract the AI response
    const aiContent = responseData.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const websiteData = JSON.parse(aiContent);
      console.log("Successfully parsed AI response");
      return websiteData;
    } catch (jsonError) {
      console.error("Failed to parse AI response as JSON:", aiContent);
      throw new Error("AI response is not valid JSON");
    }
    
  } catch (error) {
    console.error("Error in AI website analysis:", error);
    // Return a basic structure if analysis fails
    return {
      companyName: "",
      businessDescription: "",
      teamInfo: "",
      servicesInfo: ""
    };
  }
}

/**
 * Integrate website information with transcript analysis
 * Creates a comprehensive CIM by combining both data sources
 */
async function integrateWebsiteWithTranscript(analysis: any, websiteData: any, transcript: string) {
  try {
    console.log("Integrating website data with transcript analysis");
    
    // Verify API key is present
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("Missing PERPLEXITY_API_KEY environment variable");
      throw new Error("Perplexity API key is missing");
    }
    
    // Create a context combining both sources of information
    const websiteContext = `
WEBSITE INFORMATION:
Company Name: ${websiteData.companyName || ""}
Business Description: ${websiteData.businessDescription || ""}
Team Information: ${websiteData.teamInfo || ""}
Services Information: ${websiteData.servicesInfo || ""}
`;
    
    // Create a summary of the original analysis to keep the request size manageable
    let analysisContext = '';
    try {
      if (analysis.story) {
        analysisContext += `
TRANSCRIPT INFORMATION:
Business Started: ${analysis.story.yearStarted || ""}
Business Idea: ${analysis.story.businessIdea || ""}
Business Model: ${analysis.story.businessModel || ""}
Order Process: ${analysis.story.orderProcess || ""}
Growth History: ${analysis.story.growthHistory || ""}
Business Structure: ${analysis.story.businessStructure || ""}
`;
      }
      
      if (analysis.marketAnalysis) {
        analysisContext += `
Market Information:
Customer Profile: ${analysis.marketAnalysis.customerProfile || ""}
Competitors: ${Array.isArray(analysis.marketAnalysis.competitors) ? analysis.marketAnalysis.competitors.join(", ") : ""}
Strengths: ${Array.isArray(analysis.marketAnalysis.strengths) ? analysis.marketAnalysis.strengths.join(", ") : ""}
`;
      }
    } catch (err) {
      console.error("Error preparing analysis context:", err);
      analysisContext = "Error extracting transcript information";
    }
    
    // Make the API request to integrate the information
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst who creates Confidential Information Memorandums (CIMs) for business sales. Create enhanced CIM content by integrating website information with transcript data. Where information conflicts, prioritize transcript data but use website data for additional context and details."
          },
          {
            role: "user",
            content: `I have information from two sources about a business:

${websiteContext}

${analysisContext}

Please integrate this information to enhance the CIM. For any inconsistencies between sources, prioritize the transcript data but enhance it with website details. Return a JSON object that enhances the story and marketing sections with combined insights from both sources. Format as:
{
  "enhancedStory": {
    "businessSummary": "",
    "businessModel": "",
    "ownerBackground": ""
  },
  "enhancedMarket": {
    "customerProfile": "",
    "uniqueFeatures": []
  },
  "recommendedHighlights": []
}
`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });
    
    // Parse the response
    const responseData = await response.json() as any;
    
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error("Invalid response from Perplexity API during integration", responseData);
      throw new Error("Invalid AI response format");
    }

    // Extract the integrated content
    const aiContent = responseData.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const integratedData = JSON.parse(aiContent);
      console.log("Successfully integrated website and transcript data");
      return integratedData;
    } catch (jsonError) {
      console.error("Failed to parse integrated response as JSON:", aiContent);
      throw new Error("Integrated response is not valid JSON");
    }
  } catch (error) {
    console.error("Integration error:", error);
    return null;
  }
}

/**
 * Process and enhance CIM analysis with website data
 * Returns the enhanced analysis with detailed error handling
 * Now using AI to analyze website content and integrate it with transcript data
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
    // Step 1: Analyze the website
    const websiteData = await analyzeWebsiteWithAI(websiteUrl);
    console.log("Website AI analysis completed successfully");
    
    // Create a deep clone of the analysis
    const enhancedAnalysis = JSON.parse(JSON.stringify(analysis));
    
    // Step 2: Store raw website data for reference
    enhancedAnalysis.website = {
      websiteUrl,
      companyName: websiteData.companyName || "",
      content: {
        businessDescription: websiteData.businessDescription || "",
        teamInfo: websiteData.teamInfo || "",
        servicesInfo: websiteData.servicesInfo || ""
      }
    };
    
    // Step 3: Integrate website data with transcript analysis
    // This is the key enhancement that combines both data sources
    const integratedData = await integrateWebsiteWithTranscript(analysis, websiteData, "");
    
    if (integratedData) {
      console.log("Integration successful, enhancing CIM with combined insights");
      
      // Step 4: Enhance the analysis with the integrated data
      if (integratedData.enhancedStory) {
        // Add enhanced business summary to the executive summary
        if (enhancedAnalysis.executiveSummary && integratedData.enhancedStory.businessSummary) {
          enhancedAnalysis.executiveSummary.businessSummary = integratedData.enhancedStory.businessSummary;
        }
        
        // Enhance the story section
        if (enhancedAnalysis.story) {
          if (integratedData.enhancedStory.businessModel) {
            enhancedAnalysis.story.businessModel = integratedData.enhancedStory.businessModel;
          }
          
          if (integratedData.enhancedStory.businessSummary) {
            enhancedAnalysis.story.businessSummary = integratedData.enhancedStory.businessSummary;
          }
        }
      }
      
      // Enhance market analysis
      if (integratedData.enhancedMarket && enhancedAnalysis.marketAnalysis) {
        if (integratedData.enhancedMarket.customerProfile) {
          enhancedAnalysis.marketAnalysis.customerProfile = integratedData.enhancedMarket.customerProfile;
        }
        
        if (integratedData.enhancedMarket.uniqueFeatures && 
            Array.isArray(integratedData.enhancedMarket.uniqueFeatures) && 
            integratedData.enhancedMarket.uniqueFeatures.length > 0) {
          enhancedAnalysis.marketAnalysis.uniqueFeatures = integratedData.enhancedMarket.uniqueFeatures;
        }
      }
      
      // Add recommended highlights to executive summary
      if (integratedData.recommendedHighlights && 
          Array.isArray(integratedData.recommendedHighlights) && 
          integratedData.recommendedHighlights.length > 0 &&
          enhancedAnalysis.executiveSummary) {
        enhancedAnalysis.executiveSummary.integratedHighlights = integratedData.recommendedHighlights;
      }
    }
    
    console.log("Enhanced and integrated CIM analysis successfully created");
    return enhancedAnalysis;
  } catch (error) {
    console.error("Website enhancement error:", error instanceof Error ? error.message : String(error));
    // Return the original analysis if enhancement fails
    return analysis;
  }
}
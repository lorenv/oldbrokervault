/**
 * AI-powered website analyzer for CIM generator
 * 
 * This module uses Perplexity AI to analyze websites and enhance CIM data
 * WITHOUT any HTML parsing to avoid JSON errors.
 */

import fetch from 'node-fetch';

/**
 * Analyze a website using Perplexity AI
 * @param websiteUrl The URL of the website to analyze
 * @returns Website information extracted by AI
 */
async function analyzeWebsiteWithAI(websiteUrl: string) {
  console.log(`AI analyzing website: ${websiteUrl}`);
  
  try {
    // Verify API key is present
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("Missing PERPLEXITY_API_KEY");
      throw new Error("Perplexity API key is required for website analysis");
    }
    
    // Make request to Perplexity API
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
    
    // Parse response
    const responseData = await response.json() as any;
    
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error("Invalid Perplexity API response:", responseData);
      throw new Error("Invalid AI response format");
    }
    
    // Extract content
    const aiContent = responseData.choices[0].message.content;
    
    try {
      // Parse JSON response
      const websiteData = JSON.parse(aiContent);
      console.log("Successfully parsed AI website analysis");
      return websiteData;
    } catch (error) {
      console.error("Failed to parse AI response as JSON:", error);
      throw new Error("AI response is not valid JSON");
    }
    
  } catch (error) {
    console.error("Error in AI website analysis:", error);
    return {
      companyName: "Unknown",
      businessDescription: "",
      teamInfo: "",
      servicesInfo: ""
    };
  }
}

/**
 * Integrate website information with CIM analysis
 * @param analysis The CIM analysis from transcript
 * @param websiteData The website data from AI analysis
 * @returns Enhanced and integrated analysis
 */
async function integrateData(analysis: any, websiteData: any) {
  console.log("Integrating website data with CIM analysis");
  
  try {
    // Verify API key is present
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("Missing PERPLEXITY_API_KEY");
      throw new Error("Perplexity API key is required for data integration");
    }
    
    // Create context for website data
    const websiteContext = `
WEBSITE INFORMATION:
Company Name: ${websiteData.companyName || "Unknown"}
Business Description: ${websiteData.businessDescription || ""}
Team Information: ${websiteData.teamInfo || ""}
Services Information: ${websiteData.servicesInfo || ""}
`;
    
    // Extract relevant CIM analysis
    let analysisContext = "";
    
    try {
      if (analysis.story) {
        analysisContext += `
TRANSCRIPT INFORMATION:
Business Started: ${analysis.story.yearStarted || ""}
Business Idea: ${analysis.story.businessIdea || ""}
Business Model: ${analysis.story.businessModel || ""}
Growth History: ${analysis.story.growthHistory || ""}
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
    } catch (error) {
      console.error("Error preparing analysis context:", error);
      analysisContext = "Error extracting transcript information";
    }
    
    // Make integration request to Perplexity
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
}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });
    
    // Parse response
    const responseData = await response.json() as any;
    
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error("Invalid Perplexity API response for integration:", responseData);
      throw new Error("Invalid AI integration response format");
    }
    
    // Extract content
    const aiContent = responseData.choices[0].message.content;
    
    try {
      // Parse JSON response
      const integratedData = JSON.parse(aiContent);
      console.log("Successfully parsed AI integration data");
      return integratedData;
    } catch (error) {
      console.error("Failed to parse integration response as JSON:", error);
      throw new Error("Integration response is not valid JSON");
    }
    
  } catch (error) {
    console.error("Error integrating data:", error);
    return null;
  }
}

/**
 * Main function to enhance CIM analysis with website data
 * @param analysis The CIM analysis from transcript
 * @param websiteUrl The URL of the website to analyze
 * @returns Enhanced analysis with integrated website information
 */
export async function enhanceCimWithWebsite(analysis: any, websiteUrl: string): Promise<any> {
  console.log(`Enhancing CIM with website: ${websiteUrl}`);
  
  // Input validation
  if (!analysis || typeof analysis !== 'object') {
    console.error("Invalid analysis object provided");
    throw new Error("Valid analysis object required");
  }
  
  if (!websiteUrl || websiteUrl.trim() === '') {
    console.error("Empty website URL provided");
    return analysis; // Return unmodified analysis
  }
  
  try {
    // Step 1: Analyze website with AI
    const websiteData = await analyzeWebsiteWithAI(websiteUrl);
    console.log("Website analysis complete");
    
    // Create deep clone of analysis to avoid mutations
    const enhancedAnalysis = JSON.parse(JSON.stringify(analysis));
    
    // Step 2: Add raw website data to analysis
    enhancedAnalysis.website = {
      url: websiteUrl,
      companyName: websiteData.companyName || "",
      businessDescription: websiteData.businessDescription || "",
      teamInfo: websiteData.teamInfo || "",
      servicesInfo: websiteData.servicesInfo || ""
    };
    
    // Step 3: Integrate website data with transcript analysis
    const integrated = await integrateData(analysis, websiteData);
    
    if (integrated) {
      console.log("Successfully integrated website and transcript data");
      
      // Step 4: Enhance analysis with integrated data
      if (integrated.enhancedStory) {
        // Add to executive summary
        if (enhancedAnalysis.executiveSummary && integrated.enhancedStory.businessSummary) {
          enhancedAnalysis.executiveSummary.businessSummary = integrated.enhancedStory.businessSummary;
        }
        
        // Enhance story section
        if (enhancedAnalysis.story) {
          if (integrated.enhancedStory.businessModel) {
            enhancedAnalysis.story.businessModel = integrated.enhancedStory.businessModel;
          }
          if (integrated.enhancedStory.businessSummary) {
            enhancedAnalysis.story.businessSummary = integrated.enhancedStory.businessSummary;
          }
        }
      }
      
      // Enhance market analysis
      if (integrated.enhancedMarket && enhancedAnalysis.marketAnalysis) {
        if (integrated.enhancedMarket.customerProfile) {
          enhancedAnalysis.marketAnalysis.customerProfile = integrated.enhancedMarket.customerProfile;
        }
        
        if (integrated.enhancedMarket.uniqueFeatures && 
            Array.isArray(integrated.enhancedMarket.uniqueFeatures) && 
            integrated.enhancedMarket.uniqueFeatures.length > 0) {
          enhancedAnalysis.marketAnalysis.uniqueFeatures = integrated.enhancedMarket.uniqueFeatures;
        }
      }
      
      // Add highlights to executive summary
      if (integrated.recommendedHighlights && 
          Array.isArray(integrated.recommendedHighlights) && 
          integrated.recommendedHighlights.length > 0 &&
          enhancedAnalysis.executiveSummary) {
        enhancedAnalysis.executiveSummary.integratedHighlights = integrated.recommendedHighlights;
      }
    }
    
    console.log("Enhanced analysis created successfully");
    return enhancedAnalysis;
    
  } catch (error) {
    console.error("Website enhancement error:", error);
    // Return original analysis if enhancement fails
    return analysis;
  }
}
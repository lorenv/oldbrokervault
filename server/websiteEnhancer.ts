/**
 * Website enhancer module for CIM generator
 * 
 * Directly uses AI to analyze website content instead of parsing HTML
 */

import fetch from 'node-fetch';

// Use Perplexity or OpenAI to analyze the website content
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
    const responseData = await response.json();
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
 * Process and enhance CIM analysis with website data
 * Returns the enhanced analysis with detailed error handling
 * Now using AI to analyze website content directly
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
    // Now directly using AI to analyze the website
    const websiteData = await analyzeWebsiteWithAI(websiteUrl);
    console.log("Website AI analysis completed successfully");
    
    // Create a deep clone of the analysis
    const enhancedAnalysis = JSON.parse(JSON.stringify(analysis));
    
    // Add website data to the enhanced analysis
    enhancedAnalysis.website = {
      websiteUrl,
      companyName: websiteData.companyName || "",
      content: {
        businessDescription: websiteData.businessDescription || "",
        teamInfo: websiteData.teamInfo || "",
        servicesInfo: websiteData.servicesInfo || ""
      }
    };
    
    console.log("Enhanced analysis successfully created");
    return enhancedAnalysis;
  } catch (error) {
    console.error("Website enhancement error:", error instanceof Error ? error.message : String(error));
    // Return the original analysis if enhancement fails
    return analysis;
  }
}
/**
 * Very Simple Website Analyzer
 * 
 * Makes a clean, direct request to Perplexity to analyze a website
 * without trying to fetch the website content ourselves.
 * Perplexity has built-in web browsing capabilities.
 */

import fetch from 'node-fetch';

/**
 * Simple type for Perplexity response
 */
type PerplexityResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

/**
 * Ask Perplexity to analyze a website URL and generate a CIM directly
 * @param transcript The business interview transcript
 * @param websiteUrl The URL of the website to analyze
 * @returns A complete CIM based on both sources
 */
export async function generateCIM(transcript: string, websiteUrl: string): Promise<any> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }

  console.log(`Starting very simple analysis for URL: ${websiteUrl}`);

  // Create system prompt that ensures we get properly structured output
  const systemPrompt = `You are an expert in creating Confidential Information Memorandums (CIMs) for business sales.
I will provide:
1. A transcript from an interview with the business owner
2. A URL to the business website - you will analyze this website directly

Create a comprehensive CIM by integrating information from both sources.
Return your response in valid JSON format with this structure:

{
  "story": {
    "yearStarted": "",
    "businessIdea": "",
    "businessModel": "",
    "orderProcess": "",
    "growthHistory": "",
    "businessStructure": "",
    "businessSummary": "",
    "keyAttractions": [],
    "saleReason": ""
  },
  "executiveSummary": {
    "buyerAttractions": [],
    "growthOpportunities": []
  },
  "assets": {
    "digitalAssets": [],
    "location": "",
    "equipmentValue": "",
    "equipmentDetails": "",
    "inventoryDetails": ""
  },
  "ownership": {
    "owners": [
      {
        "name": "",
        "percentage": "",
        "background": ""
      }
    ],
    "intellectualProperty": []
  },
  "marketAnalysis": {
    "uniqueFeatures": [],
    "customerProfile": "",
    "saleReason": "",
    "competitors": [],
    "strengths": []
  },
  "operations": {
    "suppliers": {
      "count": "",
      "transferability": "",
      "concentration": "",
      "terms": "",
      "replaceability": ""
    },
    "customers": {
      "recurring": "",
      "relationships": "",
      "concentration": "",
      "contracts": "",
      "replaceability": ""
    }
  },
  "inventory": {
    "leadTime": "",
    "sourcing": "",
    "storage": "",
    "value": "",
    "skuCount": "",
    "topProducts": []
  },
  "sales": {
    "channels": {},
    "seasonality": "",
    "averageOrderValue": "",
    "competitivePricing": "",
    "pricingModel": "",
    "paymentMethods": [],
    "contractTerms": ""
  },
  "marketing": {
    "strategies": [],
    "paidAdvertising": {
      "channels": [],
      "effectiveness": ""
    },
    "emailMarketing": {
      "listSize": "",
      "usage": ""
    },
    "seoEfforts": "",
    "clientAcquisition": ""
  },
  "team": {
    "ownerResponsibilities": "",
    "ownerHours": "",
    "employeeSummary": "",
    "employeeCount": "",
    "contractorCount": "",
    "turnover": "",
    "hiring": "",
    "retention": "",
    "organization": "",
    "keyEmployees": [],
    "management": ""
  },
  "facility": {
    "ownership": "",
    "size": "",
    "cost": "",
    "leaseDetails": ""
  }
}

If information is missing, leave the field empty (empty string or empty array).
Where there are discrepancies between sources, prioritize the transcript information.
Make ABSOLUTELY SURE that your response is valid parseable JSON.`;

  const userPrompt = `BUSINESS INTERVIEW TRANSCRIPT:
${transcript}

BUSINESS WEBSITE URL:
${websiteUrl}

Please analyze this website and create a comprehensive CIM by integrating information from both the transcript and the website.`;

  // Create messages array
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    console.log("Sending request to Perplexity API...");
    
    // Make the API request with strict settings to ensure good JSON
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages,
        temperature: 0.1, // Keep temperature low for consistency
        max_tokens: 4000,
        response_format: { type: "json_object" } // Critical setting for JSON output
      })
    });

    // Handle API response errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    // Parse the response
    const result = await response.json() as PerplexityResponse;
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('Unexpected Perplexity API response structure:', result);
      throw new Error('Invalid response format from Perplexity API');
    }

    // Get content as string and parse to JSON
    const content = result.choices[0].message.content;
    
    // Log a comprehensive debug output
    console.log("=== RAW PERPLEXITY RESPONSE ===");
    console.log("Content type:", typeof content);
    console.log("Content length:", content.length);
    console.log("First 100 chars:", content.substring(0, 100));
    console.log("=== END RAW RESPONSE ===");
    
    // Check if content starts with HTML-like content (a common issue)
    if (content.trim().startsWith('<')) {
      console.error('ERROR: Content appears to start with HTML tags');
      console.error('Content preview:', content.substring(0, 200));
      
      // Try to extract JSON from HTML if it exists
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('Attempting to extract embedded JSON from response...');
        try {
          const extractedJson = jsonMatch[0];
          const cimData = JSON.parse(extractedJson);
          console.log('Successfully extracted and parsed JSON from response');
          return cimData;
        } catch (extractError) {
          console.error('Failed to extract JSON:', extractError);
        }
      }
      
      // If extraction failed, throw a more specific error
      throw new Error('Perplexity returned HTML instead of JSON. Request failed.');
    }
    
    try {
      console.log("Parsing API response as JSON...");
      
      // We expect this to be a JSON string that needs parsing
      const cimData = JSON.parse(content);
      
      console.log("Successfully generated CIM with website data");
      return cimData;
    } catch (parseError) {
      console.error('Error parsing API response as JSON:', parseError);
      console.error('Raw content preview:', content.substring(0, 500) + '...');
      
      // Create a fallback response to avoid complete failure
      console.log('Creating safe fallback response...');
      return {
        story: {
          businessSummary: "Failed to generate CIM using website data. Please try again without a website URL.",
          yearStarted: "",
          businessIdea: "",
          businessModel: "",
          orderProcess: "",
          growthHistory: "",
          businessStructure: "",
          keyAttractions: [],
          saleReason: ""
        },
        // Include minimal structure to avoid frontend errors
        executiveSummary: { buyerAttractions: [], growthOpportunities: [] },
        assets: { digitalAssets: [], location: "", equipmentValue: "", equipmentDetails: "", inventoryDetails: "" },
        ownership: { owners: [], intellectualProperty: [] },
        marketAnalysis: { uniqueFeatures: [], customerProfile: "", saleReason: "", competitors: [], strengths: [] },
        operations: { 
          suppliers: { count: "", transferability: "", concentration: "", terms: "", replaceability: "" },
          customers: { recurring: "", relationships: "", concentration: "", contracts: "", replaceability: "" }
        },
        inventory: { leadTime: "", sourcing: "", storage: "", value: "", skuCount: "", topProducts: [] },
        sales: { seasonality: "", averageOrderValue: "", competitivePricing: "", pricingModel: "", paymentMethods: [], contractTerms: "" },
        marketing: { 
          strategies: [], 
          paidAdvertising: { channels: [], effectiveness: "" },
          emailMarketing: { listSize: "", usage: "" },
          seoEfforts: "",
          clientAcquisition: ""
        },
        team: {
          ownerResponsibilities: "",
          ownerHours: "",
          employeeSummary: "",
          employeeCount: "",
          contractorCount: "",
          turnover: "",
          hiring: "",
          retention: "",
          organization: "",
          keyEmployees: [],
          management: ""
        },
        facility: { ownership: "", size: "", cost: "", leaseDetails: "" }
      };
    }
  } catch (error) {
    console.error('Error generating CIM:', error);
    throw error;
  }
}
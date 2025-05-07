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
  const systemPrompt = `You are an advanced AI specialized in business analysis and website data extraction.
You must produce a structured JSON response EXACTLY following the format specified below.

CRITICAL INSTRUCTIONS:
1. Your response MUST be a valid JSON object ONLY
2. Do not include any explanations, markdown formatting, or non-JSON content
3. Do not wrap the JSON in code blocks, quotes, or any other characters
4. STRICTLY follow the structure provided in the template
5. Return ONLY the JSON object - nothing else will be accepted

I will provide:
1. A transcript from an interview with a business owner
2. A URL to the business website - you will analyze this website directly

Create a comprehensive Confidential Information Memorandum (CIM) by integrating information from both sources.
Use the exact JSON structure below:

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

IMPORTANT GUIDELINES:
- If information is missing, use empty strings or empty arrays - never omit fields
- Where there are discrepancies between sources, prioritize the transcript information
- NEVER include HTML, markdown formatting, or explanatory text
- NEVER use non-JSON compatible characters or formatting
- NEVER include any text before or after the JSON object
- The response must be 100% parseable as JSON

Your entire response must be exactly one valid JSON object.`;

  const userPrompt = `BUSINESS INTERVIEW TRANSCRIPT:
${transcript}

BUSINESS WEBSITE URL:
${websiteUrl}

Create a valid JSON object with the CIM data from analyzing this transcript and website.
IMPORTANT: Your response MUST be valid JSON only. Do not include any explanatory text, markdown, or HTML.`;

  // Create messages array
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    console.log("Sending request to Perplexity API...");
    
    // Make the API request with strict settings to ensure good JSON
    console.log("Sending request to Perplexity with these settings:");
    const requestBody = {
      model: "llama-3.1-sonar-small-128k-online",
      messages,
      temperature: 0.1, // Keep temperature low for consistency
      max_tokens: 4000,
      response_format: { type: "json_object" } // Critical setting for JSON output
    };
    
    console.log("Request body (shortened):", {
      ...requestBody,
      messages: [
        { role: "system", content: "System prompt (truncated for logging)" },
        { role: "user", content: "User prompt (truncated for logging)" }
      ]
    });
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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
    
    // Try to clean any non-JSON wrapping content
    let processedContent = content;
    
    // Handle potential markdown fences
    if (processedContent.includes('```json')) {
      console.log('Detected markdown code block, attempting to extract JSON...');
      const matches = processedContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (matches && matches[1]) {
        processedContent = matches[1].trim();
        console.log('Extracted JSON from markdown code block');
      }
    } else if (processedContent.includes('```')) {
      console.log('Detected generic code block, attempting to extract content...');
      const matches = processedContent.match(/```\s*([\s\S]*?)\s*```/);
      if (matches && matches[1]) {
        processedContent = matches[1].trim();
        console.log('Extracted content from code block');
      }
    }
    
    // Check if content starts with or contains HTML-like content 
    if (processedContent.includes('<') && processedContent.includes('>')) {
      console.error('ERROR: Content appears to contain HTML tags');
      console.error('Content preview:', processedContent.substring(0, 200));
      
      // Try to extract JSON from content if it exists
      const jsonMatch = processedContent.match(/\{[\s\S]*?\}/);
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
      throw new Error('Perplexity response contained HTML instead of clean JSON. Request failed.');
    }
    
    // Check for leading/trailing non-JSON content
    if (!processedContent.trim().startsWith('{')) {
      console.log('Content does not start with {, attempting to find JSON object...');
      const jsonMatch = processedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        processedContent = jsonMatch[0];
        console.log('Extracted JSON object from response');
      }
    }
    
    try {
      console.log("Parsing processed API response as JSON...");
      
      // Try to parse the processed content first (if we did any cleaning)
      if (processedContent !== content) {
        try {
          console.log("Attempting to parse cleaned content...");
          const cimData = JSON.parse(processedContent);
          console.log("Successfully parsed cleaned content");
          return cimData;
        } catch (cleanedError) {
          console.error("Failed to parse cleaned content, falling back to original:", cleanedError.message);
          // Fall through to try the original content
        }
      }
      
      // Try the original content as a fallback
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
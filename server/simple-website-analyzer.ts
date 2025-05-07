/**
 * Simple Website Analyzer
 * 
 * Uses Perplexity to extract website information and combine it with
 * transcript data to create a well-rounded CIM. This approach focuses
 * purely on text analysis without images or HTML parsing.
 */

import fetch from 'node-fetch';

/**
 * Extract information from a website using Perplexity
 * @param websiteUrl URL of the website to analyze
 * @returns Text analysis of the website content
 */
export async function analyzeWebsite(websiteUrl: string): Promise<string> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }

  console.log(`Analyzing website with Perplexity: ${websiteUrl}`);

  // Simple prompt to extract information from a website
  const messages = [
    {
      role: "system",
      content: "You are an expert at analyzing business websites. Extract key information from the website URL provided."
    },
    {
      role: "user",
      content: `Analyze this business website: ${websiteUrl}
        
Visit the URL and provide a comprehensive analysis of the business.
Include:
1. Company name and basic description
2. Products or services offered
3. Target customer base
4. Company's value proposition
5. Any information about the team or founders
6. Geographic locations or service areas

Focus on factual information only. Be concise yet comprehensive.`
    }
  ];

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages,
        temperature: 0.1,
        max_tokens: 1500,
        search_domain_filter: [],
        return_images: false,
        return_related_questions: false,
        search_recency_filter: "month"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('Unexpected Perplexity API response:', result);
      throw new Error('Invalid response format from Perplexity API');
    }

    // Extract the text content
    const websiteAnalysis = result.choices[0].message.content;
    console.log('Successfully analyzed website content');
    return websiteAnalysis;
    
  } catch (error) {
    console.error('Error analyzing website:', error);
    throw error;
  }
}

/**
 * Combine transcript analysis with website information
 * @param transcript Transcript of business interview
 * @param websiteAnalysis Analysis from the website
 * @returns Combined analysis
 */
export async function combineInformation(transcript: string, websiteAnalysis: string): Promise<any> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }

  console.log('Combining transcript and website information');

  const messages = [
    {
      role: "system",
      content: `You are an expert in creating Confidential Information Memorandums (CIMs) for business sales.
I will provide:
1. A transcript from an interview with the business owner
2. An analysis of the business website

Create a comprehensive CIM by integrating both sources. Return your response in the following JSON format:

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

If information is missing, leave that field empty (empty string or empty array).
Where there are discrepancies between the sources, prioritize the transcript information but use website details to enhance and supplement.`
    },
    {
      role: "user",
      content: `TRANSCRIPT:
${transcript}

WEBSITE ANALYSIS:
${websiteAnalysis}

Create a comprehensive CIM by integrating both sources.`
    }
  ];

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('Unexpected Perplexity API response:', result);
      throw new Error('Invalid response format from Perplexity API');
    }

    // Extract the JSON content
    const content = result.choices[0].message.content;
    
    try {
      // Parse the returned content as JSON
      const combinedAnalysis = JSON.parse(content);
      console.log('Successfully combined transcript and website information');
      return combinedAnalysis;
    } catch (parseError) {
      console.error('Error parsing API response as JSON:', parseError);
      console.error('Raw content:', content.substring(0, 500) + '...');
      throw new Error('Could not parse Perplexity response as JSON');
    }
    
  } catch (error) {
    console.error('Error combining information:', error);
    throw error;
  }
}

/**
 * Complete website analysis and integration process
 * @param transcript Transcript of business interview
 * @param websiteUrl URL of the business website
 * @returns Enhanced CIM analysis
 */
export async function generateEnhancedCIM(transcript: string, websiteUrl: string): Promise<any> {
  console.log(`Generating enhanced CIM with website: ${websiteUrl}`);
  
  try {
    // Step 1: Analyze website to get text information
    const websiteAnalysis = await analyzeWebsite(websiteUrl);
    
    // Step 2: Combine transcript with website information
    const enhancedAnalysis = await combineInformation(transcript, websiteAnalysis);
    
    return enhancedAnalysis;
  } catch (error) {
    console.error('Error generating enhanced CIM:', error);
    throw error;
  }
}
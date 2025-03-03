// the newest Perplexity model is llama-3.1-sonar-small-128k-online, use this by default
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

type CimAnalysis = {
  story: {
    yearStarted: string;
    businessIdea: string;
    businessModel: string;
    orderProcess: string;
    growthHistory: string;
    businessStructure: string;
  },
  executiveSummary: {
    buyerAttractions: string[];
    growthOpportunities: string[];
  },
  assets: {
    digitalAssets: string[];
    location: string;
    equipmentValue: string;
  },
  ownership: {
    owners: Array<{
      name: string;
      percentage: string;
      background: string;
    }>;
    intellectualProperty: string[];
  },
  marketAnalysis: {
    uniqueFeatures: string[];
    customerProfile: string;
    saleReason: string;
    competitors: string[];
    strengths: string[];
  },
  operations: {
    suppliers: {
      count: string;
      transferability: string;
      concentration: string;
      terms: string;
      replaceability: string;
    };
    customers: {
      recurring: string;
      relationships: string;
      concentration: string;
      contracts: string;
      replaceability: string;
    };
  },
  inventory: {
    leadTime: string;
    sourcing: string;
    storage: string;
    value: string;
    skuCount: string;
    topProducts: string[];
  },
  sales: {
    channels?: Record<string, number>;
    seasonality: string;
    averageOrderValue: string;
    competitivePricing: string;
    pricingModel: string;
    paymentMethods: string[];
  },
  marketing: {
    strategies: string[];
    paidAdvertising: {
      channels: string[];
      effectiveness: string;
    };
    emailMarketing: {
      listSize: string;
      usage: string;
    };
    seoEfforts: string;
  },
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    employees: Array<{
      role: string;
      status: string;
      compensation: string;
      tenure?: string;
    }>;
    turnover: string;
    hiring: string;
    retention: string;
    organization: string;
    keyEmployees: string[];
    management: string;
  },
  facility: {
    ownership: string;
    size: string;
    cost: string;
    leaseDetails?: string;
  }
};

async function makePerplexityRequest(messages: any[]): Promise<CimAnalysis> {
  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Perplexity API error:", {
        status: response.status,
        statusText: response.statusText,
        body: text
      });
      throw new Error(`Perplexity API error (${response.status}): ${text}`);
    }

    try {
      const data = await response.json();
      const contentStr = data.choices[0].message.content;

      // Log the entire response for debugging
      console.log("Perplexity API Response:", contentStr);

      // More robust JSON extraction approach
      let jsonContent = "";

      // First, try to find a JSON object with a more flexible regex
      const jsonMatches = contentStr.match(/\{[\s\S]*?\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Find the largest match which is likely the complete JSON
        jsonContent = jsonMatches.reduce((longest, current) => 
          current.length > longest.length ? current : longest, "");
      } else {
        // Try to extract JSON by looking for the start and end braces
        const startIdx = contentStr.indexOf('{');
        const endIdx = contentStr.lastIndexOf('}');

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonContent = contentStr.substring(startIdx, endIdx + 1);
        } else {
          throw new Error("No valid JSON structure found in response");
        }
      }

      try {
        // Clean up any markdown code block syntax if present
        jsonContent = jsonContent.replace(/```json|```/g, '').trim();
        console.log("Attempting to parse JSON:", jsonContent);

        const analysis = JSON.parse(jsonContent);

        // Validate required fields with detailed error reporting
        const requiredFields = ['story', 'marketAnalysis', 'team'];
        const missingFields = requiredFields.filter(field => !analysis[field]);

        if (missingFields.length > 0) {
          console.warn(`Analysis is missing fields: ${missingFields.join(', ')}. Creating placeholder values.`);

          // Add missing required fields with placeholder values
          if (!analysis.story) analysis.story = { 
            yearStarted: "Not specified in transcript",
            businessModel: "Not specified in transcript",
            growthHistory: "Not specified in transcript",
            businessStructure: "Not specified in transcript"
          };

          if (!analysis.marketAnalysis) analysis.marketAnalysis = {
            customerProfile: "Not specified in transcript",
            competitors: ["Not specified in transcript"],
            strengths: ["Not specified in transcript"]
          };

          if (!analysis.team) analysis.team = {
            ownerResponsibilities: "Not specified in transcript",
            ownerHours: "Not specified in transcript",
            management: "Not specified in transcript",
            employees: [{
              role: "Not specified",
              status: "Not specified",
              compensation: "Not specified"
            }]
          };
        }

        return analysis;
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Attempted to parse:", jsonContent);
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      }
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      throw new Error("Failed to parse JSON response");
    }
  } catch (error) {
    console.error("Failed to make Perplexity request:", error);
    throw error;
  }
}

export async function analyzeCimTranscript(transcript: string, directions?: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");

    // Check if API key is available
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("ERROR: Missing PERPLEXITY_API_KEY environment variable");
      throw new Error("Missing API key configuration");
    }

    const systemPrompt = directions || `You are a business analyst creating a CIM. Your ONLY response should be a valid JSON object with NO additional text, markdown formatting, or explanation.

REQUIRED FORMAT (all fields must be present):
{
  "story": {
    "yearStarted": "[year]",
    "businessModel": "[description]",
    "growthHistory": "[description]",
    "businessStructure": "[structure type]"
  },
  "marketAnalysis": {
    "customerProfile": "[description]",
    "competitors": ["competitor1", "competitor2"],
    "strengths": ["strength1", "strength2"]
  },
  "team": {
    "ownerResponsibilities": "[description]",
    "ownerHours": "[hours]",
    "management": "[description]",
    "employees": [
      {
        "role": "[role]",
        "status": "[status]",
        "compensation": "[amount]"
      }
    ]
  }
}

Extract the information from the transcript and fill in ALL the required fields. If information is not available, use "Not specified in transcript" as the value. Do not omit any fields.`;

    const result = await makePerplexityRequest([
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `Analyze this transcript and respond with ONLY the JSON object specified, no other text:\n\n${transcript}`
      }
    ]);

    console.log("Successfully analyzed transcript");
    return result;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
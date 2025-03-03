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

    const data = await response.json();
    const contentStr = data.choices[0].message.content;

    // Log the entire response for debugging
    console.log("Perplexity API Response:", contentStr);

    // Try to find a JSON object in the response
    const jsonMatches = contentStr.match(/\{[\s\S]*\}/);
    if (!jsonMatches) {
      throw new Error("No JSON object found in response");
    }

    try {
      const analysis = JSON.parse(jsonMatches[0]);

      // Validate required fields with detailed error reporting
      const requiredFields = ['story', 'marketAnalysis', 'team'];
      const missingFields = requiredFields.filter(field => !analysis[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      return analysis;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Attempted to parse:", jsonMatches[0]);
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Failed to make Perplexity request:", error);
    throw error;
  }
}

export async function analyzeCimTranscript(transcript: string, directions?: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");

    const systemPrompt = directions || `You are a business analyst creating a CIM. Return ONLY a JSON object with NO additional text or explanation.

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
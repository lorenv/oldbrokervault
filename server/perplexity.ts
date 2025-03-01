// the newest Perplexity model is "llama-3.1-sonar-small-128k-online", use this by default
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

type CimAnalysis = {
  story: {
    yearStarted: string;
    businessModel: string;
    growthHistory: string;
    businessStructure: string;
  };
  executiveSummary: {
    buyerAttractions: string[];
    growthOpportunities: string[];
  };
  marketAnalysis: {
    customerProfile: string;
    competitors: string[];
    strengths: string[];
  };
  operations: {
    customers: {
      recurring: string;
      relationships: string;
      concentration: string;
      contracts: string;
    };
    suppliers: {
      count: string;
      terms: string;
      concentration: string;
      transferability: string;
    };
  };
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    employees: Array<{
      role: string;
      status: string;
      compensation: string;
    }>;
    turnover: string;
    hiring: string;
    retention: string;
    management: string;
  };
  facility: {
    ownership: string;
    size: string;
    cost: string;
    leaseDetails?: string;
  };
};

async function makePerplexityRequest(messages: any[]): Promise<CimAnalysis> {
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
      response_format: { type: "json_object" }
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
  try {
    const content = data.choices[0].message.content;
    console.log("Raw API response:", content);
    const analysis = JSON.parse(content);

    // Basic validation of required fields
    const requiredSections = ['story', 'marketAnalysis', 'team'];
    const missingFields = requiredSections.filter(field => !analysis[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return analysis;
  } catch (error) {
    console.error("Failed to parse Perplexity response:", error);
    console.error("Raw response content:", data.choices[0].message.content);
    throw new Error(`Failed to parse CIM analysis response: ${error.message}`);
  }
}

export async function analyzeCimTranscript(transcript: string, directions?: string, websiteUrl?: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");

    const systemPrompt = `You are a professional business analyst creating a Confidential Information Memorandum (CIM). Analyze the provided transcript${websiteUrl ? ' and website' : ''} and output ONLY a valid JSON object with the following structure:

{
  "story": {
    "yearStarted": "When the business began",
    "businessModel": "Core business description",
    "growthHistory": "Growth trajectory",
    "businessStructure": "Company structure"
  },
  "executiveSummary": {
    "buyerAttractions": ["Key selling points"],
    "growthOpportunities": ["Future growth potential"]
  },
  "marketAnalysis": {
    "customerProfile": "Target customer description",
    "competitors": ["Main competitors"],
    "strengths": ["Competitive advantages"]
  },
  "operations": {
    "customers": {
      "recurring": "Recurring revenue details",
      "relationships": "Customer relationship type",
      "concentration": "Customer concentration",
      "contracts": "Contract terms"
    },
    "suppliers": {
      "count": "Number of suppliers",
      "terms": "Supplier terms",
      "concentration": "Supplier concentration",
      "transferability": "Relationship transferability"
    }
  },
  "team": {
    "ownerResponsibilities": "Owner's role",
    "ownerHours": "Owner's time commitment",
    "employees": [
      {
        "role": "Position",
        "status": "Employment type",
        "compensation": "Compensation details"
      }
    ],
    "turnover": "Employee turnover rate",
    "hiring": "Hiring environment",
    "retention": "Post-sale retention likelihood",
    "management": "Management structure"
  },
  "facility": {
    "ownership": "Owned/leased status",
    "size": "Facility size",
    "cost": "Monthly cost",
    "leaseDetails": "Lease terms if applicable"
  }
}`;

    const userContent = [
      `Please analyze this business transcript`,
      websiteUrl && `and the company website (${websiteUrl})`,
      `and provide a structured analysis:\n\n${transcript}`,
    ].filter(Boolean).join(' ');

    const result = await makePerplexityRequest([
      {
        role: "system",
        content: directions || systemPrompt
      },
      {
        role: "user",
        content: userContent
      }
    ]);

    console.log("Successfully analyzed transcript");
    return result;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
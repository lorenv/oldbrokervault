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
    // Add new fields for robust business description
    businessSummary: string;
    keyAttractions: string[];
    saleReason: string | null;
  };
  executiveSummary: {
    buyerAttractions: string[];
    growthOpportunities: string[];
  };
  assets: {
    digitalAssets: string[];
    location: string;
    equipmentValue: string;
    // Add inventory and equipment details
    equipmentDetails: string;
    inventoryDetails: string;
  };
  ownership: {
    owners: Array<{
      name: string;
      percentage: string;
      background: string;
    }>;
    intellectualProperty: string[];
  };
  marketAnalysis: {
    uniqueFeatures: string[];
    customerProfile: string;
    saleReason: string;
    competitors: string[];
    strengths: string[];
  };
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
  };
  inventory: {
    leadTime: string;
    sourcing: string;
    storage: string;
    value: string;
    skuCount: string;
    topProducts: string[];
  };
  sales: {
    channels?: Record<string, number>;
    seasonality: string;
    averageOrderValue: string;
    competitivePricing: string;
    pricingModel: string;
    paymentMethods: string[];
    contractTerms: string; // Add contract terms
  };
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
    clientAcquisition: string; // Add details about finding new clients
  };
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    employeeSummary: string; // Changed to a summary string
    employeeCount: string; // Add total count
    contractorCount: string; // Add contractor count if any
    turnover: string;
    hiring: string;
    retention: string;
    organization: string;
    keyEmployees: string[]; // Array of key employee titles and roles
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
  try {
    // Extract the content and parse it as JSON
    const contentStr = data.choices[0].message.content;
    const matches = contentStr.match(/\{[\s\S]*\}/);
    if (!matches) {
      throw new Error("No JSON object found in response");
    }

    const analysis = JSON.parse(matches[0]);

    // Validate the response has the required fields
    if (!analysis.story || !analysis.marketAnalysis || !analysis.team) {
      throw new Error("Invalid response format from Perplexity API");
    }

    return analysis;
  } catch (error) {
    console.error("Failed to parse Perplexity response:", data.choices[0].message.content);
    throw new Error("Failed to parse CIM analysis response");
  }
}

export async function analyzeCimTranscript(transcript: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");
    const result = await makePerplexityRequest([
      {
        role: "system",
        content: `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers. When analyzing the provided transcript, respond with ONLY a JSON object (no other text) structured to answer key questions about the business. Focus especially on:

1. Creating a robust business summary that:
   - Spans at least 4 sentences
   - Highlights key business aspects and attractive features
   - Written as a compelling pitch to potential buyers
   - Includes growth trajectory and market position
   - Mentions reason for sale if provided

2. Employee and contractor information should be comprehensive:
   - Provide a clear summary of all employees and contractors
   - Include total number of employees and contractors separately
   - List key employee titles and roles
   - Note any specializations or certifications
   - Mention length of employment where available

3. Contract terms and equipment:
   - Detail all customer and supplier contract terms
   - List and describe any significant equipment
   - Include inventory details and values
   - Note any special arrangements or agreements

4. Marketing and client acquisition:
   - Explain how new clients are acquired
   - Detail marketing strategies and their effectiveness
   - Include information about referral sources
   - Note any recurring client relationships

The JSON must follow this exact structure:
{
  "story": {
    "businessSummary": "Detailed 4+ sentence summary highlighting key aspects and investment potential",
    "yearStarted": "Founding year",
    "businessIdea": "Origin story",
    "businessModel": "Core services/products and revenue model",
    "orderProcess": "Detailed process flow",
    "growthHistory": "Growth trajectory",
    "businessStructure": "Legal structure",
    "keyAttractions": ["List of compelling features for buyers"],
    "saleReason": "Reason for sale if provided, null if not mentioned"
  },
  "executiveSummary": {
    "buyerAttractions": ["What makes the business attractive to buyers?"],
    "growthOpportunities": ["What growth opportunities are available?"]
  },
  "assets": {
    "digitalAssets": ["List digital assets (websites, social media)"],
    "location": "Business address",
    "equipmentValue": "Estimated value of FF&E",
    "equipmentDetails": "Detailed description of major equipment",
    "inventoryDetails": "Detailed description of inventory"
  },
  "ownership": {
    "owners": [{
      "name": "Owner's full name",
      "percentage": "Ownership percentage",
      "background": "Background, experience, and education"
    }],
    "intellectualProperty": ["Trademarks or copyrights"]
  },
  "marketAnalysis": {
    "uniqueFeatures": ["What is unique about the business?"],
    "customerProfile": "Profile of average customer/typical client",
    "saleReason": "Why is the business being sold?",
    "competitors": ["Top three competitors"],
    "strengths": ["Business strengths"]
  },
  "operations": {
    "suppliers": {
      "count": "Number of suppliers",
      "transferability": "Will relationships transfer?",
      "concentration": "Supplier concentration percentages",
      "terms": "Contract terms (net30, etc)",
      "replaceability": "Easy to replace suppliers?"
    },
    "customers": {
      "recurring": "Does business have recurring customers?",
      "relationships": "Number of recurring customers",
      "concentration": "Revenue concentration by customer",
      "contracts": "Contract terms with customers",
      "replaceability": "Easy to replace customers?"
    }
  },
  "inventory": {
    "leadTime": "Typical lead time",
    "sourcing": "Local or import?",
    "storage": "Where is inventory held?",
    "value": "Value of inventory on hand",
    "skuCount": "Number of SKUs/services",
    "topProducts": ["Best selling products/services and % of revenue"]
  },
  "sales": {
    "channels": {"channel": "percentage"},
    "seasonality": "Does business have seasonality?",
    "averageOrderValue": "Average order value per customer",
    "competitivePricing": "How does pricing compare to competitors?",
    "pricingModel": "How does pricing work?",
    "paymentMethods": ["Payment methods accepted"],
    "contractTerms": "Details of any standard contracts or terms"
  },
  "marketing": {
    "strategies": ["How does owner market to find new clients?"],
    "paidAdvertising": {
      "channels": ["Which channels?"],
      "effectiveness": "Was it successful and why?"
    },
    "emailMarketing": {
      "listSize": "Number of email addresses",
      "usage": "How is the list used?"
    },
    "seoEfforts": "What regular SEO efforts are engaged?",
    "clientAcquisition": "Detailed explanation of how new clients are found"
  },
  "team": {
    "ownerResponsibilities": "Owner's average work week responsibilities",
    "ownerHours": "Expected hours/week for buyer",
    "employeeSummary": "Comprehensive summary of all employees and their roles",
    "employeeCount": "Total number of employees",
    "contractorCount": "Total number of contractors if any",
    "turnover": "Is there frequent employee turnover?",
    "hiring": "Is it difficult to find new employees?",
    "retention": "Will employees stay after sale?",
    "organization": "Is there an org chart?",
    "keyEmployees": ["List key employee titles and roles"],
    "management": "Is there a GM or potential GM?"
  },
  "facility": {
    "ownership": "Owned or leased?",
    "size": "Square footage",
    "cost": "Monthly cost",
    "leaseDetails": "If leased: terms and expiration"
  }
}`
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
// the newest Perplexity model is "llama-3.1-sonar-small-128k-online", use this by default
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
    const contentStr = data.choices[0].message.content;
    const matches = contentStr.match(/\{[\s\S]*\}/);
    if (!matches) {
      throw new Error("No JSON object found in response");
    }

    const analysis = JSON.parse(matches[0]);
    if (!analysis.story || !analysis.marketAnalysis || !analysis.team) {
      throw new Error("Invalid response format from Perplexity API");
    }

    return analysis;
  } catch (error) {
    console.error("Failed to parse Perplexity response:", data.choices[0].message.content);
    throw new Error("Failed to parse CIM analysis response");
  }
}

export async function analyzeCimTranscript(transcript: string, directions?: string, websiteUrl?: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");

    let systemContent = directions || `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers.`;
    let userContent = `Please analyze this transcript${websiteUrl ? ' and the provided website' : ''} and respond with ONLY a JSON object (no other text) structured to answer key questions about the business:\n\n${transcript}`;

    if (websiteUrl) {
      userContent += `\n\nWebsite URL: ${websiteUrl}`;
    }

    const result = await makePerplexityRequest([
      {
        role: "system",
        content: systemContent
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
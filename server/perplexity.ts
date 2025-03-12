// the newest Perplexity model is llama-3.1-sonar-small-128k-online, use this by default
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const MAX_CHUNK_SIZE = 4000; // Safe character limit per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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
  };
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
  };
  facility: {
    ownership: string;
    size: string;
    cost: string;
    leaseDetails?: string;
  };
};

function splitTextIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  // Split text into sentences (basic implementation)
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size, start a new chunk
    if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += sentence + " ";
  }

  // Add the last chunk if not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makePerplexityRequestWithRetry(messages: any[], retryCount = 0): Promise<any> {
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

      // If we haven't exceeded max retries and it's a 429 or 5xx error, retry
      if (retryCount < MAX_RETRIES && (response.status === 429 || response.status >= 500)) {
        console.log(`Retrying request (attempt ${retryCount + 1} of ${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * Math.pow(2, retryCount)); // Exponential backoff
        return makePerplexityRequestWithRetry(messages, retryCount + 1);
      }

      throw new Error(`Perplexity API error (${response.status}): ${text}`);
    }

    return await response.json();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying request due to error (attempt ${retryCount + 1} of ${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY * Math.pow(2, retryCount));
      return makePerplexityRequestWithRetry(messages, retryCount + 1);
    }
    throw error;
  }
}

function mergeAnalyses(analyses: CimAnalysis[]): CimAnalysis {
  // Start with the first analysis as base
  const merged = { ...analyses[0] };

  // Helper function to merge arrays without duplicates
  const mergeArrays = (arrays: string[][]) => {
    const uniqueItems = new Set(arrays.flat());
    return Array.from(uniqueItems);
  };

  // Merge subsequent analyses
  for (let i = 1; i < analyses.length; i++) {
    const current = analyses[i];

    // Merge story section
    merged.story.businessSummary = merged.story.businessSummary + " " + current.story.businessSummary;
    merged.story.keyAttractions = mergeArrays([merged.story.keyAttractions, current.story.keyAttractions]);

    // Merge executive summary
    merged.executiveSummary.buyerAttractions = mergeArrays([
      merged.executiveSummary.buyerAttractions,
      current.executiveSummary.buyerAttractions
    ]);
    merged.executiveSummary.growthOpportunities = mergeArrays([
      merged.executiveSummary.growthOpportunities,
      current.executiveSummary.growthOpportunities
    ]);

    // Merge market analysis
    merged.marketAnalysis.uniqueFeatures = mergeArrays([
      merged.marketAnalysis.uniqueFeatures,
      current.marketAnalysis.uniqueFeatures
    ]);
    merged.marketAnalysis.competitors = mergeArrays([
      merged.marketAnalysis.competitors,
      current.marketAnalysis.competitors
    ]);
    merged.marketAnalysis.strengths = mergeArrays([
      merged.marketAnalysis.strengths,
      current.marketAnalysis.strengths
    ]);

    // Merge employees data
    merged.team.employees = [...merged.team.employees, ...current.team.employees];
    merged.team.keyEmployees = mergeArrays([merged.team.keyEmployees, current.team.keyEmployees]);
  }

  // Clean up and format the merged business summary
  merged.story.businessSummary = merged.story.businessSummary
    .split(". ")
    .filter((sentence, index, array) => array.indexOf(sentence) === index)
    .join(". ");

  return merged;
}

export async function analyzeCimTranscript(transcript: string, directions: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");

    // Split transcript into chunks if it's too large
    const chunks = splitTextIntoChunks(transcript);
    console.log(`Split transcript into ${chunks.length} chunks`);

    // Analyze each chunk
    const analyses: CimAnalysis[] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Analyzing chunk ${i + 1} of ${chunks.length}`);
      const result = await makePerplexityRequestWithRetry([
        {
          role: "system",
          content: `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers. Analyze the following part ${i + 1} of ${chunks.length} of the transcript according to these directions:\n\n${directions}`
        },
        {
          role: "user",
          content: chunks[i]
        }
      ]);

      try {
        // Extract the content and parse it as JSON
        const contentStr = result.choices[0].message.content;
        const matches = contentStr.match(/\{[\s\S]*\}/);
        if (!matches) {
          throw new Error("No JSON object found in response");
        }

        const analysis = JSON.parse(matches[0]);
        analyses.push(analysis);
      } catch (error) {
        console.error("Failed to parse Perplexity response:", result.choices[0].message.content);
        throw new Error("Failed to parse CIM analysis response");
      }
    }

    // Merge all analyses into one
    const mergedAnalysis = mergeAnalyses(analyses);
    console.log("Successfully analyzed transcript");
    return mergedAnalysis;

  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
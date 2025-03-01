// the newest Perplexity model is llama-3.1-sonar-small-128k-online, use this by default
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

type CimAnalysis = {
  summary: string;
  businessDetails: {
    yearStarted?: string;
    businessModel?: string;
    structure?: string;
    ownerBackground?: string[];
  };
  marketAnalysis: {
    competitors: string[];
    strengths: string[];
    uniqueFeatures: string[];
  };
  financials: {
    revenue?: {
      total: number;
      breakdown: Record<string, number>;
    };
    customerMetrics?: {
      averageOrderValue: number;
      recurring: number;
    };
  };
  team: {
    employees: Array<{
      role: string;
      tenure: string;
      description: string;
    }>;
  };
};

async function makePerplexityRequest(messages: any[]) {
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
    throw new Error(`Perplexity API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function analyzeCimTranscript(transcript: string): Promise<CimAnalysis> {
  try {
    return await makePerplexityRequest([
      {
        role: "system",
        content: "You are a professional business analyst creating a Confidential Information Memorandum. Analyze the provided transcript and structure the information in a clear, professional format. Return the analysis in JSON format with the following structure: { summary: string, businessDetails: { yearStarted?: string, businessModel?: string, structure?: string, ownerBackground?: string[] }, marketAnalysis: { competitors: string[], strengths: string[], uniqueFeatures: string[] }, financials: { revenue?: { total: number, breakdown: Record<string, number> }, customerMetrics?: { averageOrderValue: number, recurring: number } }, team: { employees: Array<{ role: string, tenure: string, description: string }> } }"
      },
      {
        role: "user",
        content: `Please analyze this business transcript and provide structured information in the specified JSON format:\n\n${transcript}`
      }
    ]);
  } catch (error) {
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

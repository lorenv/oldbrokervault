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
    // Parse the content as JSON since it should be a JSON string based on response_format
    const analysis = JSON.parse(data.choices[0].message.content);

    // Validate the response has the required fields
    if (!analysis.summary || !analysis.marketAnalysis || !analysis.team) {
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
        content: `You are a professional business analyst creating a Confidential Information Memorandum. Analyze the provided transcript and structure the information in a clear, professional format. You must return a JSON object with this exact structure:
        {
          "summary": "Brief overview of the business",
          "businessDetails": {
            "yearStarted": "YYYY if mentioned",
            "businessModel": "Description of the business model",
            "structure": "Business structure (LLC, Corp, etc)",
            "ownerBackground": ["List of background details"]
          },
          "marketAnalysis": {
            "competitors": ["List of competitors"],
            "strengths": ["List of business strengths"],
            "uniqueFeatures": ["List of unique features"]
          },
          "financials": {
            "revenue": {
              "total": 0,
              "breakdown": {"source1": 0, "source2": 0}
            },
            "customerMetrics": {
              "averageOrderValue": 0,
              "recurring": 0
            }
          },
          "team": {
            "employees": [
              {
                "role": "Role title",
                "tenure": "Time at company",
                "description": "Brief description"
              }
            ]
          }
        }`
      },
      {
        role: "user",
        content: `Please analyze this business transcript and provide structured information in the specified JSON format:\n\n${transcript}`
      }
    ]);

    console.log("Successfully analyzed transcript");
    return result;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
import { z } from "zod";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

type CimAnalysis = {
  story: {
    yearStarted: string;
    businessModel: string;
    growthHistory: string;
    businessStructure: string;
  },
  executiveSummary: {
    buyerAttractions: string[];
    growthOpportunities: string[];
  },
  marketAnalysis: {
    customerProfile: string;
    competitors: string[];
    strengths: string[];
  },
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    management: string;
    employees: Array<{
      role: string;
      status: string;
      compensation: string;
    }>;
  }
};

const analysisSchema = z.object({
  story: z.object({
    yearStarted: z.string(),
    businessModel: z.string(),
    growthHistory: z.string(),
    businessStructure: z.string(),
  }),
  executiveSummary: z.object({
    buyerAttractions: z.array(z.string()),
    growthOpportunities: z.array(z.string()),
  }),
  marketAnalysis: z.object({
    customerProfile: z.string(),
    competitors: z.array(z.string()),
    strengths: z.array(z.string()),
  }),
  team: z.object({
    ownerResponsibilities: z.string(),
    ownerHours: z.string(),
    management: z.string(),
    employees: z.array(z.object({
      role: z.string(),
      status: z.string(),
      compensation: z.string(),
    })),
  }),
});

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

    // Log raw response for debugging
    console.log("Raw Perplexity API Response:", contentStr);

    // Clean up the response string
    const cleanedContent = contentStr
      .replace(/```json\s*|\s*```/g, '') // Remove markdown code blocks
      .trim();

    console.log("Cleaned content:", cleanedContent);

    try {
      const parsedJson = JSON.parse(cleanedContent);
      console.log("Parsed JSON:", JSON.stringify(parsedJson, null, 2));

      // Validate against schema
      const validationResult = analysisSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        console.error("Schema validation errors:", validationResult.error);

        // Create a default analysis object with placeholder values
        const defaultAnalysis: CimAnalysis = {
          story: {
            yearStarted: "Not specified in transcript",
            businessModel: "Not specified in transcript",
            growthHistory: "Not specified in transcript",
            businessStructure: "Not specified in transcript"
          },
          executiveSummary: {
            buyerAttractions: ["Not specified in transcript"],
            growthOpportunities: ["Not specified in transcript"]
          },
          marketAnalysis: {
            customerProfile: "Not specified in transcript",
            competitors: ["Not specified in transcript"],
            strengths: ["Not specified in transcript"]
          },
          team: {
            ownerResponsibilities: "Not specified in transcript",
            ownerHours: "Not specified in transcript",
            management: "Not specified in transcript",
            employees: [{
              role: "Not specified",
              status: "Not specified",
              compensation: "Not specified"
            }]
          }
        };

        // Merge any valid data from the API response
        return {
          ...defaultAnalysis,
          ...parsedJson
        };
      }

      return validationResult.data;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Failed content:", cleanedContent);
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

    // Check if API key is available
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('ERROR: Missing PERPLEXITY_API_KEY environment variable');
      throw new Error("Missing API key configuration");
    }

    const systemPrompt = directions || `You are an expert business analyst. Analyze the provided transcript and return ONLY a JSON object with NO additional text or explanation. Follow this exact format:

{
  "story": {
    "yearStarted": "[year]",
    "businessModel": "[description]",
    "growthHistory": "[description]",
    "businessStructure": "[structure type]"
  },
  "executiveSummary": {
    "buyerAttractions": ["[attraction1]", "[attraction2]"],
    "growthOpportunities": ["[opportunity1]", "[opportunity2]"]
  },
  "marketAnalysis": {
    "customerProfile": "[description]",
    "competitors": ["[competitor1]", "[competitor2]"],
    "strengths": ["[strength1]", "[strength2]"]
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

Replace all [placeholders] with actual values from the transcript. If information is missing, use "Not specified in transcript". Your response must be ONLY this JSON object, with no additional text.`;

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
import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    management: string;
    employees: Array<{
      role: string;
      status: string;
      compensation: string;
    }>;
  };
};

export async function analyzeCimTranscript(transcript: string, directions?: string): Promise<CimAnalysis> {
  try {
    const systemPrompt = directions || `You are a professional business analyst creating a Confidential Information Memorandum. Analyze the provided transcript and return ONLY a JSON object with NO additional text or explanation.

The JSON must follow this exact structure:
{
  "story": {
    "yearStarted": "string",
    "businessModel": "string",
    "growthHistory": "string",
    "businessStructure": "string"
  },
  "executiveSummary": {
    "buyerAttractions": ["string"],
    "growthOpportunities": ["string"]
  },
  "marketAnalysis": {
    "customerProfile": "string",
    "competitors": ["string"],
    "strengths": ["string"]
  },
  "team": {
    "ownerResponsibilities": "string",
    "ownerHours": "string",
    "management": "string",
    "employees": [
      {
        "role": "string",
        "status": "string",
        "compensation": "string"
      }
    ]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    // Provide default values for any missing fields
    const defaultAnalysis: CimAnalysis = {
      story: {
        yearStarted: "Not specified",
        businessModel: "Not specified",
        growthHistory: "Not specified",
        businessStructure: "Not specified"
      },
      executiveSummary: {
        buyerAttractions: ["Not specified"],
        growthOpportunities: ["Not specified"]
      },
      marketAnalysis: {
        customerProfile: "Not specified",
        competitors: ["Not specified"],
        strengths: ["Not specified"]
      },
      team: {
        ownerResponsibilities: "Not specified",
        ownerHours: "Not specified",
        management: "Not specified",
        employees: [{
          role: "Not specified",
          status: "Not specified",
          compensation: "Not specified"
        }]
      }
    };

    // Deep merge the API response with defaults
    return {
      story: { ...defaultAnalysis.story, ...analysis.story },
      executiveSummary: { ...defaultAnalysis.executiveSummary, ...analysis.executiveSummary },
      marketAnalysis: { ...defaultAnalysis.marketAnalysis, ...analysis.marketAnalysis },
      team: { ...defaultAnalysis.team, ...analysis.team }
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
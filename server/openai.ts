import OpenAI from "openai";

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
    const systemPrompt = directions || `You are a business analyst. You must respond with ONLY a valid JSON object - no markdown, no additional text. The response must follow this exact structure:

{
  "story": {
    "yearStarted": "When did the business start",
    "businessModel": "What the business does",
    "growthHistory": "How it has grown",
    "businessStructure": "Type of business structure"
  },
  "executiveSummary": {
    "buyerAttractions": ["List of key selling points"],
    "growthOpportunities": ["List of growth opportunities"]
  },
  "marketAnalysis": {
    "customerProfile": "Target customer description",
    "competitors": ["List of main competitors"],
    "strengths": ["List of business strengths"]
  },
  "team": {
    "ownerResponsibilities": "What the owner does",
    "ownerHours": "Hours worked per week",
    "management": "Management structure description",
    "employees": [
      {
        "role": "Employee role/title",
        "status": "Employment type",
        "compensation": "Pay information"
      }
    ]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Analyze this transcript and provide information in the specified JSON format ONLY:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1 // Lower temperature for more consistent output
    });

    if (!response.choices[0].message.content) {
      throw new Error("Empty response from OpenAI");
    }

    const content = response.choices[0].message.content.trim();
    console.log("OpenAI Response:", content);

    try {
      const analysis = JSON.parse(content);

      // Default values for missing fields
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
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      console.error("Response content:", content);
      throw new Error("Failed to parse AI response into the required format");
    }
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
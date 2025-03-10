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
    const systemPrompt = directions || `You are a professional business analyst creating a Confidential Information Memorandum. 
Format your response as a JSON object with exactly these fields (use "Not specified" if information is missing):

{
  "story": {
    "yearStarted": "string - when the business started",
    "businessModel": "string - what the business does",
    "growthHistory": "string - how it has grown",
    "businessStructure": "string - business structure type"
  },
  "executiveSummary": {
    "buyerAttractions": ["array of strings - key selling points"],
    "growthOpportunities": ["array of strings - growth opportunities"]
  },
  "marketAnalysis": {
    "customerProfile": "string - target customer description",
    "competitors": ["array of strings - main competitors"],
    "strengths": ["array of strings - competitive advantages"]
  },
  "team": {
    "ownerResponsibilities": "string - what the owner does",
    "ownerHours": "string - owner's working hours",
    "management": "string - management structure",
    "employees": [
      {
        "role": "string - job title",
        "status": "string - employment type",
        "compensation": "string - payment details"
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
          content: transcript
        }
      ],
      temperature: 0.7
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
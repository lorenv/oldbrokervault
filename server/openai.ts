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
  operations: {
    suppliers: {
      count: string;
      transferability: string;
      concentration: string;
      terms: string;
    };
    customers: {
      recurring: string;
      relationships: string;
      concentration: string;
      contracts: string;
    };
  };
  facility: {
    ownership: string;
    size: string;
    cost: string;
    leaseDetails?: string;
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
    turnover: string;
    hiring: string;
    retention: string;
  };
};

export async function analyzeCimTranscript(transcript: string, directions?: string): Promise<CimAnalysis> {
  try {
    // Log the input transcript for debugging
    console.log("Input transcript:", transcript);

    const systemPrompt = directions || `As a business analyst, analyze the provided transcript and create a Confidential Information Memorandum (CIM). Extract specific details and return ONLY a JSON object matching this structure:

{
  "story": {
    "yearStarted": "Extract specific year or time period when business started",
    "businessModel": "Explain core business activities and revenue model",
    "growthHistory": "Describe growth trajectory and milestones",
    "businessStructure": "Specify business structure (LLC, Corp, etc)"
  },
  "executiveSummary": {
    "buyerAttractions": ["List 3-5 key selling points"],
    "growthOpportunities": ["List 3-5 growth opportunities"]
  },
  "marketAnalysis": {
    "customerProfile": "Describe typical customer demographics and needs",
    "competitors": ["Name main competitors"],
    "strengths": ["List competitive advantages"]
  },
  "operations": {
    "suppliers": {
      "count": "Number of key suppliers",
      "transferability": "Can supplier relationships transfer to new owner?",
      "concentration": "Percentage of supply from top suppliers",
      "terms": "Payment and delivery terms"
    },
    "customers": {
      "recurring": "Percentage of recurring revenue",
      "relationships": "Nature of customer relationships",
      "concentration": "Revenue from top customers",
      "contracts": "Contract terms and duration"
    }
  },
  "facility": {
    "ownership": "Owned/leased status",
    "size": "Square footage",
    "cost": "Monthly facility costs",
    "leaseDetails": "Terms if leased"
  },
  "team": {
    "ownerResponsibilities": "Current owner's role",
    "ownerHours": "Owner's weekly time commitment",
    "management": "Management team structure",
    "employees": [
      {
        "role": "Employee position",
        "status": "Full-time/part-time",
        "compensation": "Salary/wage info"
      }
    ],
    "turnover": "Employee turnover rate",
    "hiring": "Ease of finding staff",
    "retention": "Expected employee retention post-sale"
  }
}

IMPORTANT: Focus on extracting specific facts and figures from the transcript. Use "Not available" only if information is truly missing.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Please analyze this business transcript carefully and extract all relevant information into the specified JSON format:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3 // Slightly higher temperature for better analysis
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
          yearStarted: "Not available",
          businessModel: "Not available",
          growthHistory: "Not available",
          businessStructure: "Not available"
        },
        executiveSummary: {
          buyerAttractions: ["Not available"],
          growthOpportunities: ["Not available"]
        },
        marketAnalysis: {
          customerProfile: "Not available",
          competitors: ["Not available"],
          strengths: ["Not available"]
        },
        operations: {
          suppliers: {
            count: "Not available",
            transferability: "Not available",
            concentration: "Not available",
            terms: "Not available"
          },
          customers: {
            recurring: "Not available",
            relationships: "Not available",
            concentration: "Not available",
            contracts: "Not available"
          }
        },
        facility: {
          ownership: "Not available",
          size: "Not available",
          cost: "Not available"
        },
        team: {
          ownerResponsibilities: "Not available",
          ownerHours: "Not available",
          management: "Not available",
          employees: [{
            role: "Not available",
            status: "Not available",
            compensation: "Not available"
          }],
          turnover: "Not available",
          hiring: "Not available",
          retention: "Not available"
        }
      };

      // Deep merge the API response with defaults
      return {
        story: { ...defaultAnalysis.story, ...analysis.story },
        executiveSummary: { ...defaultAnalysis.executiveSummary, ...analysis.executiveSummary },
        marketAnalysis: { ...defaultAnalysis.marketAnalysis, ...analysis.marketAnalysis },
        operations: {
          suppliers: { ...defaultAnalysis.operations.suppliers, ...analysis.operations?.suppliers },
          customers: { ...defaultAnalysis.operations.customers, ...analysis.operations?.customers }
        },
        facility: { ...defaultAnalysis.facility, ...analysis.facility },
        team: {
          ...defaultAnalysis.team,
          ...analysis.team,
          employees: analysis.team?.employees || defaultAnalysis.team.employees
        }
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
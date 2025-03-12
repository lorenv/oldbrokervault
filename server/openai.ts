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
    console.log("Starting transcript analysis...");
    console.log("Transcript length:", transcript.length);

    const systemPrompt = directions || `You are a business analyst. Extract information from the transcript and return a JSON object that matches this EXACT structure. Replace placeholders with actual information from the transcript:

{
  "story": {
    "yearStarted": "Extract when business started",
    "businessModel": "Describe what business does",
    "growthHistory": "How has business grown",
    "businessStructure": "Business structure type"
  },
  "executiveSummary": {
    "buyerAttractions": ["Key selling point 1", "Key selling point 2"],
    "growthOpportunities": ["Growth opportunity 1", "Growth opportunity 2"]
  },
  "marketAnalysis": {
    "customerProfile": "Describe target customers",
    "competitors": ["Main competitor 1", "Main competitor 2"],
    "strengths": ["Business strength 1", "Business strength 2"]
  },
  "operations": {
    "suppliers": {
      "count": "Number of suppliers",
      "transferability": "Can relationships transfer",
      "concentration": "Supply concentration",
      "terms": "Payment terms"
    },
    "customers": {
      "recurring": "Recurring revenue details",
      "relationships": "Customer relationship type",
      "concentration": "Customer concentration",
      "contracts": "Contract terms"
    }
  },
  "facility": {
    "ownership": "Owned or leased",
    "size": "Square footage",
    "cost": "Monthly cost",
    "leaseDetails": "Lease terms if applicable"
  },
  "team": {
    "ownerResponsibilities": "Owner's role",
    "ownerHours": "Hours worked",
    "management": "Management structure",
    "employees": [
      {
        "role": "Employee role",
        "status": "Employment status",
        "compensation": "Pay details"
      }
    ],
    "turnover": "Employee turnover rate",
    "hiring": "Hiring difficulty",
    "retention": "Expected retention"
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nEXTRACT ACTUAL VALUES from the transcript. Do not return placeholder text. If information is truly missing, use "Not available in transcript".`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    console.log("OpenAI API Response received");

    const content = response.choices[0].message.content;
    console.log("Raw API response content:", content);

    const analysis = JSON.parse(content);
    console.log("Parsed analysis:", JSON.stringify(analysis, null, 2));

    // Create the complete analysis object with all required fields
    const completeAnalysis: CimAnalysis = {
      story: {
        yearStarted: analysis.story?.yearStarted || "Not available",
        businessModel: analysis.story?.businessModel || "Not available",
        growthHistory: analysis.story?.growthHistory || "Not available",
        businessStructure: analysis.story?.businessStructure || "Not available"
      },
      executiveSummary: {
        buyerAttractions: analysis.executiveSummary?.buyerAttractions || ["Not available"],
        growthOpportunities: analysis.executiveSummary?.growthOpportunities || ["Not available"]
      },
      marketAnalysis: {
        customerProfile: analysis.marketAnalysis?.customerProfile || "Not available",
        competitors: analysis.marketAnalysis?.competitors || ["Not available"],
        strengths: analysis.marketAnalysis?.strengths || ["Not available"]
      },
      operations: {
        suppliers: {
          count: analysis.operations?.suppliers?.count || "Not available",
          transferability: analysis.operations?.suppliers?.transferability || "Not available",
          concentration: analysis.operations?.suppliers?.concentration || "Not available",
          terms: analysis.operations?.suppliers?.terms || "Not available"
        },
        customers: {
          recurring: analysis.operations?.customers?.recurring || "Not available",
          relationships: analysis.operations?.customers?.relationships || "Not available",
          concentration: analysis.operations?.customers?.concentration || "Not available",
          contracts: analysis.operations?.customers?.contracts || "Not available"
        }
      },
      facility: {
        ownership: analysis.facility?.ownership || "Not available",
        size: analysis.facility?.size || "Not available",
        cost: analysis.facility?.cost || "Not available",
        leaseDetails: analysis.facility?.leaseDetails
      },
      team: {
        ownerResponsibilities: analysis.team?.ownerResponsibilities || "Not available",
        ownerHours: analysis.team?.ownerHours || "Not available",
        management: analysis.team?.management || "Not available",
        employees: analysis.team?.employees || [{
          role: "Not available",
          status: "Not available",
          compensation: "Not available"
        }],
        turnover: analysis.team?.turnover || "Not available",
        hiring: analysis.team?.hiring || "Not available",
        retention: analysis.team?.retention || "Not available"
      }
    };

    console.log("Final analysis object:", JSON.stringify(completeAnalysis, null, 2));
    return completeAnalysis;

  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
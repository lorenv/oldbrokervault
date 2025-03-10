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
        temperature: 0.1, // Reduced temperature for more consistent output
        response_format: { type: "json_object" } // Request JSON format explicitly
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error (${response.status})`);
    }

    const data = await response.json();
    console.log("Full API Response:", data);

    let content = data.choices[0].message.content;
    console.log("Raw content:", content);

    // Try to clean the content if it contains markdown or extra text
    if (content.includes("```json")) {
      content = content.split("```json")[1].split("```")[0];
    }
    content = content.trim();
    console.log("Cleaned content:", content);

    const analysis = JSON.parse(content);
    console.log("Parsed analysis:", analysis);

    // Create a default structure
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
    console.error("Perplexity API Error:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function analyzeCimTranscript(transcript: string, directions?: string): Promise<CimAnalysis> {
  const systemPrompt = directions || `You are a business analyst. Respond with ONLY a JSON object, no other text or explanation.
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

  try {
    return await makePerplexityRequest([
      {
        role: "system",
        content: `${systemPrompt}\n\nIMPORTANT: Your response must be ONLY the JSON object, with NO additional text or explanation.`
      },
      {
        role: "user",
        content: transcript
      }
    ]);
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
}
import OpenAI from "openai";
import { convertTextToImage } from "./text-to-image";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TEXT_LENGTH = 4000; // OpenAI's token limit threshold

type CimAnalysis = {
  story: {
    yearStarted?: string;
    businessModel?: string;
    structure?: string;
    ownerBackground?: string[];
  };
  executiveSummary: {
    businessDescription: string; // Robust 4+ sentence summary
    buyerAttractions: string[];
    growthOpportunities: string[];
    saleReason: string; // Made mandatory
  };
  marketAnalysis: {
    customerProfile: string;
    competitors: string[];
    strengths: string[];
  };
  operations: {
    suppliers: {
      count: string;
      terms: string;
      concentration: string;
      transferability: string;
    };
    customers: {
      recurring: string;
      relationships: string;
      concentration: string;
      contracts: string;
    };
  };
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    management: string;
    employees: Array<{
      role: string;
      status: string;
      compensation?: string; // Made optional
      tenure?: string; // Made optional
    }>;
    turnover: string;
    hiring: string;
    retention: string;
  };
  facility: {
    ownership: string;
    size: string;
    cost: string;
    leaseDetails?: string;
  };
};

export async function analyzeCimTranscript(transcript: string, directions: string): Promise<CimAnalysis> {
  try {
    console.log("Starting CIM transcript analysis...");

    // If text is too long, use vision API
    if (transcript.length > MAX_TEXT_LENGTH) {
      console.log("Text too long, converting to image...");
      const imageBase64 = await convertTextToImage(transcript);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers. When analyzing the provided transcript, structure the information in a way that emphasizes the business's value and potential. Pay special attention to:

1. Business Description (CRITICAL):
   - Write a minimum 4-sentence robust summary that positions the business as an attractive investment
   - Highlight key differentiators, market position, and growth trajectory
   - Emphasize stable revenue streams, operational efficiency, and market opportunities
   - Focus on elements that make the business appealing to potential buyers

2. Sale Reason (MANDATORY):
   - ALWAYS include the reason for sale if mentioned in the transcript
   - If not explicitly mentioned, note "Reason for sale not provided in transcript"
   - This is crucial information for potential buyers and must be addressed

3. Team Structure:
   - Provide a comprehensive overview of the team composition
   - If detailed information (compensation, tenure, etc.) is available, present in a structured table
   - If limited information is available, provide a clear summary paragraph or bullet points
   - Include total headcount, roles, and employment status (full-time/part-time/contractor)
   - Note any key personnel or management positions`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this business transcript and provide the information in JSON format:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ],
          }
        ],
        response_format: { type: "json_object" }
      });

      console.log("Successfully processed large transcript using vision API");
      return JSON.parse(response.choices[0].message.content) as CimAnalysis;
    }

    // For shorter text, use regular completion
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: directions
        },
        {
          role: "user",
          content: `Please analyze this business transcript and provide the information in JSON format:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" }
    });

    console.log("Successfully processed transcript using standard API");
    return JSON.parse(response.choices[0].message.content) as CimAnalysis;
  } catch (error) {
    console.error("Error in analyzeCimTranscript:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to analyze transcript: ${error.message}`);
    }
    throw new Error("Failed to analyze transcript: Unknown error occurred");
  }
}
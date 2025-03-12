import OpenAI from "openai";
import { convertTextToImage } from "./text-to-image";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TEXT_LENGTH = 4000; // OpenAI's token limit threshold

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
            content: directions
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
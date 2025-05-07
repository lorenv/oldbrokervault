import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export type WebsiteAnalysis = {
  businessDescription: string;
  teamInfo: string;
  servicesInfo: string;
  companyName: string;
};

export async function analyzeCimTranscript(transcript: string): Promise<CimAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional business analyst creating a Confidential Information Memorandum. Analyze the provided transcript and structure the information in a clear, professional format."
        },
        {
          role: "user",
          content: `Please analyze this business transcript and provide structured information in JSON format:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    throw new Error(`Failed to analyze transcript: ${error.message}`);
  }
}

/**
 * Analyzes website content to extract business information
 * @param websiteContent The text content extracted from the website
 * @returns Structured business information from the website
 */
export async function analyzeWebsiteContent(websiteContent: string): Promise<WebsiteAnalysis> {
  try {
    // Handle empty content case
    if (!websiteContent || websiteContent.trim() === '') {
      return {
        businessDescription: "",
        teamInfo: "",
        servicesInfo: "",
        companyName: ""
      };
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional business analyst extracting key information from business websites. 
          Analyze the provided website content and extract structured information about the business.
          Focus on finding factual information only, do not invent or assume details not present in the content.
          If specific information is not available, provide empty strings.`
        },
        {
          role: "user",
          content: `Please analyze this business website content and provide the following information in JSON format:
          
          1. businessDescription: A comprehensive paragraph describing what the business does, its value proposition, and any unique selling points
          2. teamInfo: A summary of the team members, their roles, experience, or any team-related information
          3. servicesInfo: A detailed list of services or products offered by the business
          4. companyName: The name of the company as it appears on the website
          
          Here's the website content:
          
          ${websiteContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }
    
    const result = JSON.parse(content);
    
    // Ensure all expected fields are present
    return {
      businessDescription: result.businessDescription || "",
      teamInfo: result.teamInfo || "",
      servicesInfo: result.servicesInfo || "",
      companyName: result.companyName || ""
    };
  } catch (error) {
    console.error("Error analyzing website content:", error instanceof Error ? error.message : String(error));
    return {
      businessDescription: "",
      teamInfo: "",
      servicesInfo: "",
      companyName: ""
    };
  }
}

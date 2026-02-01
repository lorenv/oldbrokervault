import OpenAI from "openai";

// Import timeout config for AI API calls (PERF-013)
import { API_TIMEOUTS } from "./utils/fetch-with-timeout";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// Initialize with timeout to prevent hanging requests (PERF-013)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: API_TIMEOUTS.AI_API, // 60 second timeout for AI API calls
});

/**
 * Summarizes document text for e-signature signers using GPT-4o-mini for cost efficiency
 * Returns key points and important terms the signer should be aware of
 */
export async function summarizeDocumentForSigner(documentText: string): Promise<{
  summary: string;
  keyPoints: string[];
  importantTerms: string[];
  estimatedReadTime: string;
}> {
  try {
    // Use gpt-4o-mini for cost efficiency
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that summarizes legal and business documents for signers.
Your goal is to help people understand what they are signing without replacing legal advice.
Provide a clear, concise summary highlighting:
1. What the document is about
2. Key obligations and commitments
3. Important terms, dates, or conditions
4. Any notable clauses the signer should be aware of

Be objective and factual. Do not provide legal advice.
Always recommend consulting a lawyer for complex legal documents.`
        },
        {
          role: "user",
          content: `Please summarize this document for someone about to sign it. Provide your response in JSON format with these fields:
- summary: A 2-3 paragraph plain English summary of the document
- keyPoints: An array of 3-7 bullet points highlighting the most important things the signer should know
- importantTerms: An array of key terms, dates, amounts, or conditions mentioned
- estimatedReadTime: How long it would take to read the full document (e.g., "5 minutes")

Document text:
${documentText.substring(0, 15000)}` // Limit to ~15k chars for token limits
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.3, // Lower temperature for more consistent, factual output
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      summary: result.summary || 'Unable to generate summary.',
      keyPoints: result.keyPoints || [],
      importantTerms: result.importantTerms || [],
      estimatedReadTime: result.estimatedReadTime || 'Unknown',
    };
  } catch (error: any) {
    console.error('[OPENAI] Document summarization failed:', error);
    throw new Error(`Failed to summarize document: ${error.message}`);
  }
}

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

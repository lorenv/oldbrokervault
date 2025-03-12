import OpenAI from "openai";
import { convertTextToImage } from "./text-to-image";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_CHUNK_LENGTH = 8000; // Approximate size that works well with the API

// Helper function to clean transcript
function cleanTranscript(transcript: string): string {
  return transcript
    // Remove empty lines
    .split('\n')
    .filter(line => line.trim().length > 0)
    // Remove timestamps (e.g., "10:30:45" or "10:30")
    .map(line => line.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ''))
    // Remove specific names
    .map(line => line
      .replace(/Business Exits/g, '')
      .replace(/Michelle Branscum/g, '')
      .replace(/Robert Kale/g, '')
      .replace(/Loren Vandegrift/g, '')
    )
    // Remove multiple spaces
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n');
}

// Improved text chunking function
function chunkText(text: string, maxLength: number): string[] {
  // First try splitting by paragraphs
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length <= maxLength) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If a single paragraph is too long, split by sentences
      if (paragraph.length > maxLength) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if ((currentChunk + ' ' + sentence).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.map(chunk => chunk.trim());
}

// Function to merge analysis results
function mergeAnalysisResults(results: CimAnalysis[]): CimAnalysis {
  // Take the most detailed business description
  const descriptions = results.map(r => r.executiveSummary.businessDescription);
  const bestDescription = descriptions.reduce((a, b) => 
    a.length > b.length ? a : b
  );

  // Take the first sale reason that isn't "not provided"
  const saleReason = results.find(r => 
    !r.executiveSummary.saleReason.includes("not provided")
  )?.executiveSummary.saleReason || results[0].executiveSummary.saleReason;

  const merged: CimAnalysis = {
    story: results[0].story,
    executiveSummary: {
      businessDescription: bestDescription,
      buyerAttractions: Array.from(new Set(results.flatMap(r => r.executiveSummary.buyerAttractions))),
      growthOpportunities: Array.from(new Set(results.flatMap(r => r.executiveSummary.growthOpportunities))),
      saleReason
    },
    marketAnalysis: {
      customerProfile: results[0].marketAnalysis.customerProfile,
      competitors: Array.from(new Set(results.flatMap(r => r.marketAnalysis.competitors))),
      strengths: Array.from(new Set(results.flatMap(r => r.marketAnalysis.strengths)))
    },
    operations: {
      suppliers: results[0].operations.suppliers,
      customers: results[0].operations.customers
    },
    team: {
      ownerResponsibilities: results[0].team.ownerResponsibilities,
      ownerHours: results[0].team.ownerHours,
      management: results[0].team.management,
      employees: Array.from(new Set(results.flatMap(r => r.team.employees)
        .map(JSON.stringify)))
        .map(JSON.parse),
      turnover: results[0].team.turnover,
      hiring: results[0].team.hiring,
      retention: results[0].team.retention
    },
    facility: results[0].facility
  };

  return merged;
}

export async function analyzeCimTranscript(transcript: string, directions: string): Promise<CimAnalysis> {
  try {
    console.log("Starting CIM transcript analysis...");

    // Clean up the transcript first
    const cleanedTranscript = cleanTranscript(transcript);
    console.log("Transcript length before cleanup:", transcript.length);
    console.log("Transcript length after cleanup:", cleanedTranscript.length);

    // Split into chunks
    const chunks = chunkText(cleanedTranscript, MAX_CHUNK_LENGTH);
    console.log(`Split transcript into ${chunks.length} chunks`);

    // Process each chunk
    const analysisPromises = chunks.map(async (chunk, index) => {
      console.log(`Processing chunk ${index + 1}/${chunks.length} (length: ${chunk.length})`);

      try {
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
   - Note any key personnel or management positions

This is part ${index + 1} of ${chunks.length} of the transcript. ${index === 0 ? 'Focus on the main business description and sale reason.' : 'Focus on supplementary details and any additional information.'}`
            },
            {
              role: "user",
              content: chunk
            }
          ],
          response_format: { type: "json_object" }
        });

        return JSON.parse(response.choices[0].message.content) as CimAnalysis;
      } catch (error) {
        console.error(`Error processing chunk ${index + 1}:`, error);
        throw error;
      }
    });

    // Wait for all chunks to be processed
    const results = await Promise.all(analysisPromises);

    // Merge results
    console.log("Merging analysis results...");
    const mergedAnalysis = mergeAnalysisResults(results);

    console.log("Successfully completed CIM analysis");
    return mergedAnalysis;
  } catch (error) {
    console.error("Error in analyzeCimTranscript:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to analyze transcript: ${error.message}`);
    }
    throw new Error("Failed to analyze transcript: Unknown error occurred");
  }
}

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
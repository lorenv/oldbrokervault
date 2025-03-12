// the newest Perplexity model is llama-3.1-sonar-small-128k-online, use this by default
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

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

async function makePerplexityRequest(messages: any[]): Promise<any> {
  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Perplexity API error:", {
      status: response.status,
      statusText: response.statusText,
      body: text
    });
    throw new Error(`Perplexity API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  try {
    const contentStr = data.choices[0].message.content;
    // Remove any potential markdown code block markers
    const jsonStr = contentStr.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to parse Perplexity response:", data.choices[0].message.content);
    throw new Error("Failed to parse CIM analysis response");
  }
}

export async function analyzeCimTranscript(transcript: string): Promise<any> {
  try {
    console.log("Analyzing transcript with Perplexity API");
    // Clean up the transcript before analysis
    const cleanedTranscript = cleanTranscript(transcript);
    console.log("Transcript length before cleanup:", transcript.length);
    console.log("Transcript length after cleanup:", cleanedTranscript.length);

    const result = await makePerplexityRequest([
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
        content: `Analyze this transcript and create a CIM response with the following structure. Format as JSON ONLY, no other text:

{
  "BusinessDescription": {
    "Summary": {
      "Text": "4+ sentence summary"
    },
    "KeyDifferentiators": ["list", "of", "differentiators"],
    "MarketPosition": {
      "Text": "description"
    },
    "GrowthTrajectory": {
      "Text": "description"
    }
  },
  "SaleReason": {
    "Text": "reason for sale"
  },
  "TeamStructure": {
    "TotalHeadcount": number,
    "Roles": ["list", "of", "roles"],
    "EmploymentStatus": [
      {
        "Role": "role name",
        "Status": "full-time/part-time/contractor"
      }
    ],
    "KeyPersonnel": [
      {
        "Name": "name",
        "Role": "role",
        "Responsibilities": ["list", "of", "responsibilities"]
      }
    ]
  }
}

Transcript to analyze:\n\n${cleanedTranscript}`
      }
    ]);

    console.log("Successfully analyzed transcript");
    return result;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
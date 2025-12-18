import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client with the secondary API key
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY2,
});

// Primary and fallback models for vision tasks
// claude-sonnet-4-20250514 is Claude Sonnet 4 (stable)
const PRIMARY_MODEL = 'claude-sonnet-4-20250514';
const FALLBACK_MODEL = 'claude-3-5-sonnet-20241022';

interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  importantTerms: string[];
  estimatedReadTime: string;
}

interface ImageInput {
  type: 'base64';
  media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string;
}

/**
 * Summarizes a document using Claude's vision capabilities
 * Analyzes page images directly without needing OCR
 *
 * @param pageImageUrls - Array of URLs to page images
 * @param maxPages - Maximum number of pages to analyze (to control costs)
 */
export async function summarizeDocumentWithVision(
  pageImageUrls: string[],
  maxPages: number = 5
): Promise<DocumentSummary> {
  try {
    // Limit pages to control costs
    const pagesToAnalyze = pageImageUrls.slice(0, maxPages);

    console.log(`[ANTHROPIC] Summarizing ${pagesToAnalyze.length} pages with Claude Vision`);

    // Fetch and convert images to base64
    const imageContents: Array<{ type: 'image'; source: ImageInput }> = [];

    for (let i = 0; i < pagesToAnalyze.length; i++) {
      const url = pagesToAnalyze[i];
      try {
        let imageBuffer: Buffer;

        if (url.startsWith('/api/object-storage/')) {
          // Internal storage URL - need to fetch from storage service
          const { ObjectStorageService } = await import('../object-storage');
          const storage = new ObjectStorageService();
          const key = url.replace('/api/object-storage/', '');
          imageBuffer = await storage.downloadBuffer(key);
        } else if (url.startsWith('http')) {
          // External URL - fetch directly
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`[ANTHROPIC] Failed to fetch page ${i + 1}: ${response.statusText}`);
            continue;
          }
          imageBuffer = Buffer.from(await response.arrayBuffer());
        } else {
          console.warn(`[ANTHROPIC] Unknown URL format for page ${i + 1}: ${url}`);
          continue;
        }

        // Convert to base64
        const base64Data = imageBuffer.toString('base64');

        // Determine media type from URL or default to PNG
        const mediaType = url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')
          ? 'image/jpeg'
          : 'image/png';

        imageContents.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        });

        console.log(`[ANTHROPIC] Loaded page ${i + 1} (${Math.round(base64Data.length / 1024)}KB)`);
      } catch (imgError: any) {
        console.error(`[ANTHROPIC] Error loading page ${i + 1}:`, imgError.message);
      }
    }

    if (imageContents.length === 0) {
      throw new Error('Could not load any document pages for analysis');
    }

    // Build message content with images and prompt
    const messageContent: Array<{ type: 'image'; source: ImageInput } | { type: 'text'; text: string }> = [
      ...imageContents,
      {
        type: 'text',
        text: `You are analyzing a document that someone is about to sign. Please examine these ${imageContents.length} page(s) carefully and provide a helpful summary.

Your goal is to help the signer understand what they are agreeing to, without replacing legal advice.

Please provide your response in the following JSON format:
{
  "summary": "A 2-3 paragraph plain English summary of what this document is about and what it means for the signer",
  "keyPoints": ["Array of 3-7 bullet points highlighting the most important things the signer should know"],
  "importantTerms": ["Array of key terms, dates, amounts, deadlines, or conditions mentioned in the document"],
  "estimatedReadTime": "Estimated time to read the full document (e.g., '5 minutes')"
}

Focus on:
1. What the document is (contract type, agreement type, etc.)
2. Key obligations and commitments for the signer
3. Important dates, deadlines, or time periods
4. Any notable clauses (termination, liability, confidentiality, etc.)
5. Payment terms or financial obligations if applicable

Be objective and factual. Do not provide legal advice. If the document appears complex or has significant legal implications, mention that the signer may want to consult a lawyer.

Respond ONLY with the JSON object, no additional text.`,
      },
    ];

    // Call Claude API with vision (with fallback model support)
    let response;
    try {
      response = await anthropic.messages.create({
        model: PRIMARY_MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });
    } catch (primaryError: any) {
      console.warn(`[ANTHROPIC] Primary model ${PRIMARY_MODEL} failed, trying fallback: ${primaryError.message}`);

      // Try fallback model
      response = await anthropic.messages.create({
        model: FALLBACK_MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });

      console.log(`[ANTHROPIC] Successfully used fallback model ${FALLBACK_MODEL}`);
    }

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    let result: DocumentSummary;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[ANTHROPIC] Failed to parse response:', textContent.text);
      throw new Error('Failed to parse AI response');
    }

    // Validate and provide defaults
    return {
      summary: result.summary || 'Unable to generate summary.',
      keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
      importantTerms: Array.isArray(result.importantTerms) ? result.importantTerms : [],
      estimatedReadTime: result.estimatedReadTime || 'Unknown',
    };

  } catch (error: any) {
    console.error('[ANTHROPIC] Document summarization failed:', error);
    throw new Error(`Failed to summarize document: ${error.message}`);
  }
}

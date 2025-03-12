
/**
 * Utility to chunk large transcripts for processing
 */

const MAX_CHUNK_SIZE = 1000000; // 1MB chunks (adjust as needed)

/**
 * Splits a large transcript into manageable chunks
 * @param transcript The full transcript text
 * @returns Array of transcript chunks
 */
export function chunkTranscript(transcript: string): string[] {
  if (transcript.length < MAX_CHUNK_SIZE) {
    return [transcript];
  }

  const chunks: string[] = [];
  
  // Split by paragraphs first (to maintain coherence)
  const paragraphs = transcript.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size, start a new chunk
    if (currentChunk.length + paragraph.length + 2 > MAX_CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // If a single paragraph is larger than max size, we need to split by sentences
      if (paragraph.length > MAX_CHUNK_SIZE) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 > MAX_CHUNK_SIZE) {
            chunks.push(currentChunk);
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Merges analysis results from multiple chunks
 */
export function mergeAnalysisResults(results: any[]): any {
  // Start with the first result as the base
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];
  
  const merged = { ...results[0] };
  
  // For arrays, combine and deduplicate
  const processArrayField = (obj: any, field: string) => {
    const allValues = results.flatMap(r => 
      r[field] && Array.isArray(r[field]) ? r[field] : []
    );
    return Array.from(new Set(allValues.map(JSON.stringify))).map(JSON.parse);
  };
  
  // Handle specific nested structures
  if (merged.executiveSummary) {
    // Take the longest business description
    const descriptions = results.map(r => 
      r.executiveSummary?.businessDescription || ''
    );
    merged.executiveSummary.businessDescription = descriptions.reduce((a, b) => 
      a.length > b.length ? a : b
    );
    
    // Merge arrays in executiveSummary
    if (Array.isArray(merged.executiveSummary.buyerAttractions)) {
      merged.executiveSummary.buyerAttractions = processArrayField(
        merged.executiveSummary, 'buyerAttractions'
      );
    }
    
    if (Array.isArray(merged.executiveSummary.growthOpportunities)) {
      merged.executiveSummary.growthOpportunities = processArrayField(
        merged.executiveSummary, 'growthOpportunities'
      );
    }
  }
  
  // Always return the merged result
  return merged;
}

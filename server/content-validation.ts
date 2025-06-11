import { DocumentBaseline } from '@shared/schema';

interface ValidationResult {
  isValid: boolean;
  reason?: string;
  similarityScore?: number;
}

interface ContentMetrics {
  companyName?: string;
  industry?: string;
  businessModel?: string;
  primaryMarket?: string;
  revenue?: string;
  ebitda?: string;
  employeeCount?: number;
}

// Text similarity using Jaccard similarity
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const words2 = new Set(text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Extract key business metrics from transcript
function extractBusinessMetrics(transcript: string): ContentMetrics {
  const metrics: ContentMetrics = {};
  
  // Simple keyword-based extraction (can be enhanced with NLP)
  const lowerTranscript = transcript.toLowerCase();
  
  // Try to extract company name (first capitalized word sequence)
  const companyMatch = transcript.match(/(?:company|business|firm|corp|inc|llc)\s+([A-Z][a-zA-Z\s&]+)/i);
  if (companyMatch) {
    metrics.companyName = companyMatch[1].trim();
  }
  
  // Extract industry indicators
  const industries = ['technology', 'manufacturing', 'retail', 'healthcare', 'finance', 'real estate', 'construction', 'automotive', 'agriculture', 'education', 'hospitality', 'energy'];
  for (const industry of industries) {
    if (lowerTranscript.includes(industry)) {
      metrics.industry = industry;
      break;
    }
  }
  
  // Extract business model indicators
  if (lowerTranscript.includes('b2b') || lowerTranscript.includes('business to business')) {
    metrics.businessModel = 'B2B';
  } else if (lowerTranscript.includes('b2c') || lowerTranscript.includes('business to consumer')) {
    metrics.businessModel = 'B2C';
  } else if (lowerTranscript.includes('saas') || lowerTranscript.includes('software as a service')) {
    metrics.businessModel = 'SaaS';
  }
  
  // Extract revenue
  const revenueMatch = transcript.match(/revenue[s]?\s+(?:of\s+)?[\$]?([0-9,]+(?:\.[0-9]+)?)\s*(?:million|m|thousand|k)?/i);
  if (revenueMatch) {
    metrics.revenue = revenueMatch[1];
  }
  
  // Extract EBITDA
  const ebitdaMatch = transcript.match(/ebitda[s]?\s+(?:of\s+)?[\$]?([0-9,]+(?:\.[0-9]+)?)\s*(?:million|m|thousand|k)?/i);
  if (ebitdaMatch) {
    metrics.ebitda = ebitdaMatch[1];
  }
  
  // Extract employee count
  const employeeMatch = transcript.match(/(?:employees?|staff|team|people)\s+(?:of\s+)?([0-9,]+)/i);
  if (employeeMatch) {
    metrics.employeeCount = parseInt(employeeMatch[1].replace(/,/g, ''));
  }
  
  return metrics;
}

// Check if financial metrics have changed significantly
function checkFinancialChanges(original: ContentMetrics, current: ContentMetrics): boolean {
  const threshold = 0.5; // 50% change threshold
  
  // Check revenue changes
  if (original.revenue && current.revenue) {
    const origRevenue = parseFloat(original.revenue.replace(/,/g, ''));
    const currRevenue = parseFloat(current.revenue.replace(/,/g, ''));
    if (Math.abs(origRevenue - currRevenue) / origRevenue > threshold) {
      return true;
    }
  }
  
  // Check EBITDA changes
  if (original.ebitda && current.ebitda) {
    const origEbitda = parseFloat(original.ebitda.replace(/,/g, ''));
    const currEbitda = parseFloat(current.ebitda.replace(/,/g, ''));
    if (Math.abs(origEbitda - currEbitda) / origEbitda > threshold) {
      return true;
    }
  }
  
  // Check employee count changes
  if (original.employeeCount && current.employeeCount) {
    const change = Math.abs(original.employeeCount - current.employeeCount) / original.employeeCount;
    if (change > threshold) {
      return true;
    }
  }
  
  return false;
}

export class ContentValidationService {
  /**
   * Validates if regeneration request represents legitimate revision vs new document
   */
  static validateRegenerationContent(
    baseline: DocumentBaseline,
    newTranscript: string,
    newDirections: string,
    newFinancials?: any
  ): ValidationResult {
    // 1. Check transcript similarity
    const transcriptSimilarity = calculateTextSimilarity(baseline.originalTranscript, newTranscript);
    if (transcriptSimilarity < 0.7) {
      return {
        isValid: false,
        reason: "Transcript content differs significantly from original (less than 70% similarity). This appears to be a different business discussion and should be created as a new document.",
        similarityScore: transcriptSimilarity
      };
    }
    
    // 2. Extract and compare business metrics
    const originalMetrics = extractBusinessMetrics(baseline.originalTranscript);
    const currentMetrics = extractBusinessMetrics(newTranscript);
    
    // 3. Check for core business identity changes
    if (originalMetrics.companyName && currentMetrics.companyName) {
      const companySimilarity = calculateTextSimilarity(originalMetrics.companyName, currentMetrics.companyName);
      if (companySimilarity < 0.8) {
        return {
          isValid: false,
          reason: "Company name has changed significantly, suggesting this is a different business entity.",
          similarityScore: transcriptSimilarity
        };
      }
    }
    
    // 4. Check industry changes
    if (originalMetrics.industry && currentMetrics.industry && 
        originalMetrics.industry !== currentMetrics.industry) {
      return {
        isValid: false,
        reason: "Industry sector has changed, indicating a fundamentally different business.",
        similarityScore: transcriptSimilarity
      };
    }
    
    // 5. Check business model changes
    if (originalMetrics.businessModel && currentMetrics.businessModel && 
        originalMetrics.businessModel !== currentMetrics.businessModel) {
      return {
        isValid: false,
        reason: "Business model has changed (e.g., B2B to B2C), representing a different business approach.",
        similarityScore: transcriptSimilarity
      };
    }
    
    // 6. Check for dramatic financial changes
    if (checkFinancialChanges(originalMetrics, currentMetrics)) {
      return {
        isValid: false,
        reason: "Financial metrics have changed by more than 50%, suggesting a different business or time period.",
        similarityScore: transcriptSimilarity
      };
    }
    
    // 7. Check if new financials represent dramatic changes
    if (newFinancials && baseline.originalRevenue) {
      const baselineRevenue = parseFloat(baseline.originalRevenue.replace(/[^\d.]/g, ''));
      const newRevenue = parseFloat(String(newFinancials.revenue || '0').replace(/[^\d.]/g, ''));
      
      if (baselineRevenue > 0 && newRevenue > 0) {
        const revenueChange = Math.abs(baselineRevenue - newRevenue) / baselineRevenue;
        if (revenueChange > 0.5) {
          return {
            isValid: false,
            reason: "Revenue figures differ by more than 50% from the original document.",
            similarityScore: transcriptSimilarity
          };
        }
      }
    }
    
    // If all checks pass, this is a legitimate revision
    return {
      isValid: true,
      similarityScore: transcriptSimilarity
    };
  }
  
  /**
   * Creates a baseline record for a new document
   */
  static createBaseline(
    cimDocumentId: number,
    transcript: string,
    directions: string,
    financials?: any
  ): Omit<DocumentBaseline, 'id' | 'createdAt'> {
    const metrics = extractBusinessMetrics(transcript);
    
    return {
      cimDocumentId,
      originalTranscript: transcript,
      originalDirections: directions,
      companyName: metrics.companyName || null,
      industry: metrics.industry || null,
      businessModel: metrics.businessModel || null,
      primaryMarket: null, // Can be enhanced later
      originalRevenue: financials?.revenue || metrics.revenue || null,
      originalEbitda: financials?.ebitda || metrics.ebitda || null,
      originalEmployeeCount: metrics.employeeCount || null
    };
  }
}
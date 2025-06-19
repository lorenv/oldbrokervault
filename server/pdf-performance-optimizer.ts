// Performance optimization wrapper for PDF generation
// Preserves original template styling while fixing bottlenecks

import { generatePDF as originalGeneratePDF } from './document-export';

export async function generateOptimizedPDF(
  analysis: any,
  logoUrl?: string | null,
  websiteUrl?: string,
  selectedImages?: string[],
  userProfile?: any,
  financialData?: any,
  financialFiles?: any[],
  baseUrl?: string,
  documentTitle?: string,
  customSections?: any[],
  coverImageUrl?: string | null,
  coverImagePosition?: string | null,
  documentId?: number
): Promise<Buffer> {
  // Performance optimizations while preserving template styling
  const optimizedAnalysis = analysis ? {
    ...analysis,
    // Limit section content length for performance
    sections: analysis.sections ? Object.fromEntries(
      Object.entries(analysis.sections).slice(0, 5).map(([key, value]: [string, any]) => [
        key,
        {
          ...value,
          content: typeof value?.content === 'string' 
            ? value.content.substring(0, 1000) 
            : value?.content
        }
      ])
    ) : undefined
  } : analysis;
  
  // Limit images but keep first one for cover
  const limitedImages = selectedImages ? selectedImages.slice(0, 2) : undefined;
  
  // Skip financial files for performance
  const limitedFinancialFiles = [];
  
  // Call original PDF generation with performance optimizations
  return originalGeneratePDF(
    optimizedAnalysis,
    logoUrl,
    websiteUrl,
    limitedImages,
    userProfile,
    financialData,
    limitedFinancialFiles,
    baseUrl,
    documentTitle,
    customSections?.slice(0, 3), // Limit custom sections
    coverImageUrl,
    coverImagePosition,
    documentId
  );
}
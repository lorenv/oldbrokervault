import '@ungap/with-resolvers'; // Required polyfill for Node < 22
import { getDocument } from 'pdfjs-dist';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

export interface TextExtractionResult {
  text: string;
  metadata: {
    filename: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount: number;
    extractedAt: string;
    processingTime: number;
  };
  success: boolean;
  error?: string;
}

export interface FileUploadInfo {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

class TextExtractionService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_TEXT_LENGTH = 500000; // 500k characters
  
  private readonly SUPPORTED_TYPES = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-word': ['.doc'],
    'application/rtf': ['.rtf'],
    'text/rtf': ['.rtf'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'application/octet-stream': ['.txt', '.md', '.rtf'] // fallback for some text files
  };

  /**
   * Validates if the file is supported for text extraction
   */
  validateFile(file: FileUploadInfo): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }

    // Check file extension
    const extension = path.extname(file.originalName).toLowerCase();
    const supportedExtensions = Object.values(this.SUPPORTED_TYPES).flat();
    
    if (!supportedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File type not supported. Supported formats: ${supportedExtensions.join(', ')}`
      };
    }

    // Validate filename
    if (!file.originalName || file.originalName.length > 255) {
      return {
        valid: false,
        error: 'Invalid filename'
      };
    }

    // Check for potentially malicious filenames
    if (file.originalName.includes('..') || file.originalName.includes('/') || file.originalName.includes('\\')) {
      return {
        valid: false,
        error: 'Invalid characters in filename'
      };
    }

    return { valid: true };
  }

  /**
   * Extracts text from uploaded file
   */
  async extractText(file: FileUploadInfo): Promise<TextExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Validate file first
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return {
          text: '',
          metadata: {
            filename: file.originalName,
            fileType: file.mimeType,
            fileSize: file.size,
            wordCount: 0,
            extractedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime
          },
          success: false,
          error: validation.error
        };
      }

      const extension = path.extname(file.originalName).toLowerCase();
      let extractedText = '';
      let pageCount: number | undefined;

      // Route to appropriate extraction method
      switch (extension) {
        case '.pdf':
          const pdfResult = await this.extractFromPDF(file.buffer);
          extractedText = pdfResult.text;
          pageCount = pdfResult.pageCount;
          break;
        
        case '.docx':
          extractedText = await this.extractFromDOCX(file.buffer);
          break;
        
        case '.doc':
          // For .doc files, we'll treat them as binary and try to extract what we can
          extractedText = await this.extractFromLegacyDoc(file.buffer);
          break;
        
        case '.rtf':
          extractedText = await this.extractFromRTF(file.buffer);
          break;
        
        case '.txt':
        case '.md':
          extractedText = await this.extractFromPlainText(file.buffer);
          break;
        
        default:
          // Try as plain text fallback
          extractedText = await this.extractFromPlainText(file.buffer);
          break;
      }

      // Sanitize and validate extracted text
      extractedText = this.sanitizeText(extractedText);
      
      if (extractedText.length > this.MAX_TEXT_LENGTH) {
        extractedText = extractedText.substring(0, this.MAX_TEXT_LENGTH) + '\n\n[Text truncated due to length limit]';
      }

      const wordCount = this.countWords(extractedText);
      const processingTime = Date.now() - startTime;

      return {
        text: extractedText,
        metadata: {
          filename: file.originalName,
          fileType: file.mimeType,
          fileSize: file.size,
          pageCount,
          wordCount,
          extractedAt: new Date().toISOString(),
          processingTime
        },
        success: true
      };

    } catch (error) {
      console.error('Text extraction error:', error);
      return {
        text: '',
        metadata: {
          filename: file.originalName,
          fileType: file.mimeType,
          fileSize: file.size,
          wordCount: 0,
          extractedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error'
      };
    }
  }

  /**
   * Extract text from PDF using pdf.js
   */
  private async extractFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      // Import worker (required for PDF.js)
      // @ts-ignore - Worker import doesn't have types
      await import('pdfjs-dist/build/pdf.worker.mjs');
      
      const uint8Array = new Uint8Array(buffer);
      const pdf = await getDocument({ data: uint8Array }).promise;
      const pageCount = pdf.numPages;
      
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pageCount; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          
          // Combine text items with proper spacing
          const pageText = content.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText) {
            fullText += `${pageText}\n\n`;
          }
        } catch (pageError) {
          console.warn(`Failed to extract text from page ${i}:`, pageError);
          // Continue with other pages
        }
      }
      
      return {
        text: fullText.trim(),
        pageCount
      };
    } catch (error) {
      throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from DOCX using mammoth
   */
  private async extractFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.messages.length > 0) {
        console.warn('DOCX extraction warnings:', result.messages);
      }
      
      return result.value || '';
    } catch (error) {
      throw new Error(`DOCX text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from legacy .doc files (limited support)
   */
  private async extractFromLegacyDoc(buffer: Buffer): Promise<string> {
    try {
      // Try to use mammoth for .doc files too (it has limited support)
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      // Fallback: try to extract readable text from binary
      const text = buffer.toString('utf8');
      const cleaned = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned.length < 50) {
        throw new Error('Unable to extract text from legacy .doc file. Please save as .docx or .txt format.');
      }
      
      return cleaned;
    }
  }

  /**
   * Extract text from RTF files
   */
  private async extractFromRTF(buffer: Buffer): Promise<string> {
    try {
      const rtfContent = buffer.toString('utf8');
      
      // Basic RTF parsing - remove RTF control codes
      let text = rtfContent
        .replace(/\\[a-z]+\d*\s?/gi, '') // Remove RTF control words
        .replace(/[{}]/g, '') // Remove braces
        .replace(/\\\\/g, '\\') // Unescape backslashes
        .replace(/\\'/g, "'") // Unescape quotes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      return text;
    } catch (error) {
      throw new Error(`RTF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  private async extractFromPlainText(buffer: Buffer): Promise<string> {
    try {
      // Try UTF-8 first
      let text = buffer.toString('utf8');
      
      // Check if it looks like valid UTF-8 text
      if (text.includes('\uFFFD') || text.length < buffer.length / 10) {
        // Try latin1 encoding as fallback
        text = buffer.toString('latin1');
      }
      
      return text.trim();
    } catch (error) {
      throw new Error(`Plain text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sanitize extracted text to remove potential security issues
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \t, \n, \r
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks
      .replace(/[ \t]{2,}/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Generate file hash for duplicate detection
   */
  generateFileHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex').substring(0, 16);
  }

  /**
   * Get supported file types for client validation
   */
  getSupportedTypes(): { extensions: string[]; mimeTypes: string[]; maxSize: number } {
    return {
      extensions: Object.values(this.SUPPORTED_TYPES).flat(),
      mimeTypes: Object.keys(this.SUPPORTED_TYPES),
      maxSize: this.MAX_FILE_SIZE
    };
  }
}

export const textExtractionService = new TextExtractionService();
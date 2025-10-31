import Anthropic from '@anthropic-ai/sdk';
import { objectStorage } from './object-storage';
import { db } from './db';
import { sdeAnalyses } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required for SDE Analyzer');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SKILL_ID = 'analyzing-sde-financials';
const SKILL_VERSION = 'latest'; // Use 'latest' for development, pin version for production

export class SDEAnalyzerService {
  /**
   * Upload a file to Claude Files API
   * @param fileBuffer The Excel file buffer
   * @param filename Original filename
   * @returns File ID from Claude API
   */
  async uploadToClaudeFiles(fileBuffer: Buffer, filename: string): Promise<string> {
    try {
      logger.info(`Uploading file to Claude Files API: ${filename}`);

      // Create a File object from buffer (Claude SDK expects a File or Blob)
      const file = new File([fileBuffer], filename, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Upload to Claude Files API
      const uploadResponse = await anthropic.files.create({
        file: file,
        purpose: 'batch' // Files API purpose
      });

      logger.info(`File uploaded successfully. File ID: ${uploadResponse.id}`);
      return uploadResponse.id;
    } catch (error) {
      logger.error('Error uploading file to Claude:', error);
      throw new Error(`Failed to upload file to Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Invoke the SDE Sheet skill to analyze the financial document
   * @param fileId File ID from Claude Files API
   * @param analysisId Database ID for tracking
   * @returns Message response from Claude
   */
  async invokeSdeSkill(fileId: string, analysisId: number): Promise<any> {
    try {
      logger.info(`Invoking SDE skill for analysis ID: ${analysisId}, file ID: ${fileId}`);

      // Update status to processing
      await db.update(sdeAnalyses)
        .set({
          status: 'processing',
          processingStartedAt: new Date(),
          claudeFileId: fileId
        })
        .where(eq(sdeAnalyses.id, analysisId));

      const startTime = Date.now();

      // Call Claude Messages API with code execution and skills
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        // Required beta headers for skills
        betas: ['code-execution-2025-08-25', 'skills-2025-10-02'],
        messages: [
          {
            role: 'user',
            content: `Analyze this Excel document and generate an SDE (Seller's Discretionary Earnings) Sheet. Please provide a comprehensive financial analysis including revenue, expenses, add-backs, and normalized earnings.`
          }
        ],
        // Attach the uploaded file
        tools: [
          {
            type: 'code_execution_2025_08_25',
            name: 'code_execution',
            container: {
              skills: [
                {
                  type: 'custom',
                  skill_id: SKILL_ID,
                  version: SKILL_VERSION
                }
              ]
            }
          }
        ]
      });

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`SDE skill completed in ${processingTime} seconds`);

      // Extract file_id from response if present
      let resultFileId: string | null = null;

      // Look for file outputs in the response
      if (message.content && Array.isArray(message.content)) {
        for (const block of message.content) {
          // Check for tool use blocks with file outputs
          if ('type' in block && block.type === 'tool_use' && 'output' in block) {
            const output = block.output as any;
            if (output?.file_id) {
              resultFileId = output.file_id;
              logger.info(`Found result file ID: ${resultFileId}`);
              break;
            }
          }
        }
      }

      return {
        message,
        resultFileId,
        processingTime,
        requestId: message.id
      };
    } catch (error) {
      logger.error('Error invoking SDE skill:', error);

      // Update database with error
      await db.update(sdeAnalyses)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error during processing'
        })
        .where(eq(sdeAnalyses.id, analysisId));

      throw error;
    }
  }

  /**
   * Download the result file from Claude Files API
   * @param fileId Result file ID from Claude
   * @returns File buffer and metadata
   */
  async downloadResultFile(fileId: string): Promise<{ buffer: Buffer; filename: string }> {
    try {
      logger.info(`Downloading result file: ${fileId}`);

      // Get file metadata first
      const fileMetadata = await anthropic.files.retrieve(fileId);
      logger.info(`File metadata: ${JSON.stringify(fileMetadata)}`);

      // Download the actual file content
      const fileContent = await anthropic.files.content(fileId);

      // Convert the response to a Buffer
      const arrayBuffer = await fileContent.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.info(`Downloaded file successfully. Size: ${buffer.length} bytes`);

      return {
        buffer,
        filename: fileMetadata.filename || `SDE_Sheet_${Date.now()}.xlsx`
      };
    } catch (error) {
      logger.error('Error downloading result file from Claude:', error);
      throw new Error(`Failed to download result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store the result file in object storage
   * @param buffer File buffer
   * @param filename Original filename
   * @param userId User ID for organization
   * @returns Object storage path
   */
  async storeResultFile(buffer: Buffer, filename: string, userId: number): Promise<{ path: string; size: number }> {
    try {
      const timestamp = Date.now();
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `sde-results/user-${userId}/${timestamp}-${safeName}`;

      logger.info(`Storing result file at: ${storagePath}`);

      await objectStorage.uploadBuffer(storagePath, buffer);

      return {
        path: storagePath,
        size: buffer.length
      };
    } catch (error) {
      logger.error('Error storing result file:', error);
      throw new Error(`Failed to store result file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a single analysis from start to finish
   * @param analysisId Database ID of the analysis to process
   */
  async processAnalysis(analysisId: number): Promise<void> {
    try {
      // Get the analysis record
      const [analysis] = await db.select()
        .from(sdeAnalyses)
        .where(eq(sdeAnalyses.id, analysisId))
        .limit(1);

      if (!analysis) {
        throw new Error(`Analysis ${analysisId} not found`);
      }

      if (analysis.status !== 'pending') {
        logger.warn(`Analysis ${analysisId} is not pending (status: ${analysis.status})`);
        return;
      }

      logger.info(`Processing analysis ${analysisId}: ${analysis.originalFilename}`);

      // Step 1: Read the original file from storage
      const fileBuffer = await objectStorage.downloadBuffer(analysis.originalFilePath);

      // Step 2: Upload to Claude Files API
      const claudeFileId = await this.uploadToClaudeFiles(fileBuffer, analysis.originalFilename);

      // Step 3: Invoke the SDE skill
      const result = await this.invokeSdeSkill(claudeFileId, analysisId);

      if (!result.resultFileId) {
        throw new Error('No result file generated by Claude skill');
      }

      // Step 4: Download the result
      const { buffer: resultBuffer, filename: resultFilename } = await this.downloadResultFile(result.resultFileId);

      // Step 5: Store the result in object storage
      const { path: resultPath, size: resultSize } = await this.storeResultFile(
        resultBuffer,
        resultFilename,
        analysis.userId
      );

      // Step 6: Update database with success
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      await db.update(sdeAnalyses)
        .set({
          status: 'completed',
          completedAt: new Date(),
          expiresAt: expiresAt,
          resultFilename,
          resultFilePath: resultPath,
          resultFileSize: resultSize,
          claudeResultFileId: result.resultFileId,
          claudeRequestId: result.requestId,
          processingTimeSeconds: result.processingTime
        })
        .where(eq(sdeAnalyses.id, analysisId));

      logger.info(`Analysis ${analysisId} completed successfully`);
    } catch (error) {
      logger.error(`Error processing analysis ${analysisId}:`, error);

      // Update with error status
      await db.update(sdeAnalyses)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown processing error'
        })
        .where(eq(sdeAnalyses.id, analysisId));

      throw error;
    }
  }

  /**
   * Get rate limit for user based on subscription tier
   */
  getSdeAnalysisLimit(subscriptionStatus: string): number {
    switch (subscriptionStatus) {
      case 'free':
        return 0; // Locked for free users
      case 'starter':
      case 'starter_monthly':
        return 5; // 5 per month
      case 'pro':
      case 'pro_monthly':
      case 'standard': // legacy name
        return 15; // 15 per month
      case 'enterprise':
      case 'admin':
        return Infinity; // Unlimited
      default:
        return 0;
    }
  }
}

export const sdeAnalyzerService = new SDEAnalyzerService();

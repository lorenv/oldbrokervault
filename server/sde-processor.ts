import { db } from './db';
import { sdeAnalyses, users } from '@shared/schema';
import { eq, and, isNull, or, lt } from 'drizzle-orm';
import { sdeAnalyzerService } from './sde-analyzer';
import { logger } from './logger';
import { emailService } from './email-service';
import { objectStorage } from './object-storage';

/**
 * Background processor for SDE analyses
 * Runs every 30 seconds to process pending analyses and clean up expired files
 */
export class SDEProcessor {
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Start the background processor
   */
  start() {
    if (this.processInterval) {
      logger.warn('SDE Processor is already running');
      return;
    }

    logger.info('Starting SDE Processor...');

    // Process pending analyses every 30 seconds
    this.processInterval = setInterval(() => {
      this.processPendingAnalyses().catch(error => {
        logger.error('Error in processPendingAnalyses:', error);
      });
    }, 30 * 1000); // 30 seconds

    // Clean up expired files every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredFiles().catch(error => {
        logger.error('Error in cleanupExpiredFiles:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    // Run immediately on startup
    this.processPendingAnalyses().catch(error => {
      logger.error('Error in initial processPendingAnalyses:', error);
    });

    logger.info('SDE Processor started successfully');
  }

  /**
   * Stop the background processor
   */
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info('SDE Processor stopped');
  }

  /**
   * Process all pending analyses (one at a time to avoid rate limits)
   */
  private async processPendingAnalyses() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      logger.debug('Already processing, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      // Get all pending analyses ordered by creation time
      const pendingAnalyses = await db.select()
        .from(sdeAnalyses)
        .where(eq(sdeAnalyses.status, 'pending'))
        .orderBy(sdeAnalyses.createdAt)
        .limit(10); // Process up to 10 at a time

      if (pendingAnalyses.length === 0) {
        logger.debug('No pending analyses to process');
        return;
      }

      logger.info(`Found ${pendingAnalyses.length} pending analysis(es)`);

      // Process one at a time
      for (const analysis of pendingAnalyses) {
        try {
          logger.info(`Processing analysis ${analysis.id}...`);
          await sdeAnalyzerService.processAnalysis(analysis.id);

          // Send completion email
          await this.sendCompletionEmail(analysis.id);

          logger.info(`Analysis ${analysis.id} processed and email sent`);
        } catch (error) {
          logger.error(`Failed to process analysis ${analysis.id}:`, error);
          // Continue to next analysis even if this one fails
        }

        // Add a small delay between analyses to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send completion email to user
   */
  private async sendCompletionEmail(analysisId: number) {
    try {
      // Get analysis and user data
      const [analysis] = await db.select({
        analysis: sdeAnalyses,
        user: users
      })
        .from(sdeAnalyses)
        .innerJoin(users, eq(users.id, sdeAnalyses.userId))
        .where(eq(sdeAnalyses.id, analysisId))
        .limit(1);

      if (!analysis || analysis.analysis.status !== 'completed') {
        logger.warn(`Cannot send email for analysis ${analysisId}: not completed`);
        return;
      }

      const { analysis: analysisData, user } = analysis;

      // Format expiration date
      const expirationDate = analysisData.expiresAt
        ? new Date(analysisData.expiresAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'N/A';

      // Format processing time
      const processingTime = analysisData.processingTimeSeconds
        ? `${analysisData.processingTimeSeconds} seconds`
        : 'N/A';

      // Send email via SendGrid
      // TODO: Create SendGrid template using /server/email-templates/sde-analysis-complete.html
      // and replace the templateId below with your actual template ID
      const SDE_COMPLETE_TEMPLATE_ID = process.env.SENDGRID_SDE_COMPLETE_TEMPLATE_ID || 'd-PLACEHOLDER';

      await emailService.sendTemplateEmail({
        to: user.email,
        from: 'support@brokervault.ai',
        templateId: SDE_COMPLETE_TEMPLATE_ID,
        dynamicTemplateData: {
          user_name: user.firstName || user.name || 'there',
          filename: analysisData.originalFilename,
          processing_time: processingTime,
          expiration_date: expirationDate,
          download_url: `${process.env.VITE_APP_URL || 'https://brokervault.ai'}/sde-analyzer`,
          analysis_id: analysisData.id
        }
      });

      logger.info(`Completion email sent to ${user.email} for analysis ${analysisId}`);
    } catch (error) {
      logger.error(`Failed to send completion email for analysis ${analysisId}:`, error);
      // Don't throw - email failure shouldn't fail the entire process
    }
  }

  /**
   * Clean up expired files (older than 30 days)
   */
  private async cleanupExpiredFiles() {
    try {
      logger.info('Running cleanup for expired SDE analysis files...');

      // Find all expired analyses that haven't been cleaned up yet
      const expiredAnalyses = await db.select()
        .from(sdeAnalyses)
        .where(
          and(
            eq(sdeAnalyses.status, 'completed'),
            lt(sdeAnalyses.expiresAt, new Date()),
            isNull(sdeAnalyses.resultFilePath) === false // Has a result file
          )
        );

      if (expiredAnalyses.length === 0) {
        logger.info('No expired files to clean up');
        return;
      }

      logger.info(`Found ${expiredAnalyses.length} expired file(s) to clean up`);

      for (const analysis of expiredAnalyses) {
        try {
          // Delete both original and result files from storage
          if (analysis.originalFilePath) {
            await objectStorage.deleteFile(analysis.originalFilePath).catch((err: Error) => {
              logger.warn(`Failed to delete original file ${analysis.originalFilePath}:`, err);
            });
          }

          if (analysis.resultFilePath) {
            await objectStorage.deleteFile(analysis.resultFilePath).catch((err: Error) => {
              logger.warn(`Failed to delete result file ${analysis.resultFilePath}:`, err);
            });
          }

          // Update database to mark files as deleted
          await db.update(sdeAnalyses)
            .set({
              originalFilePath: null,
              resultFilePath: null,
              resultFilename: null
            })
            .where(eq(sdeAnalyses.id, analysis.id));

          logger.info(`Cleaned up expired analysis ${analysis.id}`);
        } catch (error) {
          logger.error(`Failed to clean up analysis ${analysis.id}:`, error);
          // Continue to next file
        }
      }

      logger.info(`Cleanup complete: ${expiredAnalyses.length} file(s) processed`);
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Manually trigger processing (for testing)
   */
  async triggerProcessing() {
    return this.processPendingAnalyses();
  }

  /**
   * Manually trigger cleanup (for testing)
   */
  async triggerCleanup() {
    return this.cleanupExpiredFiles();
  }
}

// Singleton instance
export const sdeProcessor = new SDEProcessor();

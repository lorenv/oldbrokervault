import type { Express, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { sdeAnalyses, users } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { sdeAnalyzerService } from '../sde-analyzer';
import { objectStorage } from '../object-storage';
import { logger } from '../logger';
import fs from 'fs/promises';
import path from 'path';

// Configure multer for memory storage (Excel files only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB limit (Claude Files API limit)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xls, .xlsx) are allowed'));
    }
  }
});

/**
 * Check if user has access to SDE Analyzer based on subscription tier
 */
function hasSDEAccess(subscriptionStatus: string, isAdmin?: boolean): boolean {
  // Admins have unlimited access
  if (isAdmin) {
    return true;
  }

  // Free users don't have access
  return subscriptionStatus !== 'free';
}

/**
 * Get user's monthly SDE analysis count and limit
 */
async function checkUserLimit(userId: number, subscriptionStatus: string, isAdmin?: boolean): Promise<{ canUpload: boolean; used: number; limit: number }> {
  // Admins have unlimited access (represented by -1)
  if (isAdmin) {
    return { canUpload: true, used: 0, limit: -1 };
  }

  const limit = sdeAnalyzerService.getSdeAnalysisLimit(subscriptionStatus);

  // Get user's current monthly count
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const used = user.monthlySdeAnalyses || 0;
  const canUpload = used < limit;

  return { canUpload, used, limit };
}

/**
 * Helper: Store file with fallback to filesystem if object storage unavailable
 */
async function storeFile(storagePath: string, buffer: Buffer): Promise<{ success: boolean; useFilesystem: boolean; path: string }> {
  // Try object storage first
  try {
    await objectStorage.uploadBuffer(storagePath, buffer);
    return { success: true, useFilesystem: false, path: storagePath };
  } catch (error) {
    logger.warn('Object storage unavailable, falling back to filesystem:', error);

    // Fall back to filesystem
    try {
      const filesystemPath = path.join(process.cwd(), 'storage', 'sde-files', storagePath);
      await fs.mkdir(path.dirname(filesystemPath), { recursive: true });
      await fs.writeFile(filesystemPath, buffer);
      return { success: true, useFilesystem: true, path: storagePath };
    } catch (fsError) {
      logger.error('Failed to store file in filesystem:', fsError);
      throw new Error('Failed to store file');
    }
  }
}

/**
 * Helper: Retrieve file with fallback to filesystem
 */
async function retrieveFile(storagePath: string, useFilesystem: boolean): Promise<Buffer> {
  if (useFilesystem) {
    const filesystemPath = path.join(process.cwd(), 'storage', 'sde-files', storagePath);
    return await fs.readFile(filesystemPath);
  } else {
    return await objectStorage.downloadBuffer(storagePath);
  }
}

/**
 * Register SDE Analyzer routes
 */
export function registerSDEAnalyzerRoutes(app: Express) {
  /**
   * POST /api/sde-analyzer/upload
   * Upload an Excel file for SDE analysis
   */
  app.post('/api/sde-analyzer/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;

      // Check if user has access to SDE Analyzer
      if (!hasSDEAccess(user.subscriptionStatus, user.isAdmin)) {
        return res.status(403).json({
          error: 'subscription_required',
          title: 'Subscription Required',
          message: 'The SDE Analyzer is available on paid plans only. Upgrade to Starter, Pro, or Enterprise to access this feature.',
          action: 'upgrade',
          currentPlan: user.subscriptionStatus,
          requiredPlan: 'starter'
        });
      }

      // Check rate limit
      const { canUpload, used, limit } = await checkUserLimit(user.id, user.subscriptionStatus, user.isAdmin);

      if (!canUpload) {
        return res.status(429).json({
          error: 'monthly_limit_reached',
          title: 'Monthly Limit Reached',
          message: `You've used all ${limit} of your monthly SDE analyses. Upgrade your plan for a higher monthly limit.`,
          action: 'upgrade',
          used,
          limit,
          currentPlan: user.subscriptionStatus,
          upgradeBenefit: user.subscriptionStatus === 'starter' || user.subscriptionStatus === 'starter_monthly'
            ? 'Upgrade to Pro for 15 analyses per month'
            : 'Upgrade to Enterprise for unlimited analyses'
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.file;
      logger.info(`SDE upload from user ${user.id}: ${file.originalname} (${file.size} bytes)`);

      // Store original file (try object storage, fall back to filesystem)
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `sde-originals/user-${user.id}/${timestamp}-${safeName}`;

      const storageResult = await storeFile(storagePath, file.buffer);

      if (!storageResult.success) {
        return res.status(500).json({ error: 'Failed to store file' });
      }

      // Create database record
      const [analysis] = await db.insert(sdeAnalyses)
        .values({
          userId: user.id,
          originalFilename: file.originalname,
          originalFilePath: storagePath,
          originalFileSize: file.size,
          originalMimeType: file.mimetype,
          status: 'pending',
          useFilesystemStorage: storageResult.useFilesystem
        })
        .returning();

      // Increment user's monthly count (skip for admins)
      if (!user.isAdmin) {
        await db.update(users)
          .set({
            monthlySdeAnalyses: (user.monthlySdeAnalyses || 0) + 1
          })
          .where(eq(users.id, user.id));
      }

      logger.info(`Created SDE analysis ${analysis.id} for user ${user.id}`);

      // Trigger background processing (don't await - let it run async)
      sdeAnalyzerService.processAnalysis(analysis.id).catch(err => {
        logger.error(`Background processing failed for analysis ${analysis.id}:`, err);
      });

      res.status(201).json({
        success: true,
        analysis: {
          id: analysis.id,
          filename: analysis.originalFilename,
          status: analysis.status,
          createdAt: analysis.createdAt
        },
        message: 'File uploaded successfully. Analysis started - check back in a few minutes for your SDE Sheet.'
      });
    } catch (error) {
      logger.error('Error in SDE upload:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/sde-analyzer/list
   * Get user's SDE analyses with pagination
   */
  app.get('/api/sde-analyzer/list', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Get user's analyses
      const analyses = await db.select()
        .from(sdeAnalyses)
        .where(eq(sdeAnalyses.userId, user.id))
        .orderBy(desc(sdeAnalyses.createdAt))
        .limit(limit)
        .offset(offset);

      // Get user's usage stats
      const { used, limit: monthlyLimit } = await checkUserLimit(user.id, user.subscriptionStatus, user.isAdmin);

      res.json({
        success: true,
        analyses: analyses.map(a => ({
          id: a.id,
          originalFilename: a.originalFilename,
          resultFilename: a.resultFilename,
          status: a.status,
          errorMessage: a.errorMessage,
          analysisWarnings: a.analysisWarnings || [],
          createdAt: a.createdAt,
          completedAt: a.completedAt,
          expiresAt: a.expiresAt,
          processingTimeSeconds: a.processingTimeSeconds,
          downloadCount: a.downloadCount
        })),
        usage: {
          used,
          limit: monthlyLimit,
          remaining: monthlyLimit - used
        }
      });
    } catch (error) {
      logger.error('Error listing analyses:', error);
      res.status(500).json({ error: 'Failed to list analyses' });
    }
  });

  /**
   * GET /api/sde-analyzer/status/:id
   * Get status of a specific analysis
   */
  app.get('/api/sde-analyzer/status/:id', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;
      const analysisId = parseInt(req.params.id);

      if (isNaN(analysisId)) {
        return res.status(400).json({ error: 'Invalid analysis ID' });
      }

      // Get analysis
      const [analysis] = await db.select()
        .from(sdeAnalyses)
        .where(
          and(
            eq(sdeAnalyses.id, analysisId),
            eq(sdeAnalyses.userId, user.id)
          )
        )
        .limit(1);

      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      res.json({
        success: true,
        analysis: {
          id: analysis.id,
          status: analysis.status,
          originalFilename: analysis.originalFilename,
          resultFilename: analysis.resultFilename,
          errorMessage: analysis.errorMessage,
          analysisWarnings: analysis.analysisWarnings || [],
          createdAt: analysis.createdAt,
          completedAt: analysis.completedAt,
          expiresAt: analysis.expiresAt,
          processingTimeSeconds: analysis.processingTimeSeconds
        }
      });
    } catch (error) {
      logger.error('Error getting analysis status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  /**
   * GET /api/sde-analyzer/download/:id
   * Download the result file
   */
  app.get('/api/sde-analyzer/download/:id', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;
      const analysisId = parseInt(req.params.id);

      if (isNaN(analysisId)) {
        return res.status(400).json({ error: 'Invalid analysis ID' });
      }

      // Get analysis
      const [analysis] = await db.select()
        .from(sdeAnalyses)
        .where(
          and(
            eq(sdeAnalyses.id, analysisId),
            eq(sdeAnalyses.userId, user.id)
          )
        )
        .limit(1);

      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      if (analysis.status !== 'completed') {
        return res.status(400).json({
          error: 'Analysis not completed',
          status: analysis.status
        });
      }

      if (!analysis.resultFilePath) {
        return res.status(404).json({ error: 'Result file not found or has expired' });
      }

      // Check if expired
      if (analysis.expiresAt && new Date(analysis.expiresAt) < new Date()) {
        return res.status(410).json({
          error: 'File has expired',
          message: 'This file has expired and is no longer available for download (files are retained for 30 days).'
        });
      }

      // Read file from storage (object storage or filesystem fallback)
      const fileBuffer = await retrieveFile(analysis.resultFilePath, analysis.useFilesystemStorage || false);

      // Update download count
      await db.update(sdeAnalyses)
        .set({
          downloadCount: (analysis.downloadCount || 0) + 1,
          lastDownloadedAt: new Date()
        })
        .where(eq(sdeAnalyses.id, analysisId));

      // Send file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${analysis.resultFilename || 'SDE_Sheet.xlsx'}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.send(fileBuffer);

      logger.info(`User ${user.id} downloaded analysis ${analysisId}`);
    } catch (error) {
      logger.error('Error downloading result:', error);
      res.status(500).json({ error: 'Download failed' });
    }
  });

  /**
   * DELETE /api/sde-analyzer/:id
   * Delete an analysis
   */
  app.delete('/api/sde-analyzer/:id', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;
      const analysisId = parseInt(req.params.id);

      if (isNaN(analysisId)) {
        return res.status(400).json({ error: 'Invalid analysis ID' });
      }

      // Get analysis
      const [analysis] = await db.select()
        .from(sdeAnalyses)
        .where(
          and(
            eq(sdeAnalyses.id, analysisId),
            eq(sdeAnalyses.userId, user.id)
          )
        )
        .limit(1);

      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Delete files from storage
      if (analysis.originalFilePath) {
        await objectStorage.deleteFile(analysis.originalFilePath).catch(err => {
          logger.warn(`Failed to delete original file: ${err}`);
        });
      }

      if (analysis.resultFilePath) {
        await objectStorage.deleteFile(analysis.resultFilePath).catch(err => {
          logger.warn(`Failed to delete result file: ${err}`);
        });
      }

      // Delete database record
      await db.delete(sdeAnalyses)
        .where(eq(sdeAnalyses.id, analysisId));

      logger.info(`User ${user.id} deleted analysis ${analysisId}`);

      res.json({ success: true, message: 'Analysis deleted successfully' });
    } catch (error) {
      logger.error('Error deleting analysis:', error);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  /**
   * GET /api/sde-analyzer/test-ai
   * Test if OpenAI is configured and working
   */
  app.get('/api/sde-analyzer/test-ai', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      if (!hasOpenAI) {
        return res.json({
          configured: false,
          message: 'OPENAI_API_KEY not set. Add it to Repl Secrets for AI-enhanced analysis.'
        });
      }

      // Try a simple OpenAI call
      try {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "OK" if you receive this.' }],
          max_tokens: 10
        });

        const reply = response.choices[0]?.message?.content || '';

        return res.json({
          configured: true,
          working: true,
          message: 'OpenAI is configured and working!',
          test_response: reply
        });
      } catch (error) {
        logger.error('OpenAI test call failed:', error);
        return res.json({
          configured: true,
          working: false,
          message: 'OpenAI key is set but API call failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (error) {
      logger.error('Error testing OpenAI:', error);
      res.status(500).json({ error: 'Test failed' });
    }
  });

  /**
   * GET /api/sde-analyzer/usage
   * Get user's usage stats
   */
  app.get('/api/sde-analyzer/usage', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;
      const hasAccess = hasSDEAccess(user.subscriptionStatus, user.isAdmin);
      const { used, limit } = await checkUserLimit(user.id, user.subscriptionStatus, user.isAdmin);

      res.json({
        success: true,
        hasAccess,
        usage: {
          used,
          limit,
          remaining: limit - used
        },
        subscriptionStatus: user.subscriptionStatus
      });
    } catch (error) {
      logger.error('Error getting usage:', error);
      res.status(500).json({ error: 'Failed to get usage' });
    }
  });
}

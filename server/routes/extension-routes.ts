/**
 * Extension API Routes
 *
 * Endpoints for Chrome extension to create CIM documents from scraped webpage data.
 * Uses async job processing with polling for status updates.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { cimDocuments, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { extensionTokenAuth, ExtensionAuthRequest } from '../middleware/extension-token-auth';
import { generateCimWithWebsiteAnalysis, startWebsiteAnalysis } from '../perplexity';
import { normalizeUrl, extractLogoFromWebsite } from '../website-analyzer';
import { storage } from '../storage';
import { isUrlSafeForFetch } from '../security';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

// Apply extension token auth to all routes
router.use(extensionTokenAuth as any);

// In-memory job store with TTL (1 hour)
interface CimJob {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  cimDocumentId?: number;
  error?: string;
  createdAt: Date;
  userId: number;
}

const jobStore = new Map<string, CimJob>();

// Clean up old jobs every 15 minutes
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const jobIds = Array.from(jobStore.keys());
  for (const jobId of jobIds) {
    const job = jobStore.get(jobId);
    if (job && job.createdAt < oneHourAgo) {
      jobStore.delete(jobId);
    }
  }
}, 15 * 60 * 1000);

// Request schema for extension CIM creation
const extensionCimRequestSchema = z.object({
  sourceUrl: z.string().url(),
  scrapedData: z.object({
    title: z.string(),
    metaDescription: z.string().optional(),
    ogTitle: z.string().optional(),
    ogDescription: z.string().optional(),
    ogImage: z.string().optional(),
    textContent: z.string().optional(),
    schemaOrg: z.any().optional(), // JSON-LD schema.org data
  }),
  options: z.object({
    formattingProfile: z.enum(['balanced', 'professional', 'memo']).optional(),
  }).optional(),
});

/**
 * POST /api/extension/cim
 *
 * Create a CIM document from scraped webpage data.
 * Returns a jobId immediately; client polls for completion.
 */
router.post('/cim', async (req: ExtensionAuthRequest, res: Response) => {
  try {
    // Validate request
    const parseResult = extensionCimRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.issues
      });
    }

    const { sourceUrl, scrapedData, options } = parseResult.data;
    const user = req.user as any;

    // Validate URL is safe
    if (!isUrlSafeForFetch(sourceUrl)) {
      return res.status(400).json({ error: 'Invalid or blocked URL' });
    }

    // Check user's document creation limits
    const canCreate = await storage.checkUserLimit(user.id);
    if (!canCreate) {
      return res.status(403).json({
        error: 'Document creation limit reached',
        message: 'You have reached your document creation limit.'
      });
    }

    // Generate job ID
    const jobId = `job_${crypto.randomBytes(16).toString('hex')}`;

    // Store job as pending
    jobStore.set(jobId, {
      status: 'pending',
      createdAt: new Date(),
      userId: user.id
    });

    // Return job ID immediately
    res.status(202).json({
      jobId,
      status: 'pending',
      message: 'CIM generation started'
    });

    // Process CIM generation asynchronously
    processCimGeneration(jobId, user, sourceUrl, scrapedData, options).catch(error => {
      console.error('CIM generation error:', error);
      const job = jobStore.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message || 'Unknown error occurred';
      }
    });

  } catch (error: any) {
    console.error('Extension CIM route error:', error);
    res.status(500).json({ error: 'Failed to start CIM generation' });
  }
});

/**
 * GET /api/extension/cim/:jobId
 *
 * Check the status of a CIM generation job.
 */
router.get('/cim/:jobId', async (req: ExtensionAuthRequest, res: Response) => {
  const { jobId } = req.params;
  const user = req.user as any;

  const job = jobStore.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Verify job belongs to this user
  if (job.userId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const response: any = {
    jobId,
    status: job.status,
    createdAt: job.createdAt
  };

  if (job.status === 'completed' && job.cimDocumentId) {
    response.cimDocumentId = job.cimDocumentId;
    // Include URL to edit the document
    response.editUrl = `/cim/${job.cimDocumentId}/edit`;
  }

  if (job.status === 'failed') {
    response.error = job.error;
  }

  res.json(response);
});

/**
 * GET /api/extension/cim
 *
 * List recent CIM documents created by the user.
 */
router.get('/cim', async (req: ExtensionAuthRequest, res: Response) => {
  try {
    const user = req.user as any;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const result = await storage.getCimDocuments(user.id, { limit });
    const recentDocs = result.documents.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      websiteUrl: doc.websiteUrl,
      shareSlug: doc.shareSlug,
      createdAt: doc.createdAt
    }));

    res.json({ documents: recentDocs });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * Async function to process CIM generation.
 */
async function processCimGeneration(
  jobId: string,
  user: any,
  sourceUrl: string,
  scrapedData: z.infer<typeof extensionCimRequestSchema>['scrapedData'],
  options?: z.infer<typeof extensionCimRequestSchema>['options']
) {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = 'processing';

  try {
    console.log(`🔧 Extension CIM generation started for job ${jobId}`);
    console.log(`📄 Source URL: ${sourceUrl}`);

    // Build transcript from scraped data
    const transcript = buildTranscriptFromScrapedData(scrapedData, sourceUrl);

    // Normalize URL for logo extraction
    let normalizedUrl: string | null = null;
    let logoExtractionPromise: Promise<string | null> = Promise.resolve(null);

    try {
      normalizedUrl = normalizeUrl(sourceUrl);
      // Start logo extraction in parallel
      logoExtractionPromise = extractLogoFromWebsite(normalizedUrl, user.id).catch(err => {
        console.error('Logo extraction error:', err);
        return null;
      });
    } catch (error) {
      console.error('URL normalization error:', error);
    }

    // Start website analysis for additional context
    const websiteAnalysisPromise = startWebsiteAnalysis(sourceUrl).catch(err => {
      console.error('Website analysis error:', err);
      return null;
    });

    // Wait for website analysis
    const websiteData = await websiteAnalysisPromise;

    // Generate CIM
    const analysis = await generateCimWithWebsiteAnalysis(
      transcript,
      'Generated from Chrome extension webpage scrape',
      'business_overview',
      'professional',
      'investors',
      undefined, // financials
      sourceUrl,
      undefined, // sectionDirections
      options?.formattingProfile || 'balanced',
      websiteData,
      null // customStyleConfig
    );

    // Wait for logo extraction
    const logoUrl = await logoExtractionPromise;

    // Generate share slug
    const randomId = Math.random().toString(36).substring(2, 8);
    const shareSlug = `cim-${randomId}`;

    // Create document
    const doc = await storage.createCimDocument(user.id, {
      title: scrapedData.title || analysis.title || 'CIM Document',
      transcript,
      directions: 'Generated from Chrome extension webpage scrape',
      websiteUrl: sourceUrl,
      logoUrl,
      analysis,
      selectedImages: [],
      regenerationCount: 0,
      financialsEnabled: true,
      shareEnabled: true,
      shareSlug,
      sharePassword: null,
      shareExpiresAt: null,
      ndaProtected: false,
      ndaTemplateId: null,
      ndaApprovalRequired: false,
      dealId: null
    });

    // Update document creation usage
    await storage.updateDocumentCreationUsage(user.id);

    console.log(`✅ Extension CIM created: ${doc.id} for job ${jobId}`);

    // Update job status
    job.status = 'completed';
    job.cimDocumentId = doc.id;

  } catch (error: any) {
    console.error(`❌ Extension CIM generation failed for job ${jobId}:`, error);
    job.status = 'failed';
    job.error = error.message || 'CIM generation failed';
  }
}

/**
 * Build a transcript from scraped webpage data.
 */
function buildTranscriptFromScrapedData(
  scrapedData: z.infer<typeof extensionCimRequestSchema>['scrapedData'],
  sourceUrl: string
): string {
  const parts: string[] = [];

  // Add title
  const title = scrapedData.ogTitle || scrapedData.title;
  if (title) {
    parts.push(`Company/Page Title: ${title}`);
  }

  // Add description
  const description = scrapedData.ogDescription || scrapedData.metaDescription;
  if (description) {
    parts.push(`Description: ${description}`);
  }

  // Add source URL
  parts.push(`Website: ${sourceUrl}`);

  // Add Schema.org data if available
  if (scrapedData.schemaOrg) {
    try {
      const schemaText = extractSchemaOrgText(scrapedData.schemaOrg);
      if (schemaText) {
        parts.push(`Additional Information:\n${schemaText}`);
      }
    } catch (e) {
      // Ignore schema parsing errors
    }
  }

  // Add text content (truncated to 50k chars)
  if (scrapedData.textContent) {
    const truncatedContent = scrapedData.textContent.slice(0, 50000);
    parts.push(`Page Content:\n${truncatedContent}`);
  }

  return parts.join('\n\n');
}

/**
 * Extract readable text from Schema.org JSON-LD data.
 */
function extractSchemaOrgText(schemaOrg: any): string {
  if (!schemaOrg) return '';

  const parts: string[] = [];

  // Handle array of schema objects
  const schemas = Array.isArray(schemaOrg) ? schemaOrg : [schemaOrg];

  for (const schema of schemas) {
    if (schema['@type'] === 'Organization') {
      if (schema.name) parts.push(`Organization: ${schema.name}`);
      if (schema.description) parts.push(`About: ${schema.description}`);
      if (schema.foundingDate) parts.push(`Founded: ${schema.foundingDate}`);
      if (schema.numberOfEmployees) {
        const employees = typeof schema.numberOfEmployees === 'object'
          ? schema.numberOfEmployees.value
          : schema.numberOfEmployees;
        if (employees) parts.push(`Employees: ${employees}`);
      }
    }

    if (schema['@type'] === 'LocalBusiness' || schema['@type'] === 'Corporation') {
      if (schema.name) parts.push(`Business: ${schema.name}`);
      if (schema.description) parts.push(`About: ${schema.description}`);
      if (schema.address) {
        const addr = typeof schema.address === 'string'
          ? schema.address
          : [schema.address.streetAddress, schema.address.addressLocality, schema.address.addressRegion].filter(Boolean).join(', ');
        if (addr) parts.push(`Location: ${addr}`);
      }
    }

    if (schema['@type'] === 'Product' || schema['@type'] === 'Service') {
      if (schema.name) parts.push(`Product/Service: ${schema.name}`);
      if (schema.description) parts.push(`Description: ${schema.description}`);
    }
  }

  return parts.join('\n');
}

export default router;

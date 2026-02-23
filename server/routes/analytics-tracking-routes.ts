import type { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, sql, inArray, desc, gte, lt, isNull, count as countFn } from 'drizzle-orm';
import { cimDocuments, documentViews, ndaSignatures, documentDownloads } from '@shared/schema';
import { searchService, versionService, analyticsService } from '../premium-services';
import { hasPremiumAccess } from '../route-utils';

export function registerAnalyticsRoutes(app: Express) {
  // Enhanced CIM Analytics (basic view stats)
  app.get("/api/cim/:id/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const cim = await storage.getCimDocument(docId);

      if (!cim || cim.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get comprehensive view statistics using new tracking system
      const viewStats = await storage.getDocumentViewStats(docId);

      // DEBUG: Log analytics calculation
      console.log("🔍 ANALYTICS DEBUG:", {
        docId,
        rawViewStats: viewStats,
        totalViewsType: typeof viewStats.totalViews,
        totalViewsValue: viewStats.totalViews
      });

      // Return enhanced analytics with NDA-aware view tracking
      const analytics = {
        totalViews: viewStats.totalViews,
        anonymousViews: viewStats.anonymousViews,
        ndaSignerViews: viewStats.ndaSignerViews,
        uniqueNdaSigners: viewStats.uniqueNdaSigners,
        legacyShareViewCount: cim.shareViewCount || 0,
        ndaProtected: cim.ndaProtected,
        documentType: cim.ndaProtected ? 'nda_protected' : 'public',
        recentViews: viewStats.recentViews,
        dailyViews: viewStats.dailyViews
      };

      res.json(analytics);
    } catch (error) {
      console.error('Enhanced analytics error:', error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // NDA Signer View History endpoint
  app.get("/api/cim/:docId/nda-signer-views/:signerEmail", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const signerEmail = decodeURIComponent(req.params.signerEmail);

      const doc = await storage.getCimDocument(docId);

      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!doc.ndaProtected) {
        return res.status(400).json({ error: "Document is not NDA protected" });
      }

      const maxLimit = 100;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, maxLimit);
      const offset = parseInt(req.query.offset as string) || 0;

      const viewHistory = await storage.getNdaSignerViewHistory(docId, signerEmail, { limit, offset });
      res.json(viewHistory);
    } catch (error) {
      console.error("NDA signer view history error:", error);
      res.status(500).json({ error: "Failed to get signer view history" });
    }
  });

  // Premium Feature: Search
  app.get("/api/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      // Search features are now available to all users

      const { q: query, start, end } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }

      const filters: any = {};
      if (start && end) {
        filters.dateRange = {
          start: new Date(start as string),
          end: new Date(end as string)
        };
      }

      const results = await searchService.searchDocuments(req.user!.id, query, filters);

      // Track search analytics
      await analyticsService.trackAction(0, req.user!.id, 'search', { query, resultCount: results.length });

      res.json({ results, total: results.length });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Premium Feature: Version History
  app.get("/api/cim/:id/versions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      // Version history is now available to all users

      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);

      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const versions = await versionService.getVersionHistory(docId);
      res.json(versions);
    } catch (error) {
      console.error("Version history error:", error);
      res.status(500).json({ error: "Failed to get version history" });
    }
  });

  // Premium Feature: Restore Version
  app.post("/api/cim/:id/restore/:version", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || !hasPremiumAccess(user)) {
        return res.status(403).json({
          error: "Version restore requires a premium subscription",
          upgradeRequired: true
        });
      }

      const docId = parseInt(req.params.id);
      const targetVersion = parseInt(req.params.version);

      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const restoredVersion = await versionService.restoreVersion(docId, targetVersion, req.user!.id);

      // Track analytics
      await analyticsService.trackAction(docId, req.user!.id, 'restore_version', { targetVersion });

      res.json({ success: true, version: restoredVersion });
    } catch (error) {
      console.error("Version restore error:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  // Premium Feature: Document Analytics (with time range)
  app.get("/api/cim/:id/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      // Analytics are now available to all users

      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);

      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const { start, end } = req.query;
      const timeRange = start && end ? {
        start: new Date(start as string),
        end: new Date(end as string)
      } : undefined;

      const analytics = await analyticsService.getDocumentAnalytics(docId, timeRange);
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // User Analytics Dashboard - Available to all users
  app.get("/api/analytics/dashboard", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { start, end } = req.query;
      const timeRange = start && end ? {
        start: new Date(start as string),
        end: new Date(end as string)
      } : undefined;

      const userAnalytics = await analyticsService.getUserAnalytics(req.user!.id, timeRange);
      res.json(userAnalytics);
    } catch (error) {
      console.error("User analytics error:", error);
      res.status(500).json({ error: "Failed to get user analytics" });
    }
  });

  // Analytics Overview - Aggregate analytics across all user's documents
  app.get("/api/analytics/overview", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const range = (req.query.range as string) || '30d';

      // Get all user's CIM documents
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));

      const docIds = userDocs.map(doc => doc.id);

      if (docIds.length === 0) {
        return res.json({
          totalViews: 0,
          totalSignatures: 0,
          pendingApprovals: 0,
          activeDocuments: 0,
          viewsTrend: 0,
          signaturesTrend: 0
        });
      }

      // Calculate date ranges based on range parameter
      const now = new Date();
      let rangeDays: number;
      let currentStartDate: Date;
      let previousStartDate: Date;
      let previousEndDate: Date;

      switch (range) {
        case '7d':
          rangeDays = 7;
          break;
        case '30d':
          rangeDays = 30;
          break;
        case '90d':
          rangeDays = 90;
          break;
        case 'all':
          rangeDays = 0;
          break;
        default:
          rangeDays = 30;
      }

      if (range === 'all') {
        currentStartDate = new Date(0);
        previousStartDate = new Date(0);
        previousEndDate = new Date(0);
      } else {
        currentStartDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
        previousEndDate = currentStartDate;
        previousStartDate = new Date(currentStartDate.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      }

      // Count views in current period
      const [currentViewsResult] = await db
        .select({ count: countFn() })
        .from(documentViews)
        .where(and(
          inArray(documentViews.cimDocumentId, docIds),
          range === 'all' ? sql`1=1` : gte(documentViews.viewedAt, currentStartDate)
        ));
      const totalViews = Number(currentViewsResult?.count || 0);

      // Count signatures in current period
      const [currentSigsResult] = await db
        .select({ count: countFn() })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          range === 'all' ? sql`1=1` : gte(ndaSignatures.signedAt, currentStartDate)
        ));
      const totalSignatures = Number(currentSigsResult?.count || 0);

      // Count pending approvals (always total, not affected by date range)
      const [pendingResult] = await db
        .select({ count: countFn() })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          eq(ndaSignatures.approved, false),
          eq(ndaSignatures.rejected, false)
        ));
      const pendingApprovals = Number(pendingResult?.count || 0);

      // Count active documents (always total, not affected by date range)
      const [activeResult] = await db
        .select({ count: countFn() })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          eq(cimDocuments.shareEnabled, true),
          isNull(cimDocuments.deletedAt)
        ));
      const activeDocuments = Number(activeResult?.count || 0);

      // Calculate trends (compare current period vs previous period of same length)
      let viewsTrend = 0;
      let signaturesTrend = 0;

      if (range !== 'all') {
        // Previous period views
        const [previousViewsResult] = await db
          .select({ count: countFn() })
          .from(documentViews)
          .where(and(
            inArray(documentViews.cimDocumentId, docIds),
            gte(documentViews.viewedAt, previousStartDate),
            lt(documentViews.viewedAt, previousEndDate)
          ));
        const previousViews = Number(previousViewsResult?.count || 0);

        // Previous period signatures
        const [previousSigsResult] = await db
          .select({ count: countFn() })
          .from(ndaSignatures)
          .where(and(
            inArray(ndaSignatures.cimDocumentId, docIds),
            gte(ndaSignatures.signedAt, previousStartDate),
            lt(ndaSignatures.signedAt, previousEndDate)
          ));
        const previousSignatures = Number(previousSigsResult?.count || 0);

        // Calculate percentage trends (handle division by zero)
        viewsTrend = previousViews > 0
          ? Math.round(((totalViews - previousViews) / previousViews) * 100)
          : totalViews > 0 ? 100 : 0;

        signaturesTrend = previousSignatures > 0
          ? Math.round(((totalSignatures - previousSignatures) / previousSignatures) * 100)
          : totalSignatures > 0 ? 100 : 0;
      }

      res.json({
        totalViews,
        totalSignatures,
        pendingApprovals,
        activeDocuments,
        viewsTrend,
        signaturesTrend
      });
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Analytics Timeline - Time-series data for views and signatures
  app.get("/api/analytics/timeline", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const range = (req.query.range as string) || '30d';

      // Calculate date range
      const now = new Date();
      let startDate: Date;

      switch (range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get all user's CIM documents
      const userDocs = await db
        .select({ id: cimDocuments.id })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));

      const docIds = userDocs.map(doc => doc.id);

      if (docIds.length === 0) {
        return res.json([]);
      }

      // Get views grouped by date
      const viewsByDate = await db
        .select({
          date: sql<string>`DATE(${documentViews.viewedAt})`,
          count: sql<number>`COUNT(*)::int`
        })
        .from(documentViews)
        .where(and(
          inArray(documentViews.cimDocumentId, docIds),
          gte(documentViews.viewedAt, startDate)
        ))
        .groupBy(sql`DATE(${documentViews.viewedAt})`);

      // Get signatures grouped by date
      const signaturesByDate = await db
        .select({
          date: sql<string>`DATE(${ndaSignatures.signedAt})`,
          count: sql<number>`COUNT(*)::int`
        })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          gte(ndaSignatures.signedAt, startDate)
        ))
        .groupBy(sql`DATE(${ndaSignatures.signedAt})`);

      // Create a map for quick lookup
      const viewsMap = new Map(viewsByDate.map(v => [v.date, Number(v.count)]));
      const signaturesMap = new Map(signaturesByDate.map(s => [s.date, Number(s.count)]));

      // Get all unique dates
      const allDates = new Set([...viewsMap.keys(), ...signaturesMap.keys()]);

      // Build timeline array
      const timeline = Array.from(allDates).map(date => ({
        date,
        views: viewsMap.get(date) || 0,
        signatures: signaturesMap.get(date) || 0
      }));

      // Sort by date ascending
      timeline.sort((a, b) => a.date.localeCompare(b.date));

      res.json(timeline);
    } catch (error) {
      console.error('Error fetching analytics timeline:', error);
      res.status(500).json({ error: "Failed to fetch analytics timeline" });
    }
  });

  // Analytics Documents - Per-document analytics
  app.get("/api/analytics/documents", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Get all user's CIM documents
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title,
          shareEnabled: cimDocuments.shareEnabled
        })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));

      if (userDocs.length === 0) {
        return res.json([]);
      }

      // Get view counts and time spent for each document
      const viewCounts = await db
        .select({
          cimDocumentId: documentViews.cimDocumentId,
          count: sql<number>`COUNT(*)::int`,
          totalTimeSpent: sql<number>`COALESCE(SUM(${documentViews.timeSpentSeconds}), 0)::int`,
          lastViewedAt: sql<Date>`MAX(${documentViews.viewedAt})`
        })
        .from(documentViews)
        .where(inArray(documentViews.cimDocumentId, userDocs.map(d => d.id)))
        .groupBy(documentViews.cimDocumentId);

      // Get signature counts for each document
      const signatureCounts = await db
        .select({
          cimDocumentId: ndaSignatures.cimDocumentId,
          count: sql<number>`COUNT(*)::int`,
          lastSignedAt: sql<Date>`MAX(${ndaSignatures.signedAt})`
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, userDocs.map(d => d.id)))
        .groupBy(ndaSignatures.cimDocumentId);

      // Get download counts for each document
      const downloadCounts = await db
        .select({
          cimDocumentId: documentDownloads.cimDocumentId,
          count: sql<number>`COUNT(*)::int`
        })
        .from(documentDownloads)
        .where(inArray(documentDownloads.cimDocumentId, userDocs.map(d => d.id)))
        .groupBy(documentDownloads.cimDocumentId);

      // Create maps for quick lookup
      const viewsMap = new Map(viewCounts.map(v => [v.cimDocumentId, {
        count: Number(v.count),
        totalTimeSpent: Number(v.totalTimeSpent),
        lastViewedAt: v.lastViewedAt
      }]));

      const signaturesMap = new Map(signatureCounts.map(s => [s.cimDocumentId, {
        count: Number(s.count),
        lastSignedAt: s.lastSignedAt
      }]));

      const downloadsMap = new Map(downloadCounts.map(d => [d.cimDocumentId, Number(d.count)]));

      // Build document analytics array
      const documentAnalytics = userDocs.map(doc => {
        const views = viewsMap.get(doc.id);
        const signatures = signaturesMap.get(doc.id);
        const downloads = downloadsMap.get(doc.id) || 0;

        // Determine last activity (most recent of view or signature)
        const lastViewDate = views?.lastViewedAt ? new Date(views.lastViewedAt) : null;
        const lastSignDate = signatures?.lastSignedAt ? new Date(signatures.lastSignedAt) : null;

        let lastActivity: string | null = null;
        if (lastViewDate && lastSignDate) {
          lastActivity = (lastViewDate > lastSignDate ? lastViewDate : lastSignDate).toISOString();
        } else if (lastViewDate) {
          lastActivity = lastViewDate.toISOString();
        } else if (lastSignDate) {
          lastActivity = lastSignDate.toISOString();
        }

        // Calculate average time per view
        const avgTimePerView = views?.count ? Math.round((views.totalTimeSpent || 0) / views.count) : 0;

        return {
          id: doc.id,
          title: doc.title,
          views: views?.count || 0,
          signatures: signatures?.count || 0,
          downloads,
          totalTimeSpent: views?.totalTimeSpent || 0,
          avgTimePerView,
          shareEnabled: doc.shareEnabled,
          lastActivity
        };
      });

      // Sort by views descending
      documentAnalytics.sort((a, b) => b.views - a.views);

      res.json(documentAnalytics);
    } catch (error) {
      console.error('Error fetching document analytics:', error);
      res.status(500).json({ error: "Failed to fetch document analytics" });
    }
  });

  // Analytics Pending Approvals - Get all pending NDA approvals
  app.get("/api/analytics/pending-approvals", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Get all user's CIM documents that have approval required
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title
        })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          eq(cimDocuments.ndaApprovalRequired, true),
          isNull(cimDocuments.deletedAt)
        ));

      if (userDocs.length === 0) {
        return res.json([]);
      }

      const docIds = userDocs.map(doc => doc.id);

      // Get all pending signatures (approved = false AND rejected = false)
      const pendingSignatures = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signerLocation: ndaSignatures.signerLocation,
          signedAt: ndaSignatures.signedAt
        })
        .from(ndaSignatures)
        .where(and(
          inArray(ndaSignatures.cimDocumentId, docIds),
          eq(ndaSignatures.approved, false),
          eq(ndaSignatures.rejected, false)
        ))
        .orderBy(desc(ndaSignatures.signedAt));

      // Create a map for document titles
      const docTitlesMap = new Map(userDocs.map(doc => [doc.id, doc.title]));

      // Format the response
      const pendingApprovals = pendingSignatures.map(sig => ({
        id: sig.id,
        documentId: sig.cimDocumentId,
        documentTitle: docTitlesMap.get(sig.cimDocumentId) || 'Unknown Document',
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signerLocation: sig.signerLocation || '',
        signedAt: sig.signedAt.toISOString()
      }));

      res.json(pendingApprovals);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // Analytics All Signatures - Get all NDA signatures across all user's documents
  app.get("/api/analytics/all-signatures", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Get all user's CIM documents
      const userDocs = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title
        })
        .from(cimDocuments)
        .where(and(
          eq(cimDocuments.userId, req.user.id),
          isNull(cimDocuments.deletedAt)
        ));

      if (userDocs.length === 0) {
        return res.json([]);
      }

      const docIds = userDocs.map(doc => doc.id);

      // Get all signatures (approved and unapproved)
      const allSignatures = await db
        .select({
          id: ndaSignatures.id,
          cimDocumentId: ndaSignatures.cimDocumentId,
          signerName: ndaSignatures.signerName,
          signerEmail: ndaSignatures.signerEmail,
          signerLocation: ndaSignatures.signerLocation,
          signedAt: ndaSignatures.signedAt
        })
        .from(ndaSignatures)
        .where(inArray(ndaSignatures.cimDocumentId, docIds))
        .orderBy(desc(ndaSignatures.signedAt));

      // Create a map for document titles
      const docTitlesMap = new Map(userDocs.map(doc => [doc.id, doc.title]));

      // Format the response
      const signatures = allSignatures.map(sig => ({
        id: sig.id,
        documentId: sig.cimDocumentId,
        documentTitle: docTitlesMap.get(sig.cimDocumentId) || 'Unknown Document',
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signerLocation: sig.signerLocation || '',
        signedAt: sig.signedAt.toISOString()
      }));

      res.json(signatures);
    } catch (error) {
      console.error('Error fetching all signatures:', error);
      res.status(500).json({ error: "Failed to fetch signatures" });
    }
  });

  // View tracking heartbeat - updates time spent for a viewing session
  app.post("/api/track/heartbeat", async (req, res) => {
    try {
      const { sessionId, additionalSeconds } = req.body;

      if (!sessionId || typeof additionalSeconds !== 'number') {
        return res.status(400).json({ error: "Missing sessionId or additionalSeconds" });
      }

      await storage.updateViewHeartbeat(sessionId, additionalSeconds);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating heartbeat:', error);
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  // Track document download
  app.post("/api/track/download", async (req, res) => {
    try {
      const { documentId, downloadType, viewerEmail, sessionId } = req.body;

      if (!documentId || !downloadType) {
        return res.status(400).json({ error: "Missing documentId or downloadType" });
      }

      const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';

      await storage.trackDocumentDownload(documentId, downloadType, {
        viewerEmail,
        viewerIdentifier: sessionId,
        ipAddress: clientIp,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking download:', error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });

  // Get signer analytics for a specific document and signer
  app.get("/api/cim/:docId/signer-analytics/:signerEmail", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.docId);
      const signerEmail = decodeURIComponent(req.params.signerEmail);

      // Verify user owns the document
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const analytics = await storage.getSignerAnalytics(docId, signerEmail);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching signer analytics:', error);
      res.status(500).json({ error: "Failed to fetch signer analytics" });
    }
  });

  // Get download stats for a document
  app.get("/api/cim/:id/download-stats", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const docId = parseInt(req.params.id);

      // Verify user owns the document
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const stats = await storage.getDocumentDownloadStats(docId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching download stats:', error);
      res.status(500).json({ error: "Failed to fetch download stats" });
    }
  });
}

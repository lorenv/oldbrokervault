import { storage } from "./storage";
import { db } from "./db";
import { eq, sql, desc, and, or, ilike } from "drizzle-orm";
import { cimDocuments, documentVersions, documentAnalytics, searchIndex } from "@shared/schema";

export class PremiumSearchService {
  // Full-text search across documents for premium users
  async searchDocuments(userId: number, query: string, filters?: {
    dateRange?: { start: Date; end: Date };
    tags?: string[];
  }) {
    const searchTerms = query.split(' ').filter(term => term.length > 2);
    
    if (searchTerms.length === 0) {
      return [];
    }

    // Build search conditions
    const searchConditions = searchTerms.map(term => 
      or(
        ilike(cimDocuments.title, `%${term}%`),
        sql`${cimDocuments.analysis}::text ILIKE ${`%${term}%`}`,
        sql`${cimDocuments.editedContent}::text ILIKE ${`%${term}%`}`
      )
    );

    let baseQuery = db
      .select({
        id: cimDocuments.id,
        title: cimDocuments.title,
        createdAt: cimDocuments.createdAt,
        analysis: cimDocuments.analysis,
        // Calculate relevance score
        relevance: sql<number>`
          CASE 
            WHEN ${cimDocuments.title} ILIKE ${`%${query}%`} THEN 10
            WHEN ${sql`${cimDocuments.analysis}::text`} ILIKE ${`%${query}%`} THEN 5
            ELSE 1
          END
        `
      })
      .from(cimDocuments)
      .where(
        and(
          eq(cimDocuments.userId, userId),
          or(...searchConditions)
        )
      );

    // Apply date filter if provided
    if (filters?.dateRange) {
      baseQuery = baseQuery.where(
        and(
          sql`${cimDocuments.createdAt} >= ${filters.dateRange.start}`,
          sql`${cimDocuments.createdAt} <= ${filters.dateRange.end}`
        )
      );
    }

    const results = await baseQuery
      .orderBy(desc(sql`relevance`), desc(cimDocuments.createdAt))
      .limit(50);

    return results;
  }

  // Update search index when document changes
  async updateSearchIndex(documentId: number, content: any) {
    // Delete existing index entries
    await db.delete(searchIndex).where(eq(searchIndex.cimDocumentId, documentId));

    const indexEntries = [];
    
    // Index title
    if (content.title) {
      indexEntries.push({
        cimDocumentId: documentId,
        content: content.title,
        contentType: 'title',
        searchVector: this.createSearchVector(content.title)
      });
    }

    // Index analysis content
    if (content.analysis) {
      const analysisText = this.extractTextFromAnalysis(content.analysis);
      indexEntries.push({
        cimDocumentId: documentId,
        content: analysisText,
        contentType: 'analysis',
        searchVector: this.createSearchVector(analysisText)
      });
    }

    // Index edited content
    if (content.editedContent) {
      const editedText = this.extractTextFromAnalysis(content.editedContent);
      indexEntries.push({
        cimDocumentId: documentId,
        content: editedText,
        contentType: 'edited',
        searchVector: this.createSearchVector(editedText)
      });
    }

    if (indexEntries.length > 0) {
      await db.insert(searchIndex).values(indexEntries);
    }
  }

  private createSearchVector(text: string): string {
    // Simple search vector creation (could be enhanced with stemming, etc.)
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .join(' ');
  }

  private extractTextFromAnalysis(analysis: any): string {
    if (typeof analysis === 'string') return analysis;
    
    const texts: string[] = [];
    
    function extractRecursive(obj: any) {
      if (typeof obj === 'string') {
        texts.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(extractRecursive);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(extractRecursive);
      }
    }
    
    extractRecursive(analysis);
    return texts.join(' ');
  }
}

export class VersionHistoryService {
  // Track document changes for premium users
  async createVersion(documentId: number, changes: any, changedBy: number, description?: string) {
    // Get current version
    const currentDoc = await storage.getCimDocument(documentId);
    if (!currentDoc) throw new Error("Document not found");

    const newVersion = (currentDoc.version || 1) + 1;

    // Store version history
    await db.insert(documentVersions).values({
      cimDocumentId: documentId,
      version: newVersion,
      changes,
      changedBy,
      changeDescription: description
    });

    // Update document version
    await db.update(cimDocuments)
      .set({ 
        version: newVersion,
        lastModifiedBy: changedBy
      })
      .where(eq(cimDocuments.id, documentId));

    return newVersion;
  }

  // Get version history for a document
  async getVersionHistory(documentId: number, limit: number = 20) {
    return await db
      .select({
        id: documentVersions.id,
        version: documentVersions.version,
        changes: documentVersions.changes,
        changedBy: documentVersions.changedBy,
        changeDescription: documentVersions.changeDescription,
        createdAt: documentVersions.createdAt
      })
      .from(documentVersions)
      .where(eq(documentVersions.cimDocumentId, documentId))
      .orderBy(desc(documentVersions.version))
      .limit(limit);
  }

  // Restore to a specific version
  async restoreVersion(documentId: number, targetVersion: number, restoredBy: number) {
    const versionData = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.cimDocumentId, documentId),
          eq(documentVersions.version, targetVersion)
        )
      )
      .limit(1);

    if (versionData.length === 0) {
      throw new Error("Version not found");
    }

    const version = versionData[0];
    
    // Create a new version entry for the restoration
    await this.createVersion(
      documentId,
      version.changes,
      restoredBy,
      `Restored to version ${targetVersion}`
    );

    return version;
  }
}

export class AnalyticsService {
  // Track user actions for premium analytics
  async trackAction(
    documentId: number,
    userId: number,
    action: 'view' | 'edit' | 'export' | 'share' | 'collaborate',
    metadata?: any,
    sessionId?: string
  ) {
    await db.insert(documentAnalytics).values({
      cimDocumentId: documentId,
      userId,
      action,
      metadata,
      sessionId: sessionId || this.generateSessionId()
    });
  }

  // Get analytics for a document
  async getDocumentAnalytics(documentId: number, timeRange?: { start: Date; end: Date }) {
    let query = db
      .select({
        action: documentAnalytics.action,
        count: sql<number>`COUNT(*)`,
        lastActivity: sql<Date>`MAX(${documentAnalytics.timestamp})`
      })
      .from(documentAnalytics)
      .where(eq(documentAnalytics.cimDocumentId, documentId));

    if (timeRange) {
      query = query.where(
        and(
          sql`${documentAnalytics.timestamp} >= ${timeRange.start}`,
          sql`${documentAnalytics.timestamp} <= ${timeRange.end}`
        )
      );
    }

    const actionStats = await query
      .groupBy(documentAnalytics.action)
      .orderBy(desc(sql`COUNT(*)`));

    // Get recent activity
    const recentActivity = await db
      .select({
        action: documentAnalytics.action,
        timestamp: documentAnalytics.timestamp,
        metadata: documentAnalytics.metadata
      })
      .from(documentAnalytics)
      .where(eq(documentAnalytics.cimDocumentId, documentId))
      .orderBy(desc(documentAnalytics.timestamp))
      .limit(20);

    return {
      actionStats,
      recentActivity,
      totalActions: actionStats.reduce((sum, stat) => sum + Number(stat.count), 0)
    };
  }

  // Get user-wide analytics
  async getUserAnalytics(userId: number, timeRange?: { start: Date; end: Date }) {
    let query = db
      .select({
        documentId: documentAnalytics.cimDocumentId,
        documentTitle: cimDocuments.title,
        actions: sql<number>`COUNT(*)`,
        lastActivity: sql<Date>`MAX(${documentAnalytics.timestamp})`
      })
      .from(documentAnalytics)
      .leftJoin(cimDocuments, eq(documentAnalytics.cimDocumentId, cimDocuments.id))
      .where(eq(documentAnalytics.userId, userId));

    if (timeRange) {
      query = query.where(
        and(
          sql`${documentAnalytics.timestamp} >= ${timeRange.start}`,
          sql`${documentAnalytics.timestamp} <= ${timeRange.end}`
        )
      );
    }

    return await query
      .groupBy(documentAnalytics.cimDocumentId, cimDocuments.title)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(50);
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

// Export service instances
export const searchService = new PremiumSearchService();
export const versionService = new VersionHistoryService();
export const analyticsService = new AnalyticsService();
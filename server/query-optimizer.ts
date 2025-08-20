/**
 * Query Optimizer for Database Performance
 * Provides batched queries and eager loading to prevent N+1 problems
 */

import { db } from './db';
import { 
  cimDocuments, 
  customSections, 
  financialFiles, 
  ndaSignatures,
  uploadedFiles,
  collaborators,
  users 
} from '@shared/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { shareCache, CACHE_TTL } from './cache';

/**
 * Batch loader for related data to prevent N+1 queries
 */
export class BatchLoader {
  private loaders = new Map<string, Map<any, Promise<any>>>();

  /**
   * Load multiple related entities in a single query
   */
  async loadMany<T>(
    tableName: string,
    ids: number[],
    loader: (ids: number[]) => Promise<T[]>,
    keyExtractor: (item: T) => number
  ): Promise<Map<number, T[]>> {
    if (ids.length === 0) return new Map();

    // Check cache first
    const cacheKey = `batch:${tableName}:${ids.join(',')}`;
    const cached = shareCache.get<Map<number, T[]>>(cacheKey);
    if (cached) return cached;

    // Load all data in one query
    const items = await loader(ids);
    
    // Group by ID
    const grouped = new Map<number, T[]>();
    for (const id of ids) {
      grouped.set(id, []);
    }
    
    for (const item of items) {
      const key = keyExtractor(item);
      const existing = grouped.get(key) || [];
      existing.push(item);
      grouped.set(key, existing);
    }

    // Cache the result
    shareCache.set(cacheKey, grouped, CACHE_TTL.CUSTOM_SECTIONS);
    
    return grouped;
  }
}

/**
 * Optimized queries for common operations
 */
export class OptimizedQueries {
  private batchLoader = new BatchLoader();

  /**
   * Get CIM documents with all related data in optimized queries
   * Prevents N+1 by eager loading related data
   */
  async getCimDocumentsWithRelations(
    userId: number,
    options?: { 
      page?: number; 
      limit?: number; 
      includeCustomSections?: boolean;
      includeFinancialFiles?: boolean;
      includeNdaSignatures?: boolean;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 12;
    const offset = (page - 1) * limit;

    // Main query for documents
    const documents = await db
      .select()
      .from(cimDocuments)
      .where(eq(cimDocuments.userId, userId))
      .orderBy(sql`${cimDocuments.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    if (documents.length === 0) {
      return { documents: [], customSections: new Map(), financialFiles: new Map(), ndaSignatures: new Map() };
    }

    const documentIds = documents.map(d => d.id);
    
    // Parallel load all related data
    const [customSectionsMap, financialFilesMap, ndaSignaturesMap] = await Promise.all([
      options?.includeCustomSections 
        ? this.batchLoader.loadMany(
            'customSections',
            documentIds,
            async (ids) => db.select().from(customSections).where(inArray(customSections.cimDocumentId, ids)),
            (item) => item.cimDocumentId
          )
        : Promise.resolve(new Map()),
      
      options?.includeFinancialFiles
        ? this.batchLoader.loadMany(
            'financialFiles',
            documentIds,
            async (ids) => db.select().from(financialFiles).where(inArray(financialFiles.cimDocumentId, ids)),
            (item) => item.cimDocumentId
          )
        : Promise.resolve(new Map()),
      
      options?.includeNdaSignatures
        ? this.batchLoader.loadMany(
            'ndaSignatures',
            documentIds,
            async (ids) => db.select().from(ndaSignatures).where(inArray(ndaSignatures.cimDocumentId, ids)),
            (item) => item.cimDocumentId
          )
        : Promise.resolve(new Map())
    ]);

    return {
      documents,
      customSections: customSectionsMap,
      financialFiles: financialFilesMap,
      ndaSignatures: ndaSignaturesMap
    };
  }

  /**
   * Optimized user lookup with caching
   */
  async getUserWithCache(userId: number) {
    const cacheKey = `user:${userId}`;
    const cached = shareCache.get(cacheKey);
    if (cached) return cached;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (user) {
      shareCache.set(cacheKey, user, CACHE_TTL.USER_PROFILE);
    }

    return user;
  }

  /**
   * Batch load users to prevent N+1 in listings
   */
  async batchLoadUsers(userIds: number[]) {
    if (userIds.length === 0) return new Map();

    const uniqueIds = [...new Set(userIds)];
    
    // Check cache for each user
    const result = new Map();
    const uncachedIds = [];
    
    for (const id of uniqueIds) {
      const cached = shareCache.get(`user:${id}`);
      if (cached) {
        result.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Load uncached users
    if (uncachedIds.length > 0) {
      const users = await db
        .select()
        .from(users)
        .where(inArray(users.id, uncachedIds));

      for (const user of users) {
        result.set(user.id, user);
        shareCache.set(`user:${user.id}`, user, CACHE_TTL.USER_PROFILE);
      }
    }

    return result;
  }

  /**
   * Get document with all relations in a single optimized call
   */
  async getDocumentComplete(documentId: number) {
    const cacheKey = `doc:complete:${documentId}`;
    const cached = shareCache.get(cacheKey);
    if (cached) return cached;

    // Use Promise.all for parallel queries
    const [
      [document],
      sections,
      files,
      signatures,
      collabs
    ] = await Promise.all([
      db.select().from(cimDocuments).where(eq(cimDocuments.id, documentId)),
      db.select().from(customSections).where(eq(customSections.cimDocumentId, documentId)),
      db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, documentId)),
      db.select().from(ndaSignatures).where(eq(ndaSignatures.cimDocumentId, documentId)),
      db.select().from(collaborators).where(eq(collaborators.cimDocumentId, documentId))
    ]);

    const result = {
      document,
      customSections: sections,
      financialFiles: files,
      ndaSignatures: signatures,
      collaborators: collabs
    };

    shareCache.set(cacheKey, result, CACHE_TTL.SHARE_DOCUMENT);
    
    return result;
  }

  /**
   * Prefetch and warm cache for frequently accessed data
   */
  async warmCache(userId: number) {
    try {
      // Prefetch user's recent documents
      const recentDocs = await db
        .select()
        .from(cimDocuments)
        .where(eq(cimDocuments.userId, userId))
        .orderBy(sql`${cimDocuments.createdAt} DESC`)
        .limit(5);

      // Cache each document
      for (const doc of recentDocs) {
        shareCache.set(
          `doc:${doc.id}`,
          doc,
          CACHE_TTL.SHARE_DOCUMENT
        );
      }

      // Prefetch user profile
      await this.getUserWithCache(userId);

      console.log(`Cache warmed for user ${userId}`);
    } catch (error) {
      console.error('Error warming cache:', error);
    }
  }
}

// Export singleton instance
export const queryOptimizer = new OptimizedQueries();
/**
 * Simple in-memory cache for share link performance optimization
 * Provides short-term caching to reduce database queries for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 5000; // Increased from 1000 for better cache hit rates
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs = 60000; // Run cleanup every minute

  constructor() {
    this.startAutoCleanup();
  }

  private startAutoCleanup(): void {
    // Clear any existing interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Set up automatic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);

    // Ensure cleanup stops when process exits
    if (typeof process !== 'undefined') {
      process.on('exit', () => this.stopAutoCleanup());
      process.on('SIGINT', () => this.stopAutoCleanup());
      process.on('SIGTERM', () => this.stopAutoCleanup());
    }
  }

  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Use iterator directly to avoid creating Array.from copy (O(n) space -> O(1) space)
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // Only log in development to reduce production overhead
    if (cleanedCount > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`[Cache] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    // STRICT maxSize enforcement - always clean before adding if at limit
    if (this.cache.size >= this.maxSize) {
      const now = Date.now();

      // First pass: delete expired entries (efficient - no sorting)
      for (const [k, entry] of this.cache) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(k);
        }
        // Stop early if we've freed enough space
        if (this.cache.size < this.maxSize * 0.8) break;
      }

      // Second pass: if still at limit, remove oldest entries using LRU-style eviction
      if (this.cache.size >= this.maxSize) {
        // Find oldest entries efficiently without full sort
        const targetRemoval = Math.floor(this.maxSize * 0.2);
        const oldestKeys: string[] = [];
        let oldestTime = Infinity;

        for (const [k, entry] of this.cache) {
          if (entry.timestamp < oldestTime || oldestKeys.length < targetRemoval) {
            oldestKeys.push(k);
            if (entry.timestamp < oldestTime) {
              oldestTime = entry.timestamp;
            }
            // Keep only targetRemoval candidates
            if (oldestKeys.length > targetRemoval * 2) {
              oldestKeys.shift();
            }
          }
        }

        // Remove oldest entries
        for (const k of oldestKeys.slice(0, targetRemoval)) {
          this.cache.delete(k);
        }
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  destroy(): void {
    this.stopAutoCleanup();
    this.cache.clear();
  }
  
  // Generate cache keys for different data types
  static keys = {
    shareDocument: (slug: string) => `share:doc:${slug}`,
    userProfile: (userId: number) => `user:profile:${userId}`,
    customSections: (docId: number) => `doc:sections:${docId}`,
    ndaStatus: (docId: number, token?: string) => `nda:status:${docId}:${token || 'none'}`,
    messageThreads: (userId: number, archived: boolean, cimId?: number) => `messages:threads:${userId}:${archived}:${cimId || 'all'}`,
    threadMessages: (threadId: number) => `messages:thread:${threadId}`,
    unreadCount: (userId: number) => `messages:unread:${userId}`,
    cimDocuments: (userId: number) => `messages:cim-docs:${userId}`,
  };
  
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    let totalMemoryBytes = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      // Estimate memory usage (rough approximation)
      const entrySize = JSON.stringify(entry.data).length + key.length + 24; // 24 bytes for metadata
      totalMemoryBytes += entrySize;
      
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
      
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      maxSize: this.maxSize,
      memoryUsageMB: (totalMemoryBytes / 1024 / 1024).toFixed(2),
      utilizationPercent: ((this.cache.size / this.maxSize) * 100).toFixed(1),
      oldestEntryAge: oldestEntry ? Math.floor((now - oldestEntry) / 1000) : null, // seconds
      newestEntryAge: newestEntry ? Math.floor((now - newestEntry) / 1000) : null, // seconds
      autoCleanupActive: this.cleanupInterval !== null
    };
  }
}

export const shareCache = new MemoryCache();
export { MemoryCache };

// Cache configuration constants - optimized TTLs for better hit rates
export const CACHE_TTL = {
  SHARE_DOCUMENT: 5 * 60 * 1000, // 5 minutes (increased for stable data)
  USER_PROFILE: 15 * 60 * 1000,  // 15 minutes (profiles rarely change)
  CUSTOM_SECTIONS: 10 * 60 * 1000, // 10 minutes (sections are fairly stable)
  NDA_STATUS: 2 * 60 * 1000,     // 2 minutes (balance freshness vs. load)
  NDA_CHECK: 60 * 1000,          // 1 minute (increased from 30s)
  MESSAGE_THREADS: 2 * 60 * 1000, // 2 minutes
  THREAD_MESSAGES: 3 * 60 * 1000, // 3 minutes
  UNREAD_COUNT: 60 * 1000,       // 1 minute (balance freshness vs. load)
  CIM_DOCUMENTS: 10 * 60 * 1000, // 10 minutes (documents don't change often)
};
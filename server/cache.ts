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
  private maxSize = 1000; // Maximum number of cache entries
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
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Cache] Cleaned up ${cleanedCount} expired entries`);
    }
  }
  
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const now = Date.now();
      for (const [k, entry] of Array.from(this.cache.entries())) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(k);
        }
      }
      
      // If still full, remove oldest entries
      if (this.cache.size >= this.maxSize) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.2));
        toRemove.forEach(([k]) => this.cache.delete(k));
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

// Cache configuration constants
export const CACHE_TTL = {
  SHARE_DOCUMENT: 2 * 60 * 1000, // 2 minutes
  USER_PROFILE: 5 * 60 * 1000,   // 5 minutes
  CUSTOM_SECTIONS: 3 * 60 * 1000, // 3 minutes
  NDA_STATUS: 1 * 60 * 1000,     // 1 minute
  NDA_CHECK: 30 * 1000,          // 30 seconds
  MESSAGE_THREADS: 1 * 60 * 1000, // 1 minute
  THREAD_MESSAGES: 2 * 60 * 1000, // 2 minutes
  UNREAD_COUNT: 30 * 1000,       // 30 seconds
  CIM_DOCUMENTS: 5 * 60 * 1000,  // 5 minutes
};
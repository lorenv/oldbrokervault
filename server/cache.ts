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
  
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const now = Date.now();
      for (const [k, entry] of this.cache.entries()) {
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
  
  // Generate cache keys for different data types
  static keys = {
    shareDocument: (slug: string) => `share:doc:${slug}`,
    userProfile: (userId: number) => `user:profile:${userId}`,
    customSections: (docId: number) => `doc:sections:${docId}`,
    ndaStatus: (docId: number, token?: string) => `nda:status:${docId}:${token || 'none'}`,
  };
  
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      maxSize: this.maxSize
    };
  }
}

export const shareCache = new MemoryCache();

// Cache configuration constants
export const CACHE_TTL = {
  SHARE_DOCUMENT: 2 * 60 * 1000, // 2 minutes
  USER_PROFILE: 5 * 60 * 1000,   // 5 minutes
  CUSTOM_SECTIONS: 3 * 60 * 1000, // 3 minutes
  NDA_STATUS: 1 * 60 * 1000,     // 1 minute
  NDA_CHECK: 30 * 1000,          // 30 seconds
};
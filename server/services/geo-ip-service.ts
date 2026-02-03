/**
 * Geo IP Service - Cloud-based IP geolocation
 * Replaces geoip-lite (154MB) with a free API to reduce deployment size
 * Uses ip-api.com (free, no API key required, 45 req/min limit)
 */

interface GeoLocation {
  city: string | null;
  region: string | null;
  country: string | null;
}

// Simple in-memory cache to reduce API calls
const cache = new Map<string, { data: GeoLocation | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Lookup IP address geolocation using ip-api.com
 * @param ip - IP address to lookup
 * @returns GeoLocation object or null if lookup fails
 */
export async function lookupIp(ip: string): Promise<GeoLocation | null> {
  // Skip private/local IPs
  if (isPrivateIp(ip)) {
    return null;
  }

  // Check cache first
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // ip-api.com free tier - no API key needed
    // Rate limit: 45 requests per minute
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country`,
      { signal: AbortSignal.timeout(5000) } // 5 second timeout
    );

    if (!response.ok) {
      console.warn(`[GeoIP] API request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      // Cache failed lookups too to avoid repeated requests
      cache.set(ip, { data: null, timestamp: Date.now() });
      return null;
    }

    const location: GeoLocation = {
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
    };

    // Cache successful lookup
    cache.set(ip, { data: location, timestamp: Date.now() });

    return location;
  } catch (error) {
    console.warn(`[GeoIP] Lookup failed for ${ip}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Format location as a string (matching previous geoip-lite format)
 * @param ip - IP address to lookup
 * @returns Formatted location string or undefined
 */
export async function getLocationString(ip: string): Promise<string | undefined> {
  const geo = await lookupIp(ip);
  if (!geo) return undefined;

  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Check if IP is private/local (not routable on internet)
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (ip.startsWith('10.') ||
      ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
      ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') ||
      ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
      ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') ||
      ip.startsWith('172.31.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('127.') ||
      ip === 'localhost' ||
      ip === '::1') {
    return true;
  }
  return false;
}

/**
 * Synchronous lookup compatibility layer
 * Returns cached result or null (for backwards compatibility with geoip-lite sync API)
 * Note: Prefer using lookupIp() async function for new code
 */
export function lookupSync(ip: string): GeoLocation | null {
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Trigger async lookup for future requests (fire and forget)
  lookupIp(ip).catch(() => {});

  return null;
}

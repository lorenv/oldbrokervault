import fetch from 'node-fetch';

interface LocationData {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Lookup location information from IP address using ipapi.co
 * Falls back to basic info if lookup fails
 */
export async function getLocationFromIP(ipAddress: string): Promise<LocationData> {
  // Handle local development IPs
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return {
      city: 'Local Network',
      region: 'Development',
      country: 'Unknown',
      timezone: 'Unknown'
    };
  }

  try {
    console.log(`[LOCATION] Looking up location for IP: ${ipAddress}`);
    
    // Use ipapi.co free tier (no API key needed, 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      headers: {
        'User-Agent': 'Undersigned-App/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`IP lookup failed: ${response.status}`);
    }

    const data = await response.json() as any;
    
    // Check if we got an error response
    if (data.error) {
      throw new Error(`IP API error: ${data.reason || data.error}`);
    }

    const locationData: LocationData = {
      city: data.city || 'Unknown',
      region: data.region || 'Unknown', 
      country: data.country_name || 'Unknown',
      timezone: data.timezone || 'Unknown',
      latitude: data.latitude,
      longitude: data.longitude
    };

    console.log(`[LOCATION] ✅ Location found: ${locationData.city}, ${locationData.region}, ${locationData.country}`);
    return locationData;

  } catch (error: any) {
    console.warn(`[LOCATION] ⚠️ Failed to lookup location for IP ${ipAddress}:`, error.message);
    
    // Return fallback data
    return {
      city: 'Unknown',
      region: 'Unknown', 
      country: 'Unknown',
      timezone: 'Unknown'
    };
  }
}

/**
 * Format location data for display in certificates
 */
export function formatLocationForCertificate(location: LocationData): string {
  const parts = [];
  
  if (location.city && location.city !== 'Unknown') {
    parts.push(location.city);
  }
  
  if (location.region && location.region !== 'Unknown') {
    parts.push(location.region);
  }
  
  if (location.country && location.country !== 'Unknown') {
    parts.push(location.country);
  }

  return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
}
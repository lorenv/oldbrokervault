// IP-based location estimation with privacy tool detection
// Uses free IP geolocation services with privacy-aware detection

// Known VPN/proxy IP ranges and providers
const VPN_INDICATORS = [
  // VPN service providers
  'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'privateinternetaccess',
  'protonvpn', 'mullvad', 'windscribe', 'tunnelbear', 'hidemyass',
  'hotspotshield', 'vyprvpn', 'ipvanish', 'purevpn', 'zenmate',
  
  // Tor exit nodes and relays
  'tor-exit', 'tor-relay', 'tor-node', 'exit-node',
  
  // Privacy-focused hosting
  'privacy', 'anonymous', 'vpn', 'proxy', 'relay', 'tunnel',
  
  // Data center providers commonly used for VPNs
  'digitalocean', 'aws', 'azure', 'google-cloud', 'linode',
  'vultr', 'ovh', 'hetzner', 'scaleway',
  
  // Generic indicators
  'hosting', 'datacenter', 'server', 'cloud'
];

// Known VPN IP ranges (simplified - in production you'd use comprehensive databases)
const VPN_IP_RANGES = [
  // Common VPN provider ranges (these are examples)
  '185.159.', '178.239.', '194.187.', '91.219.',
  '195.123.', '185.220.', '178.17.', '46.166.'
];

interface LocationResult {
  location: string | null;
  isPotentialVpn: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export async function estimateLocationFromIP(ip: string): Promise<LocationResult> {
  // Skip private/local IPs
  if (isPrivateIP(ip)) {
    return {
      location: 'Local Network',
      isPotentialVpn: false,
      confidence: 'high'
    };
  }

  try {
    // Use free IP geolocation service (ip-api.com)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,as,mobile,proxy,hosting`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('IP service unavailable');
    }
    
    const data = await response.json();
    
    if (data.status === 'fail') {
      return {
        location: null,
        isPotentialVpn: false,
        confidence: 'low'
      };
    }

    // Build location string
    const locationParts = [data.city, data.regionName, data.country].filter(Boolean);
    const location = locationParts.join(', ') || null;

    // Detect potential VPN/privacy tools
    const isPotentialVpn = detectVPNUsage(data, ip);
    
    // Determine confidence based on available data
    const confidence = data.city && data.country ? 'high' : 
                      data.country ? 'medium' : 'low';

    return {
      location,
      isPotentialVpn,
      confidence
    };

  } catch (error) {
    console.error('Location estimation failed:', error);
    return {
      location: null,
      isPotentialVpn: false,
      confidence: 'low'
    };
  }
}

function detectVPNUsage(geoData: any, ip: string): boolean {
  // Check if IP service detected proxy/hosting
  if (geoData.proxy || geoData.hosting || geoData.mobile === false) {
    return true;
  }

  // Check ISP/organization names for VPN indicators
  const isp = (geoData.isp || '').toLowerCase();
  const org = (geoData.org || '').toLowerCase();
  const asn = (geoData.as || '').toLowerCase();
  
  const textToCheck = `${isp} ${org} ${asn}`;
  
  for (const indicator of VPN_INDICATORS) {
    if (textToCheck.includes(indicator)) {
      return true;
    }
  }

  // Check against known VPN IP ranges
  for (const range of VPN_IP_RANGES) {
    if (ip.startsWith(range)) {
      return true;
    }
  }

  // Additional heuristics
  // Data center ASNs often indicate VPN usage
  if (geoData.as && /AS\d+\s+(hosting|datacenter|cloud|server)/i.test(geoData.as)) {
    return true;
  }

  return false;
}

function isPrivateIP(ip: string): boolean {
  // RFC 1918 private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];

  return privateRanges.some(range => range.test(ip));
}

export function getClientIP(req: any): string {
  // Check various headers for real IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return req.headers['x-real-ip'] || 
         req.headers['x-client-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip || 
         'unknown';
}
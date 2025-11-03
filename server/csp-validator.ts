import { cspDirectives } from "./security";

interface CSPViolation {
  domain: string;
  resourceType: 'script' | 'style' | 'font' | 'image' | 'connect' | 'frame' | 'form';
  directive: string;
  foundIn: string; // Where in the code it was found
}

interface ValidationResult {
  isValid: boolean;
  violations: CSPViolation[];
}

/**
 * Extract all external URLs from HTML and CSS code
 */
function extractExternalUrls(html: string, css: string = ''): Map<string, CSPViolation[]> {
  const violations = new Map<string, CSPViolation[]>();

  // Helper to add violation
  const addViolation = (url: string, type: CSPViolation['resourceType'], foundIn: string) => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.origin;

      // Skip relative URLs and data URLs
      if (url.startsWith('/') || url.startsWith('#') || url.startsWith('data:') || url.startsWith('blob:')) {
        return;
      }

      const directive = getDirectiveForType(type);
      const violation: CSPViolation = { domain, resourceType: type, directive, foundIn };

      if (!violations.has(domain)) {
        violations.set(domain, []);
      }
      violations.get(domain)!.push(violation);
    } catch (e) {
      // Invalid URL, skip
    }
  };

  // Extract script sources
  const scriptRegex = /<script[^>]*src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    addViolation(match[1], 'script', `<script src="${match[1]}">`);
  }

  // Extract link stylesheets and fonts
  const linkRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const linkTag = match[0];
    const href = match[1];

    if (linkTag.includes('stylesheet')) {
      addViolation(href, 'style', `<link rel="stylesheet" href="${href}">`);
    } else if (linkTag.includes('font')) {
      addViolation(href, 'font', `<link href="${href}">`);
    }
  }

  // Extract iframe sources
  const iframeRegex = /<iframe[^>]*src=["']([^"']+)["']/gi;
  while ((match = iframeRegex.exec(html)) !== null) {
    addViolation(match[1], 'frame', `<iframe src="${match[1]}">`);
  }

  // Extract form actions
  const formRegex = /<form[^>]*action=["']([^"']+)["']/gi;
  while ((match = formRegex.exec(html)) !== null) {
    addViolation(match[1], 'form', `<form action="${match[1]}">`);
  }

  // Extract CSS url() references (in both HTML style tags and CSS parameter)
  const cssUrlRegex = /url\(["']?([^"')]+)["']?\)/gi;
  const combinedCss = html + '\n' + css;
  while ((match = cssUrlRegex.exec(combinedCss)) !== null) {
    const url = match[1];
    // CSS urls could be images or fonts
    if (url.match(/\.(woff2?|ttf|eot|otf)$/i)) {
      addViolation(url, 'font', `url(${url})`);
    } else if (url.match(/\.(jpe?g|png|gif|svg|webp)$/i)) {
      addViolation(url, 'image', `url(${url})`);
    } else {
      addViolation(url, 'style', `url(${url})`);
    }
  }

  // Extract img sources
  const imgRegex = /<img[^>]*src=["']([^"']+)["']/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    addViolation(match[1], 'image', `<img src="${match[1]}">`);
  }

  return violations;
}

/**
 * Get the CSP directive name for a resource type
 */
function getDirectiveForType(type: CSPViolation['resourceType']): string {
  const mapping: Record<CSPViolation['resourceType'], string> = {
    script: 'script-src',
    style: 'style-src',
    font: 'font-src',
    image: 'img-src',
    connect: 'connect-src',
    frame: 'frame-src',
    form: 'form-action'
  };
  return mapping[type] || 'default-src';
}

/**
 * Check if a domain is whitelisted in CSP directives
 */
function isDomainWhitelisted(domain: string, type: CSPViolation['resourceType']): boolean {
  const directiveMap: Record<CSPViolation['resourceType'], string[]> = {
    script: cspDirectives.scriptSrc,
    style: cspDirectives.styleSrc,
    font: cspDirectives.fontSrc,
    image: cspDirectives.imgSrc,
    connect: cspDirectives.connectSrc,
    frame: cspDirectives.frameSrc,
    form: [] // No form-action in current CSP
  };

  const allowedSources = directiveMap[type] || [];

  // Check for exact match
  if (allowedSources.includes(domain)) {
    return true;
  }

  // Check for wildcard matches
  for (const source of allowedSources) {
    if (source === '*' || source === 'https:') {
      return true;
    }

    // Handle wildcard subdomains like "https://*.jotform.com"
    if (source.includes('*')) {
      const pattern = source.replace(/\*/g, '.*').replace(/\./g, '\\.');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(domain)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate HTML and CSS code against CSP
 */
export function validateAgainstCSP(html: string, css: string = ''): ValidationResult {
  const allViolations: CSPViolation[] = [];
  const domainViolations = extractExternalUrls(html, css);

  for (const [domain, violations] of domainViolations.entries()) {
    for (const violation of violations) {
      if (!isDomainWhitelisted(domain, violation.resourceType)) {
        allViolations.push(violation);
      }
    }
  }

  return {
    isValid: allViolations.length === 0,
    violations: allViolations
  };
}

/**
 * Format violations for email notification
 */
export function formatViolationsForEmail(violations: CSPViolation[]): string {
  if (violations.length === 0) return 'No violations found.';

  const grouped = violations.reduce((acc, v) => {
    if (!acc[v.domain]) {
      acc[v.domain] = [];
    }
    acc[v.domain].push(v);
    return acc;
  }, {} as Record<string, CSPViolation[]>);

  let output = 'The following external domains were detected:\n\n';

  for (const [domain, viols] of Object.entries(grouped)) {
    output += `🔒 ${domain}\n`;
    output += `   CSP Directive: ${viols[0].directive}\n`;
    output += `   Found in:\n`;
    viols.forEach(v => {
      output += `     - ${v.foundIn}\n`;
    });
    output += '\n';
  }

  return output;
}

/**
 * Server-Side Rendering for SEO Pages
 * Renders React components to static HTML for better search engine indexing
 */

import path from 'path';
import { promises as fs } from 'fs';

// Page configuration for SEO
interface PageMeta {
  title: string;
  description: string;
  keywords: string;
  ogTitle?: string;
  ogDescription?: string;
  canonicalUrl?: string;
}

// Configuration for static pages
export const SEO_PAGES: Record<string, PageMeta> = {
  '/': {
    title: 'CIM Share - Professional Confidential Information Memorandums',
    description: 'Create, customize, and securely share professional Confidential Information Memorandums with AI-powered analysis, digital signatures, and comprehensive analytics.',
    keywords: 'CIM, confidential information memorandum, business valuation, investment banking, M&A, due diligence, business documentation',
    ogTitle: 'CIM Share - Professional Business Documentation Platform',
    ogDescription: 'Transform your business documentation with AI-powered CIM creation, secure sharing, and comprehensive analytics.',
    canonicalUrl: '/'
  },
  '/pricing': {
    title: 'Pricing Plans - CIM Share',
    description: 'Choose the perfect plan for your business documentation needs. Start with our free trial or upgrade to unlock advanced features and unlimited CIM creation.',
    keywords: 'CIM pricing, business documentation pricing, subscription plans, CIM software cost',
    ogTitle: 'CIM Share Pricing - Plans for Every Business',
    ogDescription: 'Flexible pricing plans designed for businesses of all sizes. Start free and scale as you grow.',
    canonicalUrl: '/pricing'
  },
  '/contact': {
    title: 'Contact Us - CIM Share Support',
    description: 'Get in touch with our team for support, questions about CIM Share, or to learn more about our business documentation solutions.',
    keywords: 'contact support, CIM help, business documentation support, customer service',
    ogTitle: 'Contact CIM Share - We\'re Here to Help',
    ogDescription: 'Have questions? Our support team is ready to help you succeed with professional business documentation.',
    canonicalUrl: '/contact'
  },
  '/features/nda-protection': {
    title: 'NDA Protection & Digital Signatures - Secure Document Sharing | CIM Share',
    description: 'Protect confidential business information with automated NDA workflows, digital signatures, and enterprise-grade security. Built for business brokers handling sensitive M&A transactions.',
    keywords: 'NDA protection, digital signatures, secure document sharing, confidentiality agreement, electronic signature, M&A security, business broker tools, one-click NDA',
    ogTitle: 'Secure Your M&A Documents with Digital NDAs & Advanced Protection',
    ogDescription: 'Automated NDA management with digital signatures, password protection, and complete audit trails. Trusted by 3,500+ business brokers.',
    canonicalUrl: '/features/nda-protection'
  },
  '/features/ai-powered-cim': {
    title: 'AI-Powered CIM Generator - Create Professional CIMs in Minutes | CIM Share',
    description: 'Transform business data into comprehensive Confidential Information Memorandums using AI. Generate investment-grade documentation 85% faster with automated financial analysis.',
    keywords: 'AI CIM generator, automated CIM creation, confidential information memorandum software, AI business valuation, financial modeling automation, M&A documentation tools',
    ogTitle: 'Create Professional CIMs in 2 Hours with AI Technology',
    ogDescription: 'AI-powered CIM generation that transforms financials and meeting transcripts into professional memorandums. Save 85% of documentation time.',
    canonicalUrl: '/features/ai-powered-cim'
  },
  '/features/investor-database': {
    title: 'Investor Database - 50,000+ Verified Business Buyers | CIM Share',
    description: 'Access our curated database of strategic buyers, private equity firms, and investors. Find perfect matches for your listings with advanced search and verified contact information.',
    keywords: 'investor database, business buyer database, private equity contacts, strategic buyer list, M&A buyer matching, investor CRM, buyer discovery platform',
    ogTitle: 'Connect with 50,000+ Verified Buyers and Investors',
    ogDescription: 'Instantly identify qualified buyers for your business listings. Access verified contacts, investment criteria, and deal history for faster closings.',
    canonicalUrl: '/features/investor-database'
  },
  '/solutions/business-brokers': {
    title: 'Business Broker Software - Complete M&A Platform | CIM Share',
    description: 'The complete M&A platform for business brokers. Professional CIM creation, secure document sharing, and buyer matching. Close deals 45% faster with enterprise-grade tools.',
    keywords: 'business broker software, business broker CRM, M&A platform, Main Street M&A tools, business sale software, broker document management, CIM software for brokers',
    ogTitle: 'Business Broker Platform - Close Deals 45% Faster',
    ogDescription: 'Purpose-built for Main Street and lower middle market transactions. Join 3,500+ business brokers using CIM Share to streamline deal execution.',
    canonicalUrl: '/solutions/business-brokers'
  },
  '/solutions/investment-banking': {
    title: 'Investment Banking Platform - Enterprise M&A Tools | CIM Share',
    description: 'Institutional-grade M&A platform for investment banks with advanced analytics, API integrations, and white-label options. Trusted by 250+ investment banks.',
    keywords: 'investment banking software, M&A platform enterprise, virtual data room, deal marketing platform, investment bank CIM tools, secure M&A platform, cross-border transactions',
    ogTitle: 'Enterprise M&A Platform for Investment Banking Teams',
    ogDescription: 'Streamline complex transactions with bank-grade security, AI-powered documentation, and seamless integrations. $15B+ in deal volume processed.',
    canonicalUrl: '/solutions/investment-banking'
  }
};

/**
 * Generate complete HTML document with proper SEO meta tags
 */
export async function renderPageToHTML(route: string, baseUrl: string = ''): Promise<string> {
  const pageMeta = SEO_PAGES[route];
  if (!pageMeta) {
    throw new Error(`No SEO configuration found for route: ${route}`);
  }

  // Load the built HTML template - prioritize production build
  const templatePaths = [
    path.resolve(process.cwd(), 'dist', 'public', 'index.html'),
    path.resolve(process.cwd(), 'client', 'index.html')
  ];
  
  let template: string = '';
  
  for (const templatePath of templatePaths) {
    try {
      template = await fs.readFile(templatePath, 'utf-8');
      console.log(`✅ Loaded template from: ${templatePath}`);
      break;
    } catch (error) {
      console.log(`❌ Failed to load template from: ${templatePath}`);
      continue;
    }
  }
  
  if (!template) {
    // Enhanced fallback HTML template with better CSS loading
    template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
  <link rel="stylesheet" href="/fonts/handwritania.css" />
  <title>__TITLE__</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
    .loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading">Loading...</div>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  }

  // Generate SEO meta tags
  const metaTags = generateMetaTags(pageMeta, baseUrl + route);
  
  // Add basic page content to help with indexing
  const pageContent = generatePageContent(route, pageMeta);
  
  // Replace title and inject meta tags and content
  let htmlWithMeta = template;
  
  // Handle different possible title formats
  const titlePatterns = [
    /<title>.*?<\/title>/i,
    /<title.*?>.*?<\/title>/i
  ];
  
  let titleReplaced = false;
  for (const pattern of titlePatterns) {
    if (pattern.test(htmlWithMeta)) {
      htmlWithMeta = htmlWithMeta.replace(pattern, `<title>${pageMeta.title}</title>`);
      titleReplaced = true;
      break;
    }
  }
  
  if (!titleReplaced) {
    htmlWithMeta = htmlWithMeta.replace('</head>', `  <title>${pageMeta.title}</title>\n</head>`);
  }
  
  // Inject meta tags before closing head tag
  htmlWithMeta = htmlWithMeta.replace('</head>', `  ${metaTags}\n</head>`);
  
  // Inject basic page content into the root div for SEO crawlers
  const rootDivPattern = /<div id="root"[^>]*>[\s\S]*?<\/div>/;
  if (rootDivPattern.test(htmlWithMeta)) {
    htmlWithMeta = htmlWithMeta.replace(rootDivPattern, `<div id="root">${pageContent}</div>`);
  }

  return htmlWithMeta;
}

/**
 * Generate comprehensive meta tags for SEO
 */
function generateMetaTags(meta: PageMeta, fullUrl: string): string {
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<meta name="keywords" content="${escapeHtml(meta.keywords)}">`,
    
    // Open Graph tags
    `<meta property="og:title" content="${escapeHtml(meta.ogTitle || meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.ogDescription || meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(fullUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="CIM Share">`,
    `<meta property="og:image" content="${new URL('/og-image.png', fullUrl).toString()}">`,
    `<meta property="og:image:alt" content="CIM Share - Create professional CIMs in minutes">`,
    
    // Twitter Card tags
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(meta.ogTitle || meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.ogDescription || meta.description)}">`,
    `<meta name="twitter:image" content="${new URL('/og-image.png', fullUrl).toString()}">`,
    
    // Canonical URL
    `<link rel="canonical" href="${escapeHtml(fullUrl)}">`,
    
    // Additional SEO tags
    `<meta name="robots" content="index, follow">`,
    `<meta name="author" content="CIM Share">`,
    `<link rel="manifest" href="/manifest.json">`,
    
    // Structured data for business
    `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "CIM Share",
  "applicationCategory": "BusinessApplication",
  "description": "Professional platform for creating and sharing Confidential Information Memorandums",
  "url": "${escapeHtml(fullUrl)}",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "category": "Business Software"
  }
}
</script>`
  ];

  return tags.join('\n    ');
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generate basic page content for SEO crawlers
 */
function generatePageContent(route: string, meta: PageMeta): string {
  const content = {
    '/': `
      <header>
        <h1>CIM Share - Professional Confidential Information Memorandums</h1>
        <nav>
          <a href="/pricing">Pricing</a>
          <a href="/contact">Contact</a>
          <a href="/features/nda-protection">NDA Protection</a>
          <a href="/features/ai-powered-cim">AI-Powered CIM</a>
          <a href="/features/investor-database">Investor Database</a>
        </nav>
      </header>
      <main>
        <section>
          <h2>Transform Your Business Documentation</h2>
          <p>${meta.description}</p>
          <ul>
            <li>AI-powered CIM generation</li>
            <li>Secure document sharing with NDAs</li>
            <li>Access to 50,000+ verified investors</li>
            <li>Professional templates and analytics</li>
          </ul>
        </section>
      </main>`,
    '/pricing': `
      <header><h1>Pricing Plans - CIM Share</h1></header>
      <main>
        <section>
          <h2>Choose Your Plan</h2>
          <p>${meta.description}</p>
          <div>
            <div><h3>Free Trial</h3><p>Get started with basic features</p></div>
            <div><h3>Professional</h3><p>Advanced features for growing businesses</p></div>
            <div><h3>Enterprise</h3><p>Full suite for large organizations</p></div>
          </div>
        </section>
      </main>`,
    '/contact': `
      <header><h1>Contact Us - CIM Share Support</h1></header>
      <main>
        <section>
          <h2>Get in Touch</h2>
          <p>${meta.description}</p>
          <div>
            <p>Email: support@brokervault.ai</p>
            <p>Phone: 1-800-CIM-SHARE</p>
            <p>Address: Business Documentation Solutions</p>
          </div>
        </section>
      </main>`
  };
  
  // Generate feature/solution page content
  if (route.startsWith('/features/') || route.startsWith('/solutions/')) {
    return `
      <header><h1>${meta.title}</h1></header>
      <main>
        <section>
          <h2>${meta.ogTitle || meta.title}</h2>
          <p>${meta.description}</p>
          <ul>
            <li>Professional business documentation</li>
            <li>Enterprise-grade security</li>
            <li>Streamlined workflow automation</li>
            <li>Comprehensive analytics and reporting</li>
          </ul>
        </section>
      </main>`;
  }
  
  return content[route as keyof typeof content] || `
    <header><h1>${meta.title}</h1></header>
    <main>
      <section>
        <h2>Professional Business Documentation</h2>
        <p>${meta.description}</p>
      </section>
    </main>`;
}

/**
 * Generate sitemap.xml for all SEO pages
 */
export function generateSitemap(baseUrl: string): string {
  const urls = Object.keys(SEO_PAGES).map(route => {
    const priority = route === '/' ? '1.0' : '0.8';
    const changefreq = route === '/' ? 'weekly' : 'monthly';
    
    return `  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}